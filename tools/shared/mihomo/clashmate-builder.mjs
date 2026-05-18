import { coreAiRelay, extendedAiRelay, renderRulePackLines } from "./ai-rule-packs.mjs";
import { buildRuleTargetOptions } from "./clashmate-state.mjs";
import { PROVIDER_URLS } from "./provider-catalog.mjs";

const RULE_PACKS = {
  coreAiRelay,
  extendedAiRelay,
};
const TESTABLE_GROUP_TYPES = new Set(["url-test", "fallback"]);
const DOMAIN_RULE_TYPES = new Set(["DOMAIN", "DOMAIN-SUFFIX", "DOMAIN-KEYWORD"]);
const LOAD_BALANCE_GROUP_TYPE = "load-balance";
const RELAY_TEST_URL = "http://www.gstatic.com/generate_204";
const AI_PREVIEW_DOMAIN_CANDIDATES = [
  "chatgpt.com",
  "openai.com",
  "anthropic.com",
  "claude.ai",
  "gemini.google.com",
];

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

function normalizeProxyNames(values) {
  const seen = new Set();
  const names = [];

  for (const value of normalizeArray(values)) {
    const name = String(value ?? "").trim();
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    names.push(name);
  }

  return names;
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

function parseRuleLine(rule) {
  const normalized = normalizeRuleLine(rule);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(",").map(part => part.trim());
  const type = parts[0]?.toUpperCase();
  const targetIndex = type === "MATCH" || type === "FINAL" ? 1 : 2;
  const target = parts[targetIndex] ?? "";

  if (!type || !target) {
    return null;
  }

  return {
    raw: normalized,
    type,
    value: parts[1] ?? "",
    target,
  };
}

function buildRuleIdentity(parsedRule) {
  if (!DOMAIN_RULE_TYPES.has(parsedRule?.type) || !parsedRule.value) {
    return null;
  }

  return `${parsedRule.type},${parsedRule.value}`;
}

function detectRuleTargetConflicts(rules) {
  const firstSeen = new Map();
  const conflictsByKey = new Map();

  rules.forEach((rule, index) => {
    const parsedRule = parseRuleLine(rule);
    const ruleKey = buildRuleIdentity(parsedRule);
    if (!ruleKey) {
      return;
    }

    if (!firstSeen.has(ruleKey)) {
      firstSeen.set(ruleKey, {
        ...parsedRule,
        index,
        targetSet: new Set([parsedRule.target]),
      });
      return;
    }

    const first = firstSeen.get(ruleKey);
    if (first.targetSet.has(parsedRule.target)) {
      return;
    }

    first.targetSet.add(parsedRule.target);

    if (!conflictsByKey.has(ruleKey)) {
      conflictsByKey.set(ruleKey, {
        ruleKey,
        firstRule: first.raw,
        firstTarget: first.target,
        firstIndex: first.index,
        conflictingRules: [],
        conflictingTargets: [],
        effectiveTarget: first.target,
      });
    }

    const conflict = conflictsByKey.get(ruleKey);
    conflict.conflictingRules.push(parsedRule.raw);
    conflict.conflictingTargets.push(parsedRule.target);
  });

  return [...conflictsByKey.values()];
}

function ruleMatchesDomain(parsedRule, domain) {
  const normalizedDomain = String(domain ?? "").toLowerCase();
  const value = String(parsedRule?.value ?? "").toLowerCase();
  if (!normalizedDomain || !value) {
    return false;
  }

  if (parsedRule.type === "DOMAIN") {
    return normalizedDomain === value;
  }

  if (parsedRule.type === "DOMAIN-SUFFIX") {
    return normalizedDomain === value || normalizedDomain.endsWith(`.${value}`);
  }

  if (parsedRule.type === "DOMAIN-KEYWORD") {
    return normalizedDomain.includes(value);
  }

  return false;
}

function findFirstDomainMatch(rules, domain) {
  for (const rule of rules) {
    const parsedRule = parseRuleLine(rule);
    if (!parsedRule) {
      continue;
    }

    if (parsedRule.type === "MATCH" || parsedRule.type === "FINAL") {
      return parsedRule;
    }

    if (ruleMatchesDomain(parsedRule, domain)) {
      return parsedRule;
    }
  }

  return null;
}

function collectAiPreviewDomains(builtInLines, aiRelayGroup) {
  const builtInRules = builtInLines
    .map(parseRuleLine)
    .filter(rule => rule && rule.target === aiRelayGroup);

  return AI_PREVIEW_DOMAIN_CANDIDATES.filter(domain =>
    builtInRules.some(rule => ruleMatchesDomain(rule, domain))
  );
}

function buildAiRuleHitPreview(rules, builtInLines, aiRelayGroup) {
  return collectAiPreviewDomains(builtInLines, aiRelayGroup).map(domain => {
    const matchedRule = findFirstDomainMatch(rules, domain);
    const target = matchedRule?.target ?? "";

    return {
      domain,
      target,
      expectedTarget: aiRelayGroup,
      ok: target === aiRelayGroup,
      matchedRule: matchedRule?.raw ?? "",
    };
  });
}

function buildRuleWarnings(ruleConflicts, aiRuleHitPreview) {
  const conflictWarnings = ruleConflicts.map(conflict => {
    const targets = [conflict.firstTarget, ...conflict.conflictingTargets].join(" 和 ");
    return `检测到冲突规则：${conflict.ruleKey} 同时指向 ${targets}。由于规则自上而下匹配，当前实际会走 ${conflict.effectiveTarget}。`;
  });
  const previewWarnings = aiRuleHitPreview
    .filter(row => !row.ok)
    .map(row => `AI 规则实际命中异常：${row.domain} 当前走 ${row.target || "未命中"}，应为 ${row.expectedTarget}。`);

  return [...conflictWarnings, ...previewWarnings];
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
  const extraRelayNames = relayProxies.map(normalizeProxyName).filter(Boolean);
  const relayNames = Object.hasOwn(normalizedState, "relayProxyNames")
    ? normalizeProxyNames(normalizedState.relayProxyNames)
    : normalizeProxyNames(extraRelayNames);
  const targetNames = targetProxies.map(normalizeProxyName).filter(Boolean);
  const { enabledRulePacks, lines: builtInLines } = buildBuiltInRuleLines(state);
  const customRules = normalizeArray(normalizedState.customRules).map(rule => String(rule).trim()).filter(Boolean);
  const extraRulePackLines = normalizeArray(normalizedState.extraRulePackLines)
    .map(normalizeRuleLine)
    .filter(Boolean);
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
    extraRulePackLines.some(rule => ruleReferencesGroup(rule, aiRelayGroup)) ||
    providerRuleLines.some(rule => ruleReferencesGroup(rule, aiRelayGroup));
  const directRelayRuleReference =
    customRules.some(rule => ruleReferencesGroup(rule, relayGroup)) ||
    extraRulePackLines.some(rule => ruleReferencesGroup(rule, relayGroup)) ||
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

  const relayCandidateNames = new Set([...upstreamNames, ...extraRelayNames]);
  for (const relayName of relayNames) {
    if (!relayCandidateNames.has(relayName)) {
      throw new Error(`unknown relay proxy "${relayName}" selected for ${relayGroup}`);
    }
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
    extraRulePackLines,
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
  const selectedRelayNames = new Set(validated.relayNames);
  const upstreamNameSet = new Set(validated.upstreamNames);
  const selectedExtraRelayProxies = relayProxies.filter(proxy => {
    const name = normalizeProxyName(proxy);
    return selectedRelayNames.has(name) && !upstreamNameSet.has(name);
  });
  const proxies = [
    ...upstreamProxies.map(proxy => ({ ...proxy, name: normalizeProxyName(proxy) })),
    ...selectedExtraRelayProxies.map(proxy => ({ ...proxy, name: normalizeProxyName(proxy) })),
    ...targetProxies.map(proxy => normalizeTargetProxy(proxy, validated.relayGroup)),
  ];
  const rules = [
    ...validated.customRules,
    ...validated.builtInLines,
    ...validated.extraRulePackLines,
    ...validated.providerRuleLines,
    "GEOIP,CN,DIRECT",
    `MATCH,${validated.ordinaryGroupNames[0]}`,
  ];
  const ruleConflicts = detectRuleTargetConflicts(rules);
  const aiRuleHitPreview = buildAiRuleHitPreview(rules, validated.builtInLines, validated.aiRelayGroup);
  const warnings = buildRuleWarnings(ruleConflicts, aiRuleHitPreview);

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
      extraRulePackCount: validated.extraRulePackLines.length,
      ruleCount: rules.length,
      builtInRuleCount: validated.builtInLines.length,
      ruleConflicts,
      aiRuleHitPreview,
      warnings,
    },
  };
}
