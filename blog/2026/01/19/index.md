# 相对安全的Claude Code/Codex/Gemini的使用方法

本工具借助 [mihomo](https://github.com/MetaCubeX/mihomo/releases) 的 dialer-proxy 功能，通过中转节点连接固定的美国家庭带宽，用于稳定访问 AI 服务（Gemini、Codex、Claude 等）。

## 准备工作

你需要准备两样东西：

| 类型 | 说明 |
|------|------|
| 中转代理 | 用于连接美国节点，普通代理即可 |
| 美国家庭带宽 | 固定 IP 的美国住宅代理 |

## 生成配置文件

访问 https://xuzhougeng.top/tools/dialer-proxy/ ，填入你的代理信息，生成 mihomo 配置文件并保存。

## 安装

1. 下载 `function.sh` 到本地

2. 在 shell 配置文件中加载：

```bash
# Bash (~/.bashrc)
source /path/to/function.sh

# Zsh (~/.zshrc)
source /path/to/function.sh
```

3. 设置代理环境变量：

```bash
export http_proxy="http://127.0.0.1:7890"
export https_proxy="http://127.0.0.1:7890"
```

## 使用方法

### 启动/停止代理

```bash
# 启动 mihomo（需指定配置文件路径）
start_proxy /path/to/config.yaml

# 停止 mihomo
stop_proxy
```

### 节点管理

```bash
# 查看当前使用的中继节点
show_relay

# 自动测速并切换到最快的中转节点
select_fastest_relay
```

### 查看日志

```bash
# 查看最近 50 行日志（默认）
proxy_logs

# 查看最近 100 行日志
proxy_logs 100

# 实时跟踪日志
proxy_logs_follow
```

### 使用 AI 工具

直接调用即可，函数会自动检查代理状态：

```bash
gemini "your prompt"
codex "your prompt"
claude "your prompt"
```

如果代理未启动或环境变量未设置，会提示相应错误。

## 常见问题

**Q: 提示 "missing proxy env"**

设置 `http_proxy` 和 `https_proxy` 环境变量。

**Q: 提示 "proxy not reachable"**

检查 mihomo 是否正常运行，或执行 `start_proxy` 启动。

**Q: 提示 "mihomo not found"**

从 [mihomo releases](https://github.com/MetaCubeX/mihomo/releases) 下载并安装。
