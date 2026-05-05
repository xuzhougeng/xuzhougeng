import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRuleTargetOptions,
  createDefaultTargetProxyDraft,
  createDefaultClashmateState,
  rewriteCustomRuleTargets,
} from "../../../../tools/shared/mihomo/clashmate-state.mjs";

test("createDefaultClashmateState seeds Relay-Group, AI-Relay, and built-in AI rule defaults", () => {
  const state = createDefaultClashmateState();

  assert.equal(state.originalConfig, "");
  assert.deepEqual(state.upstreamProxies, []);
  assert.deepEqual(state.relayProxies, []);
  assert.deepEqual(state.targetProxies, []);
  assert.deepEqual(state.ordinaryGroups, [
    { name: "Auto", type: "url-test", proxies: [] },
    { name: "Proxy", type: "select", proxies: [] },
  ]);
  assert.equal(state.relayGroup, "Relay-Group");
  assert.equal(state.relayGroupType, "select");
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
      ordinaryGroups: [
        { name: "Auto", type: "url-test", proxies: [] },
        { name: "Proxy", type: "select", proxies: [] },
        { name: "Proxy", type: "select", proxies: [] },
      ],
      aiRelayGroup: "AI-Relay",
    }),
    ["DIRECT", "REJECT", "Auto", "Proxy", "AI-Relay"]
  );
});

test("createDefaultTargetProxyDraft seeds a new target proxy bound to Relay-Group", () => {
  assert.deepEqual(createDefaultTargetProxyDraft(), {
    name: "",
    type: "socks5",
    server: "",
    port: "",
    username: "",
    password: "",
    "dialer-proxy": "Relay-Group",
  });
});

test("rewriteCustomRuleTargets only rewrites rule target positions", () => {
  assert.deepEqual(
    rewriteCustomRuleTargets(
      [
        "PROCESS-NAME,Streaming,DIRECT",
        "DOMAIN-SUFFIX,relay-only.example,Relay-Group",
        "DOMAIN-SUFFIX,ai-only.example,AI-Relay,no-resolve",
        "MATCH,AI-Relay",
        "DOMAIN-SUFFIX,keep.example,Proxy",
        "DOMAIN-SUFFIX,Relay-Group.example,DIRECT",
      ],
      {
        "Relay-Group": "Relay-Chain",
        "AI-Relay": "AI-Target",
        Streaming: "Streaming-2",
      }
    ),
    [
      "PROCESS-NAME,Streaming,DIRECT",
      "DOMAIN-SUFFIX,relay-only.example,Relay-Chain",
      "DOMAIN-SUFFIX,ai-only.example,AI-Target,no-resolve",
      "MATCH,AI-Target",
      "DOMAIN-SUFFIX,keep.example,Proxy",
      "DOMAIN-SUFFIX,Relay-Group.example,DIRECT",
    ]
  );
});
