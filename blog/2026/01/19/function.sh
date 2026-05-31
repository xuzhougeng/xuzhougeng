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

_proxy_auto_setup() {
  if [ -n "${http_proxy:-}" ] && [ -n "${https_proxy:-}" ]; then
    return 0
  fi

  local port pidfile portfile pid
  pidfile="$(_proxy_pidfile)"
  portfile="$(_proxy_portfile)"

  if [ ! -f "$portfile" ]; then
    return 1
  fi

  port=$(cat "$portfile" 2>/dev/null)
  if [ -z "$port" ]; then
    return 1
  fi

  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      if _proxy_check_port "127.0.0.1" "$port"; then
        export http_proxy="http://127.0.0.1:${port}"
        export https_proxy="http://127.0.0.1:${port}"
        export HTTP_PROXY="$http_proxy"
        export HTTPS_PROXY="$https_proxy"
        return 0
      fi
    fi
  fi

  return 1
}

_proxy_check_port() {
  local host="$1"
  local port="$2"

  if command -v nc >/dev/null 2>&1; then
    nc -z -w 1 "$host" "$port" >/dev/null 2>&1 && return 0
  elif command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
    timeout 1 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" >/dev/null 2>&1 && return 0
  elif command -v bash >/dev/null 2>&1; then
    bash -c "echo >/dev/tcp/${host}/${port}" >/dev/null 2>&1 && return 0
  fi

  return 1
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

  if ! _proxy_check_port "$proxy_host" "$proxy_port"; then
    echo "proxy not reachable at ${proxy_host}:${proxy_port}; please enable it" >&2
    return 1
  fi

  return 0
}

gemini() {
  if ! _proxy_require_env 2>/dev/null; then
    if ! _proxy_auto_setup; then
      echo "error: proxy not configured and not running; run start_proxy first" >&2
      return 1
    fi
  fi
  _proxy_is_up || return 1
  command gemini "$@"
}

codex() {
  if ! _proxy_require_env 2>/dev/null; then
    if ! _proxy_auto_setup; then
      echo "error: proxy not configured and not running; run start_proxy first" >&2
      return 1
    fi
  fi
  _proxy_is_up || return 1
  command codex "$@"
}

claude() {
  if ! _proxy_require_env 2>/dev/null; then
    if ! _proxy_auto_setup; then
      echo "error: proxy not configured and not running; run start_proxy first" >&2
      return 1
    fi
  fi
  _proxy_is_up || return 1
  command claude "$@"
}

_select_fastest_relay_print_hints() {
  local proxies_json="$1"
  local selector_groups dialer_proxies suggested suggested_group suggested_proxy suggested_command

  selector_groups=$(echo "$proxies_json" | jq -r '.proxies | to_entries[] | select((.value.all? | type) == "array") | "  - \(.key)"')
  if [ -n "$selector_groups" ]; then
    echo "available selector groups:" >&2
    echo "$selector_groups" >&2
  fi

  dialer_proxies=$(echo "$proxies_json" | jq -r '.proxies | to_entries[] | select((.value["dialer-proxy"]? // "") != "") | "  - \(.key) -> \(.value["dialer-proxy"])"')
  if [ -n "$dialer_proxies" ]; then
    echo "proxies with dialer-proxy:" >&2
    echo "$dialer_proxies" >&2
  fi

  suggested=$(echo "$proxies_json" | jq -r '.proxies | to_entries[] | select((.value["dialer-proxy"]? // "") != "") | "\(.value["dialer-proxy"])	\(.key)"' | head -n1)
  if [ -n "$suggested" ]; then
    suggested_group="${suggested%%	*}"
    suggested_proxy="${suggested#*	}"
    suggested_command=$(jq -nr \
      --arg group "$suggested_group" \
      --arg proxy "$suggested_proxy" \
      '"SELECT_FASTEST_RELAY_GROUP=\($group | @sh) SELECT_FASTEST_RELAY_TEST_PROXY=\($proxy | @sh) select_fastest_relay"')
    echo "hint: try: $suggested_command" >&2
  fi
}

