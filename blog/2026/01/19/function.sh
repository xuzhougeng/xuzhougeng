_proxy_require_env() {
  local missing=""

  if [ -z "${http_proxy:-}" ]; then
    missing="http_proxy"
  fi
  if [ -z "${https_proxy:-}" ]; then
    if [ -n "$missing" ]; then
      missing="$missing https_proxy"
    else
      missing="https_proxy"
    fi
  fi

  if [ -n "$missing" ]; then
    echo "error: missing proxy env: $missing" >&2
    return 1
  fi

  return 0
}

_proxy_is_up() {
  local proxy_url proxy_no_scheme proxy_no_creds proxy_hostport proxy_host proxy_port

  proxy_url="${https_proxy:-$http_proxy}"
  proxy_no_scheme="${proxy_url#*://}"
  proxy_no_creds="${proxy_no_scheme##*@}"
  proxy_hostport="${proxy_no_creds%%/*}"
  proxy_host="${proxy_hostport%%:*}"
  proxy_port="${proxy_hostport##*:}"

  if [ -z "$proxy_host" ] || [ -z "$proxy_port" ] || [ "$proxy_port" = "$proxy_hostport" ]; then
    echo "error: cannot parse proxy host/port from $proxy_url" >&2
    return 1
  fi

  local rc=1
  if command -v nc >/dev/null 2>&1; then
    nc -z -w 1 "$proxy_host" "$proxy_port" >/dev/null 2>&1 && rc=0
  elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
    timeout 1 bash -c "cat < /dev/null > /dev/tcp/${proxy_host}/${proxy_port}" >/dev/null 2>&1 && rc=0
  else
    (echo >"/dev/tcp/${proxy_host}/${proxy_port}") >/dev/null 2>&1 && rc=0
  fi

  if [ $rc -ne 0 ]; then
    echo "proxy not reachable at ${proxy_host}:${proxy_port}; please enable it" >&2
    return 1
  fi

  return 0
}

gemini() {
  _proxy_require_env || return 1
  _proxy_is_up || return 1
  command gemini "$@"
}

codex() {
  _proxy_require_env || return 1
  _proxy_is_up || return 1
  command codex "$@"
}

claude() {
  _proxy_require_env || return 1
  _proxy_is_up || return 1
  command claude "$@"
}

select_fastest_relay() {
  local api="http://127.0.0.1:1993"
  local group="relay-group"

  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl not found" >&2
    return 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq not found" >&2
    return 1
  fi

  echo "[...] testing relay latency..."

  curl -s -X GET "$api/group/$group/delay?timeout=5000&url=http://www.gstatic.com/generate_204" > /dev/null
  sleep 3

  local result nodes best_node best_delay encoded delay
  result=$(curl -s "$api/proxies/$group")
  nodes=$(echo "$result" | jq -r '.all[]')

  best_node=""
  best_delay=99999

  while IFS= read -r node; do
    encoded=$(printf '%s' "$node" | jq -sRr @uri)
    delay=$(curl -s "$api/proxies/$encoded" | jq -r '.history[-1].delay // 0')

    if ! [[ "$delay" =~ ^[0-9]+$ ]] || [ "$delay" -le 0 ] || [ "$delay" -ge 99999 ]; then
      echo "  $node: timeout/unavailable"
      continue
    fi

    echo "  $node: ${delay}ms"

    if [ "$delay" -lt "$best_delay" ]; then
      best_delay=$delay
      best_node=$node
    fi
  done <<< "$nodes"

  if [ -z "$best_node" ]; then
    echo "[x] no available nodes"
    return 1
  fi

  echo ""
  echo "[ok] fastest node: $best_node (${best_delay}ms)"

  local payload
  payload=$(jq -n --arg name "$best_node" '{name: $name}')
  curl -s -X PUT "$api/proxies/$group" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null

  echo "[ok] switched"
}

_proxy_pidfile() {
  echo "/tmp/mihomo.pid"
}

_proxy_logfile() {
  echo "/tmp/mihomo.log"
}

show_relay() {
  local api="http://127.0.0.1:1993"
  local group="relay-group"

  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl not found" >&2
    return 1
  fi

  curl -s "$api/proxies/$group" | jq -r '.now // "none"'
}

proxy_logs() {
  local logfile lines
  logfile="$(_proxy_logfile)"
  lines="${1:-50}"

  if [ ! -f "$logfile" ]; then
    echo "error: logfile not found: $logfile" >&2
    return 1
  fi

  tail -n "$lines" "$logfile"
}

proxy_logs_follow() {
  local logfile
  logfile="$(_proxy_logfile)"

  if [ ! -f "$logfile" ]; then
    echo "error: logfile not found: $logfile" >&2
    return 1
  fi

  tail -f "$logfile"
}

start_proxy() {
  local config="$1"
  local pidfile logfile pid
  pidfile="$(_proxy_pidfile)"
  logfile="$(_proxy_logfile)"

  if ! command -v mihomo >/dev/null 2>&1; then
    echo "error: mihomo not found; install from https://github.com/MetaCubeX/mihomo/releases" >&2
    return 1
  fi
  if [ -z "$config" ]; then
    echo "error: config path required" >&2
    return 1
  fi
  if [ ! -f "$config" ]; then
    echo "error: config not found: $config" >&2
    return 1
  fi

  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "error: proxy already running (pid $pid)" >&2
      return 1
    fi
  fi

  nohup mihomo -f "$config" >"$logfile" 2>&1 &
  echo $! > "$pidfile"
}

stop_proxy() {
  local pidfile pid
  pidfile="$(_proxy_pidfile)"

  if [ ! -f "$pidfile" ]; then
    echo "error: pidfile not found; proxy may not be running" >&2
    return 1
  fi

  pid=$(cat "$pidfile" 2>/dev/null)
  if [ -z "$pid" ]; then
    echo "error: invalid pidfile; remove $pidfile" >&2
    return 1
  fi

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "error: process not running (pid $pid)" >&2
    rm -f "$pidfile"
    return 1
  fi

  kill "$pid" >/dev/null 2>&1
  rm -f "$pidfile"
}
