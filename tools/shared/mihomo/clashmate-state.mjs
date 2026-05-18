const RESERVED_ORDINARY_GROUPS = ["Auto", "Proxy"];
const RESERVED_RELAY_GROUP = "Relay-Group";
const RESERVED_AI_RELAY_GROUP = "AI-Relay";
const DEFAULT_ORDINARY_GROUP_TYPES = {
  Auto: "url-test",
  Proxy: "select",
};

function createOrdinaryGroup(name, type = DEFAULT_ORDINARY_GROUP_TYPES[name] ?? "select", proxies = []) {
  return {
    name,
    type,
    proxies: Array.isArray(proxies) ? [...proxies] : [],
  };
}

export function createDefaultClashmateState() {
  return {
    originalConfig: "",
    upstreamProxies: [],
    relayProxies: [],
    relayProxyNames: [],
    targetProxies: [],
    ordinaryGroups: RESERVED_ORDINARY_GROUPS.map(name => createOrdinaryGroup(name)),
    relayGroup: RESERVED_RELAY_GROUP,
    relayGroupType: "select",
    aiRelayGroup: RESERVED_AI_RELAY_GROUP,
    selectedRulePacks: {
      coreAiRelay: true,
      extendedAiRelay: false,
    },
    selectedProviders: {},
    customRules: [],
  };
}

export function buildRuleTargetOptions({ ordinaryGroups = [], aiRelayGroup = RESERVED_AI_RELAY_GROUP } = {}) {
  const seen = new Set(["DIRECT", "REJECT"]);
  const options = ["DIRECT", "REJECT"];

  for (const groupEntry of [...ordinaryGroups, aiRelayGroup]) {
    const groupName = typeof groupEntry === "string" ? groupEntry : groupEntry?.name;
    const normalized = String(groupName ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    options.push(normalized);
  }

  return options;
}

function normalizeEntryNames(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map(entry => String((typeof entry === "string" ? entry : entry?.name) ?? "").trim())
    .filter(Boolean);
}

export function buildRelayFlowPreview({
  ordinaryGroups = [],
  upstreamProxies = [],
  relayProxyNames = [],
  targetProxies = [],
  relayGroup = RESERVED_RELAY_GROUP,
  aiRelayGroup = RESERVED_AI_RELAY_GROUP,
} = {}) {
  const ordinaryGroupNames = normalizeEntryNames(ordinaryGroups);
  const upstreamNames = normalizeEntryNames(upstreamProxies);
  const relayNames = normalizeEntryNames(relayProxyNames);
  const targetNames = normalizeEntryNames(targetProxies);
  const proxyGroup = ordinaryGroupNames.includes("Proxy")
    ? "Proxy"
    : ordinaryGroupNames[0] || "Proxy";
  const upstreamName = upstreamNames[0] || "上传节点";
  const targetName = targetNames[0] || "目标节点（待填写）";
  const relayName = relayNames[0] || "Relay 节点（待选择）";
  const normalizedRelayGroup = String(relayGroup ?? "").trim() || RESERVED_RELAY_GROUP;
  const normalizedAiRelayGroup = String(aiRelayGroup ?? "").trim() || RESERVED_AI_RELAY_GROUP;

  return {
    ordinary: ["普通请求", proxyGroup, upstreamName, "目标网站"],
    ai: ["AI 请求", normalizedAiRelayGroup, targetName, "目标网站"],
    dialer: [targetName, `dialer-proxy: ${normalizedRelayGroup}`, relayName],
  };
}

export function createDefaultTargetProxyDraft(relayGroup = RESERVED_RELAY_GROUP) {
  return {
    name: "",
    type: "socks5",
    server: "",
    port: "",
    username: "",
    password: "",
    "dialer-proxy": String(relayGroup ?? "").trim() || RESERVED_RELAY_GROUP,
  };
}

export function rewriteCustomRuleTargets(customRules = [], renameMap = {}) {
  const normalizedRenameMap = Object.fromEntries(
    Object.entries(renameMap)
      .map(([oldName, newName]) => [String(oldName ?? "").trim(), String(newName ?? "").trim()])
      .filter(([oldName, newName]) => oldName && newName && oldName !== newName)
  );

  return (Array.isArray(customRules) ? customRules : []).map(rule => {
    const text = String(rule ?? "");
    if (!text.includes(",")) {
      return text;
    }

    const parts = text.split(",");
    const ruleType = parts[0]?.trim().toUpperCase();
    const targetIndex = ruleType === "MATCH" || ruleType === "FINAL" ? 1 : 2;
    if (parts.length <= targetIndex) {
      return text;
    }

    const originalTarget = parts[targetIndex];
    const trimmedTarget = originalTarget.trim();
    if (!Object.hasOwn(normalizedRenameMap, trimmedTarget)) {
      return text;
    }

    const leadingWhitespace = originalTarget.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = originalTarget.match(/\s*$/)?.[0] ?? "";
    const rewritten = [...parts];
    rewritten[targetIndex] = `${leadingWhitespace}${normalizedRenameMap[trimmedTarget]}${trailingWhitespace}`;

    return rewritten.join(",");
  });
}
