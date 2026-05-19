function extractInlineValue(body, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(
    new RegExp(`(?:^|,)\\s*${escapedKey}:\\s*(\"[^\"]*\"|'[^']*'|[^,}]+)`)
  );
  if (!match) return undefined;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function extractYamlLineValue(trimmed, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = trimmed.match(new RegExp(`^${escapedKey}:\\s*(.*)$`));
  if (!match) return undefined;

  const value = match[1].trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function applyProxyField(proxy, trimmed) {
  const name = extractYamlLineValue(trimmed, "name");
  if (name !== undefined) {
    proxy.name = name.trim();
    return;
  }

  const type = extractYamlLineValue(trimmed, "type");
  if (type !== undefined) {
    proxy.type = type.trim();
    return;
  }

  const server = extractYamlLineValue(trimmed, "server");
  if (server !== undefined) {
    proxy.server = server.trim();
    return;
  }

  const port = extractYamlLineValue(trimmed, "port");
  if (port !== undefined) {
    proxy.port = port.trim();
  }
}

function getIndent(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function isProxyListItemStart(trimmed) {
  return /^-\s*(?:$|name:|\{)/.test(trimmed);
}

function isTopLevelSectionLine(line, trimmed) {
  return (
    !line.startsWith(" ") &&
    !trimmed.startsWith("-") &&
    /^[^#\s][^:]*:\s*$|^[^#\s][^:]*:\s*.+$/.test(line)
  );
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

  applyProxyField(proxy, trimmed.replace(/^-\s*/, ""));
  return proxy;
}

export function normalizeYamlProxiesInput(yamlText) {
  const raw = String(yamlText ?? "");
  const trimmed = raw.trim();

  if (!trimmed) {
    return "";
  }

  if (/^proxies:\s*(?:$|\r?\n)/.test(trimmed)) {
    return raw;
  }

  if (/^-\s*(?:$|\r?\n|name:|\{)/.test(trimmed)) {
    return `proxies:\n${raw}`;
  }

  return raw;
}

export function parseYamlProxies(yamlText) {
  const lines = normalizeYamlProxiesInput(yamlText).split(/\r?\n/);
  const proxies = [];
  let currentProxy = null;
  let inProxiesSection = false;
  let proxyListIndent = null;

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
      proxyListIndent = null;
      continue;
    }

    if (inProxiesSection && isTopLevelSectionLine(line, trimmed)) {
      if (currentProxy?.name) {
        proxies.push(currentProxy);
      }
      currentProxy = null;
      inProxiesSection = false;
      proxyListIndent = null;
      continue;
    }

    if (inProxiesSection && isProxyListItemStart(trimmed)) {
      const lineIndent = getIndent(line);
      const startsProxy =
        proxyListIndent === null ||
        lineIndent <= proxyListIndent ||
        currentProxy === null;

      if (startsProxy) {
        if (currentProxy?.name) {
          proxies.push(currentProxy);
        }
        currentProxy = createProxyFromLine(line, trimmed);
        proxyListIndent = lineIndent;
        continue;
      }
    }

    if (currentProxy) {
      currentProxy.raw += `${line}\n`;
      applyProxyField(currentProxy, trimmed);
      continue;
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