select_fastest_relay() {
  local api="${SELECT_FASTEST_RELAY_API:-${MIHOMO_API:-http://127.0.0.1:1993}}"
  local group="${SELECT_FASTEST_RELAY_GROUP:-relay-group}"
  local test_proxy="${SELECT_FASTEST_RELAY_TEST_PROXY:-target-socks5}"
  local test_url="http://www.gstatic.com/generate_204"
  local timeout="5000"
  local api_timeout="7"
  local settle_seconds="0.2"

  if [ "$#" -ge 1 ] && [ -n "$1" ]; then
    group="$1"
  fi
  if [ "$#" -ge 2 ] && [ -n "$2" ]; then
    test_proxy="$2"
  fi
  if [ "$#" -ge 3 ] && [ -n "$3" ]; then
    api="$3"
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl not found" >&2
    return 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq not found" >&2
    return 1
  fi

  echo "[...] testing relay latency through $test_proxy..."

  local result nodes current best_node best_delay encoded_group encoded_test_proxy payload delay proxies_result dialer_proxy
  encoded_group=$(printf '%s' "$group" | jq -sRr @uri)
  encoded_test_proxy=$(printf '%s' "$test_proxy" | jq -sRr @uri)

  if ! proxies_result=$(curl -s --noproxy '*' --max-time "$api_timeout" "$api/proxies"); then
    echo "error: cannot read mihomo API: $api" >&2
    echo "hint: check external-controller, or set SELECT_FASTEST_RELAY_API=http://127.0.0.1:9090" >&2
    return 1
  fi
  if ! echo "$proxies_result" | jq -e '.proxies | type == "object"' >/dev/null 2>&1; then
    echo "error: unexpected mihomo API response from $api/proxies" >&2
    echo "$proxies_result" >&2
    return 1
  fi

  if ! echo "$proxies_result" | jq -e --arg name "$group" '.proxies[$name].all | type == "array" and length > 0' >/dev/null 2>&1; then
    echo "error: proxy group not found or has no nodes: $group" >&2
    _select_fastest_relay_print_hints "$proxies_result"
    return 1
  fi

  if ! echo "$proxies_result" | jq -e --arg name "$test_proxy" '.proxies[$name]' >/dev/null 2>&1; then
    echo "error: test proxy not found: $test_proxy" >&2
    _select_fastest_relay_print_hints "$proxies_result"
    return 1
  fi

  dialer_proxy=$(echo "$proxies_result" | jq -r --arg name "$test_proxy" '.proxies[$name]["dialer-proxy"] // empty')
  if [ "$dialer_proxy" != "$group" ]; then
    echo "error: $test_proxy dialer-proxy mismatch" >&2
    echo "  expected: $group" >&2
    echo "  actual: ${dialer_proxy:-empty}" >&2
    echo "hint: full-chain latency requires the test proxy to use the selected relay group as dialer-proxy" >&2
    _select_fastest_relay_print_hints "$proxies_result"
    return 1
  fi

  result=$(echo "$proxies_result" | jq -c --arg name "$group" '.proxies[$name]')
  nodes=$(echo "$result" | jq -r '.all[]?')
  current=$(echo "$result" | jq -r '.now // empty')

  best_node=""
  best_delay=99999

  while IFS= read -r node; do
    if [ -z "$node" ]; then
      continue
    fi

    payload=$(jq -n --arg name "$node" '{name: $name}')
    curl -s --noproxy '*' --max-time "$api_timeout" -X PUT "$api/proxies/$encoded_group" \
      -H "Content-Type: application/json" \
      -d "$payload" > /dev/null
    sleep "$settle_seconds"

    delay=$(curl -s --noproxy '*' --max-time "$api_timeout" "$api/proxies/$encoded_test_proxy/delay?timeout=$timeout&url=$test_url" | jq -r '.delay // 0')

    if ! echo "$delay" | grep -qE '^[0-9]+$' || [ "$delay" -le 0 ] || [ "$delay" -ge 99999 ]; then
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
    if [ -n "$current" ]; then
      payload=$(jq -n --arg name "$current" '{name: $name}')
      curl -s --noproxy '*' --max-time "$api_timeout" -X PUT "$api/proxies/$encoded_group" \
        -H "Content-Type: application/json" \
        -d "$payload" > /dev/null
    fi
    echo "[x] no available nodes"
    echo "hint: tested $group nodes through $test_proxy, but every delay result was timeout/unavailable" >&2
    return 1
  fi

  echo
  echo "[ok] fastest node: $best_node (${best_delay}ms)"

  payload=$(jq -n --arg name "$best_node" '{name: $name}')
  curl -s --noproxy '*' --max-time "$api_timeout" -X PUT "$api/proxies/$encoded_group" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null

  echo "[ok] switched"
}

_proxy_pidfile() {
  echo "/tmp/mihomo-${USER}.pid"
}

_proxy_logfile() {
  echo "/tmp/mihomo-${USER}.log"
}

_proxy_portfile() {
  echo "/tmp/mihomo-${USER}.port"
}

_proxy_parse_port() {
  local config="$1"

  if ! command -v grep >/dev/null 2>&1; then
    return 1
  fi

  grep -E '^mixed-port:|^port:' "$config" 2>/dev/null | head -n1 | sed 's/.*: *//; s/ *#.*//'
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
  local pidfile logfile portfile pid port new_pid
  pidfile="$(_proxy_pidfile)"
  logfile="$(_proxy_logfile)"
  portfile="$(_proxy_portfile)"

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

  port=$(_proxy_parse_port "$config")
  if [ -z "$port" ]; then
    echo "error: cannot parse port from config (need mixed-port or port)" >&2
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
  new_pid=$!
  echo "$new_pid" > "$pidfile"
  echo "$port" > "$portfile"

  sleep 1
  if ! kill -0 "$new_pid" 2>/dev/null; then
    echo "error: mihomo failed to start, check $logfile" >&2
    rm -f "$pidfile" "$portfile"
    return 1
  fi

  if ! _proxy_check_port "127.0.0.1" "$port"; then
    echo "error: proxy port $port not reachable after start" >&2
    return 1
  fi

  export http_proxy="http://127.0.0.1:${port}"
  export https_proxy="http://127.0.0.1:${port}"
  export HTTP_PROXY="$http_proxy"
  export HTTPS_PROXY="$https_proxy"

  echo "proxy started (pid $new_pid, port $port)"
}

stop_proxy() {
  local pidfile portfile pid i
  pidfile="$(_proxy_pidfile)"
  portfile="$(_proxy_portfile)"

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
    rm -f "$pidfile" "$portfile"
    return 1
  fi

  kill "$pid" >/dev/null 2>&1

  i=0
  while kill -0 "$pid" 2>/dev/null && [ $i -lt 20 ]; do
    sleep 0.5
    i=$((i + 1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    echo "warning: process did not exit gracefully, sending SIGKILL" >&2
    kill -9 "$pid" 2>/dev/null
    sleep 1
  fi

  rm -f "$pidfile" "$portfile"
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
  echo "proxy stopped"
}
