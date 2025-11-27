#!/usr/bin/env python3
import os
import pwd
import json
import socket
import time
import subprocess
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# ========= 配置区 =========
BARK_KEY = "你的BARK KEY"  # 必填！
BARK_SERVER = "https://api.day.app"      # 自建 bark-server 就改这里
THRESHOLD = 80                           # 总内存使用率阈值（百分比）
STATE_FILE = "/var/tmp/mem_watch_bark_state.json"

TOP_USERS = 5                            # 推送中展示的用户 Top N
TOP_GROUPS = 5                           # 用户+命令组合 Top N
TOP_PROCS_PER_GROUP = 2                  # 每个组合展示几个最大进程
MIN_ALERT_INTERVAL_SEC = 600             # 两次告警之间的最小间隔（秒），防止刷屏

def get_all_ip_addresses():
    """
    获取本机所有非回环的IPv4地址列表。
    会优先将 10.10.x.x 的地址排在前面。
    """
    ips = set()
    try:
        # Main method: Use `ip` command on Linux
        output = subprocess.check_output(
            ["ip", "-4", "addr"], stderr=subprocess.DEVNULL, text=True
        )
        for line in output.split("\n"):
            if " inet " in line:
                parts = line.strip().split()
                ip = parts[1].split("/")[0]
                if ip != "127.0.0.1":
                    ips.add(ip)
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback for non-Linux or systems without `ip` command
        try:
            hostname = socket.gethostname()
            # This can return multiple IPs for a hostname
            _, _, ipaddrlist = socket.gethostbyname_ex(hostname)
            for ip in ipaddrlist:
                if ip != "127.0.0.1":
                    ips.add(ip)
        except socket.gaierror:
            # A final, simple fallback
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                ip = s.getsockname()[0]
                s.close()
                if ip != "127.0.0.1":
                    ips.add(ip)
            except OSError:
                pass  # No IP found

    # Sort IPs, putting '10.10.' addresses first
    ips_list = list(ips)
    preferred_ips = sorted([ip for ip in ips_list if ip.startswith("10.10.")])
    other_ips = sorted([ip for ip in ips_list if not ip.startswith("10.10.")])

    return preferred_ips + other_ips


def read_meminfo():
    """从 /proc/meminfo 读取总内存、可用内存和 swap 信息，单位 kB。"""
    meminfo = {}
    with open("/proc/meminfo") as f:
        for line in f:
            parts = line.split()
            key = parts[0].rstrip(":")
            try:
                value = int(parts[1])
            except (IndexError, ValueError):
                continue
            meminfo[key] = value

    total_kb = meminfo["MemTotal"]
    # 用 MemAvailable 更接近真实可用内存
    avail_kb = meminfo.get(
        "MemAvailable",
        meminfo.get("MemFree", 0)
        + meminfo.get("Buffers", 0)
        + meminfo.get("Cached", 0),
    )
    used_effective_kb = total_kb - avail_kb
    percent = int(used_effective_kb * 100 / total_kb)

    # Swap 信息
    swap_total_kb = meminfo.get("SwapTotal", 0)
    swap_free_kb = meminfo.get("SwapFree", 0)
    swap_used_kb = max(swap_total_kb - swap_free_kb, 0)
    swap_percent = int(swap_used_kb * 100 / swap_total_kb) if swap_total_kb > 0 else 0

    return (
        total_kb,
        used_effective_kb,
        avail_kb,
        percent,
        swap_total_kb,
        swap_used_kb,
        swap_percent,
    )

