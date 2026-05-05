import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRuleTargetOptions,
  createDefaultClashmateState,
} from "../../../../tools/shared/mihomo/clashmate-state.mjs";

test("createDefaultClashmateState seeds Relay-Group, AI-Relay, and built-in AI rule defaults", () => {
  const state = createDefaultClashmateState();

  assert.equal(state.originalConfig, "");
  assert.deepEqual(state.upstreamProxies, []);
  assert.deepEqual(state.relayProxies, []);
  assert.deepEqual(state.targetProxies, []);
  assert.deepEqual(state.ordinaryGroups, ["Auto", "Proxy"]);
  assert.equal(state.relayGroup, "Relay-Group");
  assert.equal(state.aiRelayGroup, "AI-Relay");
  assert.deepEqual(state.selectedRulePacks, {
    coreAiRelay: true,
    extendedAiRelay: false,
  });
  assert.deepEqual(state.selectedProviders, {});
  assert.deepEqual(state.customRules, []);
});

test("buildRuleTargetOptions exposes DIRECT, REJECT, ordinary groups, and AI-Relay without duplication", () => {
  assert.deepEqual(
    buildRuleTargetOptions({
      ordinaryGroups: ["Auto", "Proxy", "Proxy"],
      aiRelayGroup: "AI-Relay",
    }),
    ["DIRECT", "REJECT", "Auto", "Proxy", "AI-Relay"]
  );
});
