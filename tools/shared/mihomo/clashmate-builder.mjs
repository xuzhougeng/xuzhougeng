import { coreAiRelay, extendedAiRelay, renderRulePackLines } from "./ai-rule-packs.mjs";
import { buildRuleTargetOptions } from "./clashmate-state.mjs";
import { PROVIDER_URLS } from "./provider-catalog.mjs";

const RULE_PACKS = {
  coreAiRelay,
  extendedAiRelay,
};
const TESTABLE_GROUP_TYPES = new Set(["url-test", "fallback"]);
const LOAD_BALANCE_GROUP_TYPE = "load-balance";
const RELAY_TEST_URL = "http://www.gstatic.com/generate_204";

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

function normalizeGroupName(value) {
  return String(value ?? "").trim();
}

function normalizeOrdinaryGroups(ordinaryGroups) {
  return normalizeArray(ordinaryGroups)
    .map(group => {
      if (typeof group === "string") {
        return {
          name: normalizeGroupName(group),
          type: group === "Auto" ? "url-test" : "select",
          proxies: [],
        };
      }

      return {
        name: normalizeGroupName(group?.name),
        type: normalizeGroupName(group?.type) || (normalizeGroupName(group?.name) === "Auto" ? "url-test" : "select"),
        proxies: normalizeArray(group?.proxies).map(proxyName => String(proxyName ?? "").trim()).filter(Boolean),
      };
    })
    .filter(group => group.name);
}

function decorateProxyGroup(group) {
  const nextGroup = {
    ...group,
  };

  if (TESTABLE_GROUP_TYPES.has(nextGroup.type)) {
    nextGroup.url = RELAY_TEST_URL;
    nextGroup.interval = 300;
  }

  if (nextGroup.type === LOAD_BALANCE_GROUP_TYPE) {
    nextGroup.strategy = "consistent-hashing";
  }

  return nextGroup;
}

function validateRelayGraph(state) {
  const normalizedState = state ?? {};
  const ordinaryGroups = normalizeOrdinaryGroups(normalizedState.ordinaryGroups);
  const relayGroup = String(normalizedState.relayGroup ?? "").trim();
  const relayGroupType = String(normalizedState.relayGroupType ?? "").trim() || "select";
  const aiRelayGroup = String(normalizedState.aiRelayGroup ?? "").trim();
  const upstreamProxies = normalizeArray(normalizedState.upstreamProxies);
  const relayProxies = normalizeArray(normalizedState.relayProxies);
  const targetProxies = normalizeArray(normalizedState.targetProxies);
  const upstreamNames = upstreamProxies.map(normalizeProxyName).filter(Boolean);
  const relayNames = relayProxies.map(normalizeProxyName).filter(Boolean);
  const targetNames = targetProxies.map(normalizeProxyName).filter(Boolean);
  const { enabledRulePacks, lines: builtInLines } = buildBuiltInRuleLines(state);
  const customRules = normalizeArray(normalizedState.customRules).map(rule => String(rule).trim()).filter(Boolean);
  const ordinaryGroupNames = ordinaryGroups.map(group => group.name);
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

  if (!ordinaryGroupNames.length || ordinaryGroupNames[0] !== "Auto" || !ordinaryGroupNames.includes("Proxy")) {
    throw new Error("ordinaryGroups must include reserved groups Auto and Proxy");
  }

  if (!relayGroup) {
    throw new Error("relayGroup is required");
  }

  if (!aiRelayGroup) {
    throw new Error("aiRelayGroup is required");
  }

  const seenGroupNames = new Set();
  for (const groupName of [...ordinaryGroupNames, relayGroup, aiRelayGroup]) {
    if (seenGroupNames.has(groupName)) {
      throw new Error(`duplicate group name "${groupName}"`);
    }
    seenGroupNames.add(groupName);
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
    ordinaryGroupNames,
    relayGroup,
    relayGroupType,
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

function buildProxyGroups({ ordinaryGroups, relayGroup, relayGroupType, aiRelayGroup, upstreamNames, relayNames, targetNames }) {
  return [
    ...ordinaryGroups.map(group =>
      decorateProxyGroup({
        name: group.name,
        type: group.type,
        proxies: group.proxies.length
          ? group.proxies
          : group.name === "Auto" || group.name === "Proxy"
            ? upstreamNames
            : [],
      })
    ),
    decorateProxyGroup({
      name: relayGroup,
      type: relayGroupType,
      proxies: relayNames,
    }),
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
    `MATCH,${validated.ordinaryGroupNames[0]}`,
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
        ordinary: validated.ordinaryGroupNames,
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
