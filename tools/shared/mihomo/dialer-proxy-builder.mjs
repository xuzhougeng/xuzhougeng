import { coreAiRelay, extendedAiRelay, renderRulePackLines } from "./ai-rule-packs.mjs";

const STANDALONE_TERMINAL_RULES = ["MATCH,DIRECT"];

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProxyName(proxy) {
  return String(proxy?.name ?? "").trim();
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function sanitizeProxyFields(proxy) {
  const sanitized = {};

  for (const [key, value] of Object.entries(proxy ?? {})) {
    if (key === "raw") {
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      sanitized[key] = trimmed;
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function normalizeRelayProxy(proxy) {
  return {
    ...sanitizeProxyFields(proxy),
    name: normalizeProxyName(proxy),
  };
}

function normalizeTargetProxy(proxy, relayGroup) {
  const source = sanitizeProxyFields(proxy);
  const dialerProxy = normalizeString(source["dialer-proxy"] ?? source.dialerProxy ?? relayGroup) || relayGroup;
  const normalized = {
    name: normalizeProxyName(source),
    type: normalizeString(source.type || "socks5") || "socks5",
    server: normalizeString(source.server),
    port: normalizeString(source.port),
    "dialer-proxy": dialerProxy,
  };

  const username = normalizeString(source.username);
  const password = normalizeString(source.password);

  if (username) {
    normalized.username = username;
  }

  if (password) {
    normalized.password = password;
  }

  return normalized;
}

function normalizeRuleLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  return trimmed.replace(/^-+\s*/, "");
}

export function buildDialerProxyConfig(input = {}) {
  const relayProxies = normalizeArray(input.relayProxies)
    .map(normalizeRelayProxy)
    .filter(proxy => proxy.name);

  if (!relayProxies.length) {
    throw new Error("Dialer-Proxy requires at least one relay proxy");
  }

  const requestedRelayGroup = String(
    input.relayGroup ??
      input.targetProxy?.["dialer-proxy"] ??
      input.targetProxy?.dialerProxy ??
      "relay-group"
  ).trim();
  const relayGroup = requestedRelayGroup || "relay-group";
  const targetProxy = normalizeTargetProxy(input.targetProxy, relayGroup);
  const targetName = targetProxy.name;
  const proxyNames = relayProxies.map(proxy => proxy.name);
  const enabledRulePacks = [coreAiRelay, extendedAiRelay];
  const rules = enabledRulePacks
    .flatMap(rulePack => renderRulePackLines(rulePack, targetName))
    .map(normalizeRuleLine)
    .filter(Boolean)
    .concat(STANDALONE_TERMINAL_RULES);

  const config = {
    port: 1990,
    "socks-port": 1991,
    "allow-lan": true,
    mode: "rule",
    "log-level": "info",
    "external-controller": "127.0.0.1:1993",
    proxies: [...relayProxies, targetProxy],
    "proxy-groups": [
      {
        name: relayGroup,
        type: "select",
        proxies: proxyNames,
      },
      {
        name: "Proxy",
        type: "select",
        proxies: [...proxyNames, targetName].filter(Boolean),
      },
    ],
    rules,
  };

  return {
    config,
    summary: {
      relayGroup,
      relayProxyNames: proxyNames,
      targetProxyName: targetName,
      enabledRulePacks: enabledRulePacks.map(rulePack => rulePack.name),
      ruleCount: rules.length,
    },
  };
}
