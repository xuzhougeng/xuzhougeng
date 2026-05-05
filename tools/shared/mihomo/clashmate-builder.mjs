import { coreAiRelay, extendedAiRelay, renderRulePackLines } from "./ai-rule-packs.mjs";
import { buildRuleTargetOptions } from "./clashmate-state.mjs";
import { PROVIDER_URLS } from "./provider-catalog.mjs";

const RULE_PACKS = {
  coreAiRelay,
  extendedAiRelay,
};

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cloneBaseConfig(originalConfig) {
  if (!originalConfig || typeof originalConfig !== "object" || Array.isArray(originalConfig)) {
    return {};
  }

  return structuredClone(originalConfig);
}

function normalizeProxyName(proxy) {
  return String(proxy?.name ?? "").trim();
}

function normalizeRuleLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("#")) {
    return null;
  }

  return trimmed.replace(/^-\s*/, "");
}

function normalizeSelectedProviders(selectedProviders, allowedTargets) {
  const normalizedProviders = {};

  for (const [providerName, target] of Object.entries(normalizeObject(selectedProviders))) {
    if (!PROVIDER_URLS[providerName]) {
      continue;
    }

    const normalizedTarget = String(target ?? "").trim();
    if (!normalizedTarget) {
      continue;
    }

    if (!allowedTargets.has(normalizedTarget)) {
      throw new Error(`unsupported provider target "${normalizedTarget}" for ${providerName}`);
    }

    normalizedProviders[providerName] = normalizedTarget;
  }

  return normalizedProviders;
}

function buildRuleProviders(selectedProviders) {
  const entries = Object.entries(selectedProviders);

  return Object.fromEntries(
    entries.map(([providerName]) => [
      providerName,
      {
        type: "http",
        behavior: "classical",
        format: "yaml",
        url: PROVIDER_URLS[providerName],
        path: `./ruleset/${encodeURIComponent(providerName)}.yaml`,
        interval: 86400,
      },
    ])
  );
}

function buildProviderRuleLines(selectedProviders) {
  return Object.entries(selectedProviders).map(
    ([providerName, target]) => `RULE-SET,${providerName},${target}`
  );
}

function ruleReferencesGroup(rule, groupName) {
  return String(rule ?? "")
    .split(",")
    .map(part => part.trim())
    .includes(groupName);
}

function buildBuiltInRuleLines(state) {
  const normalizedState = state ?? {};
  const enabledRulePacks = [];
  const lines = [];

  for (const [packName, enabled] of Object.entries(normalizedState.selectedRulePacks ?? {})) {
    if (!enabled || !RULE_PACKS[packName]) {
      continue;
    }

    enabledRulePacks.push(packName);

    for (const line of renderRulePackLines(RULE_PACKS[packName], normalizedState.aiRelayGroup)) {
      const normalized = normalizeRuleLine(line);
      if (normalized) {
        lines.push(normalized);
      }
    }
  }

  return { enabledRulePacks, lines };
}