def collect_stats():
    """
    遍历 /proc，按 用户 和 用户+命令 聚合 RSS。
    返回：
      users:  {uid: {"username", "rss_kb", "procs":[(rss_kb,pid,cmd), ...]}}
      groups: {(uid, base_cmd): {"username","base_cmd","rss_kb","procs":[...]}}
    """
    users = {}
    groups = {}
    proc_root = "/proc"

    for entry in os.listdir(proc_root):
        if not entry.isdigit():
            continue
        pid = entry
        status_path = os.path.join(proc_root, pid, "status")

        try:
            with open(status_path) as f:
                uid = None
                rss_kb = 0
                name = None
                for line in f:
                    if line.startswith("Name:"):
                        name = line.split(":", 1)[1].strip()
                    elif line.startswith("Uid:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            uid = int(parts[1])
                    elif line.startswith("VmRSS:"):
                        parts = line.split()
                        if len(parts) >= 2:
                            rss_kb = int(parts[1])
                if uid is None or rss_kb <= 0:
                    continue
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            # 进程刚退出/没权限，都跳过
            continue

        try:
            username = pwd.getpwuid(uid).pw_name
        except KeyError:
            username = f"uid{uid}"

        cmd = name or ""
        cmdline_path = os.path.join(proc_root, pid, "cmdline")
        try:
            with open(cmdline_path, "rb") as f:
                raw = f.read().replace(b"\x00", b" ").strip()
                if raw:
                    cmd = raw.decode("utf-8", "ignore")
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            pass

        # base_cmd = 命令行第一个词，例如 python、Rscript、cr_lib 等
        base_cmd = cmd.split()[0] if cmd.split() else (name or "unknown")

        # 按用户聚合
        info_u = users.setdefault(
            uid, {"username": username, "rss_kb": 0, "procs": []}
        )
        info_u["rss_kb"] += rss_kb
        info_u["procs"].append((rss_kb, int(pid), cmd[:160]))

        # 按 用户+命令 聚合
        key = (uid, base_cmd)
        info_g = groups.setdefault(
            key,
            {"username": username, "base_cmd": base_cmd, "rss_kb": 0, "procs": []},
        )
        info_g["rss_kb"] += rss_kb
        info_g["procs"].append((rss_kb, int(pid), cmd[:160]))

    return users, groups

def read_loadavg():
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().split()
        if len(parts) >= 3:
            return float(parts[0]), float(parts[1]), float(parts[2])
    except Exception:
        pass
    return None, None, None

def load_state():
    """读取上次状态：prev_percent, consec_high, last_alert_ts"""
    try:
        with open(STATE_FILE) as f:
            data = json.load(f)
        prev_percent = int(data.get("prev_percent", 0))
        consec_high = int(data.get("consec_high", 0))
        last_alert_ts = float(data.get("last_alert_ts", 0.0))
        return prev_percent, consec_high, last_alert_ts
    except Exception:
        return 0, 0, 0.0

def save_state(percent, consec_high, last_alert_ts):
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        with open(STATE_FILE, "w") as f:
            json.dump(
                {
                    "prev_percent": int(percent),
                    "consec_high": int(consec_high),
                    "last_alert_ts": float(last_alert_ts),
                },
                f,
            )
    except Exception:
        pass

def send_bark(title, body):
    if not BARK_KEY:
        return
    url = f"{BARK_SERVER.rstrip('/')}/{BARK_KEY}/"
    data = urlencode({"title": title, "body": body}).encode("utf-8")
    req = Request(url, data=data)
    try:
        with urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception:
        # 告警失败就算了，别影响脚本本身
        pass

def main():
    now = time.time()

    (
        total_kb,
        used_kb,
        avail_kb,
        percent,
        swap_total_kb,
        swap_used_kb,
        swap_percent,
    ) = read_meminfo()

    prev_percent, consec_high, last_alert_ts = load_state()

    # 连续高占用计数：每次检查 >= 阈值 就 +1，否则清零
    if percent >= THRESHOLD:
        consec_high += 1
    else:
        consec_high = 0

    should_alert = False
    # 触发条件：超过阈值 且 连续次数 >= 2（假设每分钟跑一次 ≈ 连续 2 分钟）
    if percent >= THRESHOLD and consec_high >= 2:
        # 再加一个“最小告警间隔”，防止 80% 卡着一直刷你
        if now - last_alert_ts >= MIN_ALERT_INTERVAL_SEC:
            should_alert = True
            last_alert_ts = now

    # 无论是否告警，都更新状态
    save_state(percent, consec_high, last_alert_ts)

    if not should_alert:
        return

    users, groups = collect_stats()
    hostname = socket.gethostname()
    ip_addresses = get_all_ip_addresses()
    ip_str = ", ".join(ip_addresses) if ip_addresses else "N/A"

    total_gib = total_kb / 1024 / 1024
    used_gib = used_kb / 1024 / 1024
    avail_gib = avail_kb / 1024 / 1024
    swap_total_gib = swap_total_kb / 1024 / 1024
    swap_used_gib = swap_used_kb / 1024 / 1024

    la1, la5, la15 = read_loadavg()

    lines = []
    lines.append(f"主机: {hostname} (IPs: {ip_str})")
    lines.append(f"有效内存使用: {used_gib:.1f} GiB / {total_gib:.1f} GiB ({percent}%)")
    lines.append(f"剩余可用: {avail_gib:.1f} GiB")

    if swap_total_kb > 0:
        lines.append(
            f"Swap 使用: {swap_used_gib:.1f} GiB / {swap_total_gib:.1f} GiB ({swap_percent}%)"
        )
    else:
        lines.append("Swap: 未启用或为 0")

    if la1 is not None:
        lines.append(f"LoadAvg: {la1:.2f}, {la5:.2f}, {la15:.2f}")

    lines.append("")

    # ===== 按用户聚合 Top =====
    user_list = sorted(users.items(), key=lambda kv: kv[1]["rss_kb"], reverse=True)
    lines.append("按用户内存占用 Top:")
    for i, (uid, info) in enumerate(user_list[:TOP_USERS], start=1):
        rss_gib = info["rss_kb"] / 1024 / 1024
        user_percent = info["rss_kb"] * 100.0 / total_kb
        lines.append(
            f"{i}. {info['username']} (UID {uid}): "
            f"{rss_gib:.1f} GiB (~{user_percent:.1f}% 总内存)"
        )

    lines.append("")

    # ===== 按 用户+命令 组合 聚合 Top =====
    group_list = sorted(groups.items(), key=lambda kv: kv[1]["rss_kb"], reverse=True)
    lines.append("按 用户+命令 组合 Top:")
    for i, ((uid, base_cmd), info) in enumerate(
        group_list[:TOP_GROUPS], start=1
    ):
        rss_gib = info["rss_kb"] / 1024 / 1024
        user_percent = info["rss_kb"] * 100.0 / total_kb
        lines.append(
            f"{i}. {info['username']} (UID {uid}), {base_cmd}: "
            f"{rss_gib:.1f} GiB (~{user_percent:.1f}% 总内存)"
        )
        # 该组合下最大的几个进程
        procs = sorted(info["procs"], key=lambda x: x[0], reverse=True)
        for rss_kb, pid, cmd in procs[:TOP_PROCS_PER_GROUP]:
            proc_gib = rss_kb / 1024 / 1024
            lines.append(f"   - PID {pid}: {proc_gib:.2f} GiB | {cmd}")

    body = "\n".join(lines)
    title = (
        f"内存告警: {hostname} {percent}% "
        f"(连续 {consec_high} 次 ≥ {THRESHOLD}%)"
    )

    send_bark(title, body)

if __name__ == "__main__":
    main()

