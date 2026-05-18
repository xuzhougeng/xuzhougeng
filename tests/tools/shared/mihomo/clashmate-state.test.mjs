import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRuleTargetOptions,
  buildRelayFlowPreview,
  createDefaultTargetProxyDraft,
  createDefaultClashmateState,
  rewriteCustomRuleTargets,
} from "../../../../tools/shared/mihomo/clashmate-state.mjs";

test("createDefaultClashmateState seeds Relay-Group, AI-Relay, and built-in AI rule defaults", () => {
  const state = createDefaultClashmateState();

  assert.equal(state.originalConfig, "");
  assert.deepEqual(state.upstreamProxies, []);
  assert.deepEqual(state.relayProxies, []);
  assert.deepEqual(state.relayProxyNames, []);
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

test("buildRelayFlowPreview shows ordinary and AI relay request paths", () => {
  assert.deepEqual(
    buildRelayFlowPreview({
      ordinaryGroups: [
        { name: "Auto", type: "url-test", proxies: ["HK 香港 01"] },
        { name: "Proxy", type: "select", proxies: ["HK 香港 01"] },
      ],
      upstreamProxies: [
        { name: "HK 香港 01", type: "ss" },
        { name: "JP 日本 01", type: "ss" },
      ],
      relayProxyNames: ["HK 香港 01"],
      targetProxies: [
        { name: "AI-US 美国 01", type: "socks5", "dialer-proxy": "Relay-Group" },
      ],
      relayGroup: "Relay-Group",
      aiRelayGroup: "AI-Relay",
    }),
    {
      ordinary: ["普通请求", "Proxy", "HK 香港 01", "目标网站"],
      ai: ["AI 请求", "AI-Relay", "AI-US 美国 01", "目标网站"],
      dialer: ["AI-US 美国 01", "dialer-proxy: Relay-Group", "HK 香港 01"],
    }
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