function validateRelayGraph(state) {
  const normalizedState = state ?? {};
  const ordinaryGroups = Array.isArray(normalizedState.ordinaryGroups)
    ? normalizedState.ordinaryGroups.map(name => String(name).trim()).filter(Boolean)
    : [];
  const relayGroup = String(normalizedState.relayGroup ?? "").trim();
  const aiRelayGroup = String(normalizedState.aiRelayGroup ?? "").trim();
  const upstreamProxies = normalizeArray(normalizedState.upstreamProxies);
  const relayProxies = normalizeArray(normalizedState.relayProxies);
  const targetProxies = normalizeArray(normalizedState.targetProxies);
  const upstreamNames = upstreamProxies.map(normalizeProxyName).filter(Boolean);
  const relayNames = relayProxies.map(normalizeProxyName).filter(Boolean);
  const targetNames = targetProxies.map(normalizeProxyName).filter(Boolean);
  const { enabledRulePacks, lines: builtInLines } = buildBuiltInRuleLines(state);
  const customRules = normalizeArray(normalizedState.customRules).map(rule => String(rule).trim()).filter(Boolean);
  const allowedProviderTargets = new Set(
    buildRuleTargetOptions({
      ordinaryGroups,
      aiRelayGroup,
    }).concat(relayGroup)
  );
  const normalizedProviders = normalizeSelectedProviders(normalizedState.selectedProviders, allowedProviderTargets);
  const providerRuleLines = buildProviderRuleLines(normalizedProviders);
  const aiRelayReferenced =
    enabledRulePacks.length > 0 ||
    customRules.some(rule => ruleReferencesGroup(rule, aiRelayGroup)) ||
    providerRuleLines.some(rule => ruleReferencesGroup(rule, aiRelayGroup));
  const directRelayRuleReference =
    customRules.some(rule => ruleReferencesGroup(rule, relayGroup)) ||
    providerRuleLines.some(rule => ruleReferencesGroup(rule, relayGroup));
  const relayGroupReferenced =
    targetNames.length > 0 ||
    targetProxies.some(proxy => normalizeProxyName({ name: proxy?.["dialer-proxy"] ?? proxy?.dialerProxy }) === relayGroup) ||
    directRelayRuleReference ||
    aiRelayReferenced;

  if (!ordinaryGroups.length || ordinaryGroups[0] !== "Auto" || !ordinaryGroups.includes("Proxy")) {
    throw new Error("ordinaryGroups must include reserved groups Auto and Proxy");
  }

  if (!relayGroup) {
    throw new Error("relayGroup is required");
  }

  if (!aiRelayGroup) {
    throw new Error("aiRelayGroup is required");
  }

  if (!upstreamNames.length) {
    throw new Error("Auto and Proxy require at least one upstream proxy");
  }

  if (relayGroupReferenced && !relayNames.length) {
    throw new Error(`${relayGroup} requires at least one relay proxy`);
  }

  if (aiRelayReferenced && !targetNames.length) {
    throw new Error(`${aiRelayGroup} requires at least one target proxy`);
  }

  for (const proxy of targetProxies) {
    const dialerProxy = String(proxy?.["dialer-proxy"] ?? proxy?.dialerProxy ?? relayGroup).trim();
    if (dialerProxy !== relayGroup) {
      throw new Error(`target proxy ${normalizeProxyName(proxy)} must use ${relayGroup} as dialer-proxy`);
    }
  }

  return {
    ordinaryGroups,
    relayGroup,
    aiRelayGroup,
    upstreamNames,
    relayNames,
    targetNames,
    customRules,
    normalizedProviders,
    providerRuleLines,
    enabledRulePacks,
    builtInLines,
  };
}

function buildProxyGroups({ ordinaryGroups, relayGroup, aiRelayGroup, upstreamNames, relayNames, targetNames }) {
  return [
    ...ordinaryGroups.map(groupName => ({
      name: groupName,
      type: "select",
      proxies: upstreamNames,
    })),
    {
      name: relayGroup,
      type: "select",
      proxies: relayNames,
    },
    {
      name: aiRelayGroup,
      type: "select",
      proxies: targetNames,
    },
  ];
}

function normalizeTargetProxy(proxy, relayGroup) {
  return {
    ...proxy,
    name: normalizeProxyName(proxy),
    type: String(proxy?.type ?? "").trim(),
    server: String(proxy?.server ?? "").trim(),
    port: String(proxy?.port ?? "").trim(),
    "dialer-proxy": String(proxy?.["dialer-proxy"] ?? proxy?.dialerProxy ?? relayGroup).trim() || relayGroup,
  };
}

export function buildClashmateConfig(state) {
  const validated = validateRelayGraph(state);
  const normalizedState = state ?? {};
  const upstreamProxies = normalizeArray(normalizedState.upstreamProxies);
  const relayProxies = normalizeArray(normalizedState.relayProxies);
  const targetProxies = normalizeArray(normalizedState.targetProxies);
  const baseConfig = cloneBaseConfig(normalizedState.originalConfig);
  const proxies = [
    ...upstreamProxies.map(proxy => ({ ...proxy, name: normalizeProxyName(proxy) })),
    ...relayProxies.map(proxy => ({ ...proxy, name: normalizeProxyName(proxy) })),
    ...targetProxies.map(proxy => normalizeTargetProxy(proxy, validated.relayGroup)),
  ];
  const rules = [
    ...validated.customRules,
    ...validated.builtInLines,
    ...validated.providerRuleLines,
    "GEOIP,CN,DIRECT",
    `MATCH,${validated.ordinaryGroups[0]}`,
  ];

  const config = {
    ...baseConfig,
    proxies,
    "proxy-groups": buildProxyGroups(validated),
    "rule-providers": buildRuleProviders(validated.normalizedProviders),
    rules,
  };

  return {
    config,
    summary: {
      proxyPools: {
        upstream: validated.upstreamNames,
        relay: validated.relayNames,
        target: validated.targetNames,
      },
      groups: {
        ordinary: validated.ordinaryGroups,
        relay: validated.relayGroup,
        aiRelay: validated.aiRelayGroup,
      },
      enabledRulePacks: validated.enabledRulePacks,
      providerTargets: validated.normalizedProviders,
      customRuleCount: validated.customRules.length,
      ruleCount: rules.length,
      builtInRuleCount: validated.builtInLines.length,
    },
  };
}
