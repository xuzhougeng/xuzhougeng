const RESERVED_ORDINARY_GROUPS = ["Auto", "Proxy"];
const RESERVED_RELAY_GROUP = "Relay-Group";
const RESERVED_AI_RELAY_GROUP = "AI-Relay";

export function createDefaultClashmateState() {
  return {
    originalConfig: "",
    upstreamProxies: [],
    relayProxies: [],
    targetProxies: [],
    ordinaryGroups: [...RESERVED_ORDINARY_GROUPS],
    relayGroup: RESERVED_RELAY_GROUP,
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

  for (const groupName of [...ordinaryGroups, aiRelayGroup]) {
    const normalized = String(groupName ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    options.push(normalized);
  }

  return options;
}
