function extractInlineValue(body, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(
    new RegExp(`(?:^|,)\\s*${escapedKey}:\\s*(\"[^\"]*\"|'[^']*'|[^,}]+)`)
  );
  if (!match) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function createProxyFromLine(line, trimmed) {
  const proxy = { raw: `${line}\n` };

  if (/^-\s*\{/.test(trimmed)) {
    const body = trimmed.replace(/^-\s*\{\s*/, "").replace(/\s*\}\s*$/, "");
    proxy.name = extractInlineValue(body, "name")?.trim();
    proxy.type = extractInlineValue(body, "type");
    proxy.server = extractInlineValue(body, "server")?.trim();
    proxy.port = extractInlineValue(body, "port");
    return proxy;
  }

  const nameMatch = trimmed.match(/^-\s*name:\s*["']?([^"'\n]+)["']?/);
  if (nameMatch) {
    proxy.name = nameMatch[1].trim();
  }
  return proxy;
}

export function parseYamlProxies(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const proxies = [];
  let currentProxy = null;
  let inProxiesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      if (currentProxy) {
        currentProxy.raw += `${line}\n`;
      }
      continue;
    }

    if (line === "proxies:" || trimmed === "proxies:" && !line.startsWith(" ")) {
      inProxiesSection = true;
      continue;
    }

    if (inProxiesSection && !line.startsWith(" ") && /^[^#\s][^:]*:\s*$|^[^#\s][^:]*:\s*.+$/.test(line)) {
      if (currentProxy?.name) {
        proxies.push(currentProxy);
      }
      currentProxy = null;
      inProxiesSection = false;
      continue;
    }

    if (
      inProxiesSection &&
      (trimmed.startsWith("- name:") || trimmed.startsWith("-name:") || /^-\s*\{/.test(trimmed))
    ) {
      if (currentProxy?.name) {
        proxies.push(currentProxy);
      }
      currentProxy = createProxyFromLine(line, trimmed);
      continue;
    }

    if (currentProxy) {
      currentProxy.raw += `${line}\n`;

      if (trimmed.startsWith("type:")) {
        const typeMatch = trimmed.match(/type:\s*["']?(\S+)["']?/);
        if (typeMatch) currentProxy.type = typeMatch[1];
      } else if (trimmed.startsWith("server:")) {
        const serverMatch = trimmed.match(/server:\s*["']?([^"'\n]+)["']?/);
        if (serverMatch) currentProxy.server = serverMatch[1].trim();
      } else if (trimmed.startsWith("port:")) {
        const portMatch = trimmed.match(/port:\s*(\d+)/);
        if (portMatch) currentProxy.port = portMatch[1];
      }
      continue;
    }

    if (inProxiesSection && (trimmed.startsWith("-") || /^\s{2,}-/.test(line))) {
      if (currentProxy?.name) {
        proxies.push(currentProxy);
      }
      currentProxy = createProxyFromLine(line, trimmed);
    }
  }

  if (currentProxy?.name) {
    proxies.push(currentProxy);
  }

  return proxies;
}

export function buildTargetProxyNode(input = {}) {
  const name = String(input.name ?? "").trim();
  const type = String(input.type ?? "").trim();
  const server = String(input.server ?? "").trim();
  const port = String(input.port ?? "").trim();
  const username = String(input.username ?? "").trim();
  const password = String(input.password ?? "").trim();
  const dialerProxy = String(input.dialerProxy ?? input["dialer-proxy"] ?? "relay-group").trim();

  const node = {
    name,
    type,
    server,
    port,
    "dialer-proxy": dialerProxy || "relay-group",
  };

  if (username) {
    node.username = username;
  }

  if (password) {
    node.password = password;
  }

  return node;
}
