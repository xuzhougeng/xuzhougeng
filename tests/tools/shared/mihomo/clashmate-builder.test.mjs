import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultClashmateState } from "../../../../tools/shared/mihomo/clashmate-state.mjs";
import { buildClashmateConfig } from "../../../../tools/shared/mihomo/clashmate-builder.mjs";

function createBaseState() {
  const state = createDefaultClashmateState();

  state.originalConfig = {
    "mixed-port": 7890,
    mode: "rule",
    "external-controller": "127.0.0.1:9090",
    dns: { enable: true },
    rules: ["LEGACY,SHOULD,BE,REPLACED"],
    proxies: [{ name: "legacy-proxy", type: "ss" }],
    "proxy-groups": [{ name: "legacy-group", type: "select", proxies: ["legacy-proxy"] }],
    "rule-providers": {
      legacy: {
        type: "http",
        behavior: "classical",
        url: "https://example.com/legacy.yaml",
        path: "./ruleset/legacy.yaml",
      },
    },
  };

  state.upstreamProxies = [
    { name: "upstream-hk", type: "ss", server: "upstream.example.com", port: "443" },
    { name: "upstream-jp", type: "ss", server: "upstream2.example.com", port: "8443" },
  ];
  state.relayProxies = [
    { name: "relay-a", type: "ss", server: "relay-a.example.com", port: "443" },
    { name: "relay-b", type: "ss", server: "relay-b.example.com", port: "443" },
  ];
  state.relayProxyNames = ["relay-a", "relay-b"];
  state.targetProxies = [
    {
      name: "target-us",
      type: "socks5",
      server: "target.example.com",
      port: "1080",
      "dialer-proxy": "Relay-Group",
    },
  ];
  state.selectedProviders = {
    AdBlock: "REJECT",
    "AI Suite": "Proxy",
  };
  state.customRules = ["DOMAIN-SUFFIX,internal.example,DIRECT"];

  return state;
}

test("buildClashmateConfig assembles ordinary strategy groups, relay type, and reserved pools", () => {
  const state = createBaseState();
  state.ordinaryGroups.push({
    name: "Streaming",
    type: "fallback",
    proxies: ["upstream-jp"],
  });
  state.relayGroupType = "url-test";

  const result = buildClashmateConfig(state);
  const { config, summary } = result;

  assert.equal(config["mixed-port"], 7890);
  assert.equal(config.mode, "rule");
  assert.deepEqual(config.dns, { enable: true });
  assert.equal(config["external-controller"], "127.0.0.1:9090");

  assert.deepEqual(
    config.proxies.map(proxy => proxy.name),
    ["upstream-hk", "upstream-jp", "relay-a", "relay-b", "target-us"]
  );

  assert.deepEqual(
    config["proxy-groups"].map(group => group.name),
    ["Auto", "Proxy", "Streaming", "Relay-Group", "AI-Relay"]
  );

  const autoGroup = config["proxy-groups"].find(group => group.name === "Auto");
  const proxyGroup = config["proxy-groups"].find(group => group.name === "Proxy");
  const streamingGroup = config["proxy-groups"].find(group => group.name === "Streaming");
  const relayGroup = config["proxy-groups"].find(group => group.name === "Relay-Group");
  const aiRelayGroup = config["proxy-groups"].find(group => group.name === "AI-Relay");

  assert.equal(autoGroup.type, "url-test");
  assert.equal(autoGroup.url, "http://www.gstatic.com/generate_204");
  assert.equal(autoGroup.interval, 300);
  assert.deepEqual(autoGroup.proxies, ["upstream-hk", "upstream-jp"]);

  assert.equal(proxyGroup.type, "select");
  assert.deepEqual(proxyGroup.proxies, ["upstream-hk", "upstream-jp"]);

  assert.equal(streamingGroup.type, "fallback");
  assert.equal(streamingGroup.url, "http://www.gstatic.com/generate_204");
  assert.equal(streamingGroup.interval, 300);
  assert.deepEqual(streamingGroup.proxies, ["upstream-jp"]);

  assert.equal(relayGroup.type, "url-test");
  assert.equal(relayGroup.url, "http://www.gstatic.com/generate_204");
  assert.equal(relayGroup.interval, 300);
  assert.deepEqual(relayGroup.proxies, ["relay-a", "relay-b"]);

  assert.equal(aiRelayGroup.type, "select");
  assert.deepEqual(aiRelayGroup.proxies, ["target-us"]);

  assert.deepEqual(summary.proxyPools, {
    upstream: ["upstream-hk", "upstream-jp"],
    relay: ["relay-a", "relay-b"],
    target: ["target-us"],
  });
  assert.deepEqual(summary.groups, {
    ordinary: ["Auto", "Proxy", "Streaming"],
    relay: "Relay-Group",
    aiRelay: "AI-Relay",
  });
});

test("buildClashmateConfig orders rules as custom, built-in AI lines, provider lines, GEOIP, then MATCH", () => {
  const result = buildClashmateConfig(createBaseState());
  const { config, summary } = result;
  const customIndex = config.rules.indexOf("DOMAIN-SUFFIX,internal.example,DIRECT");
  const builtInRuleIndex = config.rules.indexOf("DOMAIN-SUFFIX,ai.com,AI-Relay");
  const providerIndex = config.rules.indexOf("RULE-SET,AdBlock,REJECT");
  const geoipIndex = config.rules.indexOf("GEOIP,CN,DIRECT");
  const matchIndex = config.rules.indexOf("MATCH,Auto");

  assert.ok(customIndex >= 0);
  assert.ok(builtInRuleIndex > customIndex);
  assert.ok(providerIndex > builtInRuleIndex);
  assert.ok(geoipIndex > providerIndex);
  assert.ok(matchIndex > geoipIndex);
  assert.equal(config.rules.some(rule => rule.startsWith("#")), false);

  assert.deepEqual(summary.enabledRulePacks, ["coreAiRelay"]);
  assert.deepEqual(Object.keys(config["rule-providers"]).sort(), ["AI Suite", "AdBlock"].sort());
});

test("buildClashmateConfig keeps internal non-AI rule-pack lines behind built-in AI rules", () => {
  const state = createBaseState();
  state.extraRulePackLines = ["DOMAIN-SUFFIX,chatgpt.com,Auto"];

  const { config, summary } = buildClashmateConfig(state);
  const aiRelayIndex = config.rules.indexOf("DOMAIN-SUFFIX,chatgpt.com,AI-Relay");
  const extraRulePackIndex = config.rules.indexOf("DOMAIN-SUFFIX,chatgpt.com,Auto");
  const providerIndex = config.rules.indexOf("RULE-SET,AdBlock,REJECT");

  assert.ok(aiRelayIndex >= 0);
  assert.ok(extraRulePackIndex > aiRelayIndex);
  assert.ok(providerIndex > extraRulePackIndex);
  assert.equal(summary.extraRulePackCount, 1);
});

test("buildClashmateConfig reports conflicting rule targets and first-match AI preview", () => {
  const state = createBaseState();
  state.customRules = ["DOMAIN-SUFFIX,chatgpt.com,Auto"];

  const { summary } = buildClashmateConfig(state);

  assert.deepEqual(
    summary.ruleConflicts.map(conflict => ({
      ruleKey: conflict.ruleKey,
      firstTarget: conflict.firstTarget,
      conflictingTargets: conflict.conflictingTargets,
      effectiveTarget: conflict.effectiveTarget,
    })),
    [
      {
        ruleKey: "DOMAIN-SUFFIX,chatgpt.com",
        firstTarget: "Auto",
        conflictingTargets: ["AI-Relay"],
        effectiveTarget: "Auto",
      },
    ]
  );
  assert.match(summary.warnings.join("\n"), /DOMAIN-SUFFIX,chatgpt\.com.*Auto.*AI-Relay/);

  const chatgptPreview = summary.aiRuleHitPreview.find(row => row.domain === "chatgpt.com");
  assert.deepEqual(
    {
      target: chatgptPreview.target,
      expectedTarget: chatgptPreview.expectedTarget,
      ok: chatgptPreview.ok,
    },
    {
      target: "Auto",
      expectedTarget: "AI-Relay",
      ok: false,
    }
  );
});

test("buildClashmateConfig fails when AI-Relay is enabled but Relay-Group has no relay members", () => {
  const state = createBaseState();
  state.relayProxies = [];
  state.relayProxyNames = [];

  assert.throws(
    () => buildClashmateConfig(state),
    /Relay-Group requires at least one relay proxy/i
  );
});

test("buildClashmateConfig can use selected uploaded nodes as Relay-Group members", () => {
  const state = createBaseState();
  state.relayProxies = [];
  state.relayProxyNames = ["upstream-jp"];

  const { config, summary } = buildClashmateConfig(state);
  const relayGroup = config["proxy-groups"].find(group => group.name === "Relay-Group");

  assert.deepEqual(
    config.proxies.map(proxy => proxy.name),
    ["upstream-hk", "upstream-jp", "target-us"]
  );
  assert.deepEqual(relayGroup.proxies, ["upstream-jp"]);
  assert.deepEqual(summary.proxyPools.relay, ["upstream-jp"]);
});

test("buildClashmateConfig only emits selected extra relay proxies", () => {
  const state = createBaseState();
  state.relayProxyNames = ["relay-a"];

  const { config } = buildClashmateConfig(state);
  const relayGroup = config["proxy-groups"].find(group => group.name === "Relay-Group");

  assert.deepEqual(
    config.proxies.map(proxy => proxy.name),
    ["upstream-hk", "upstream-jp", "relay-a", "target-us"]
  );
  assert.deepEqual(relayGroup.proxies, ["relay-a"]);
});

test("buildClashmateConfig rejects Relay-Group members that are not uploaded or extra relay nodes", () => {
  const state = createBaseState();
  state.relayProxies = [];
  state.relayProxyNames = ["missing-relay"];

  assert.throws(
    () => buildClashmateConfig(state),
    /unknown relay proxy.*missing-relay/i
  );
});

test("buildClashmateConfig fails when a custom rule points to Relay-Group without relay members", () => {
  const state = createDefaultClashmateState();
  state.upstreamProxies = [{ name: "upstream-hk", type: "ss", server: "upstream.example.com", port: "443" }];
  state.selectedRulePacks = {
    coreAiRelay: false,
    extendedAiRelay: false,
  };
  state.customRules = ["DOMAIN-SUFFIX,relay-only.example,Relay-Group"];

  assert.throws(
    () => buildClashmateConfig(state),
    /Relay-Group requires at least one relay proxy/i
  );
});

test("buildClashmateConfig ignores known providers with blank targets and keeps summary targets aligned", () => {
  const state = createBaseState();
  state.selectedProviders = {
    AdBlock: "   ",
    "AI Suite": " Proxy ",
  };

  const { config, summary } = buildClashmateConfig(state);

  assert.deepEqual(Object.keys(config["rule-providers"]), ["AI Suite"]);
  assert.equal(config.rules.includes("RULE-SET,AdBlock,"), false);
  assert.deepEqual(summary.providerTargets, {
    "AI Suite": "Proxy",
  });
});

test("buildClashmateConfig fails when a known provider uses an unsupported target", () => {
  const state = createBaseState();
  state.selectedProviders = {
    AdBlock: "Bogus-Target",
  };

  assert.throws(
    () => buildClashmateConfig(state),
    /unsupported provider target.*Bogus-Target.*AdBlock/i
  );
});

test("buildClashmateConfig detects Relay-Group references when rule options follow the target", () => {
  const state = createDefaultClashmateState();
  state.upstreamProxies = [{ name: "upstream-hk", type: "ss", server: "upstream.example.com", port: "443" }];
  state.selectedRulePacks = {
    coreAiRelay: false,
    extendedAiRelay: false,
  };
  state.customRules = ["DOMAIN-SUFFIX,relay-only.example,Relay-Group,no-resolve"];

  assert.throws(
    () => buildClashmateConfig(state),
    /Relay-Group requires at least one relay proxy/i
  );
});

test("buildClashmateConfig detects AI-Relay references when rule options follow the target", () => {
  const state = createDefaultClashmateState();
  state.upstreamProxies = [{ name: "upstream-hk", type: "ss", server: "upstream.example.com", port: "443" }];
  state.relayProxies = [{ name: "relay-a", type: "ss", server: "relay.example.com", port: "443" }];
  state.relayProxyNames = ["relay-a"];
  state.selectedRulePacks = {
    coreAiRelay: false,
    extendedAiRelay: false,
  };
  state.customRules = ["DOMAIN-SUFFIX,ai-only.example,AI-Relay,no-resolve"];

  assert.throws(
    () => buildClashmateConfig(state),
    /AI-Relay requires at least one target proxy/i
  );
});

test("buildClashmateConfig normalizes partial state objects instead of throwing raw TypeErrors", () => {
  assert.throws(
    () =>
      buildClashmateConfig({
        ordinaryGroups: [
          { name: "Auto", type: "url-test", proxies: [] },
          { name: "Proxy", type: "select", proxies: [] },
        ],
        relayGroup: "Relay-Group",
        relayGroupType: "select",
        aiRelayGroup: "AI-Relay",
        selectedRulePacks: {
          coreAiRelay: false,
          extendedAiRelay: false,
        },
      }),
    /Auto and Proxy require at least one upstream proxy/i
  );
});

test("buildClashmateConfig rejects duplicate ordinary group names", () => {
  const state = createBaseState();
  state.ordinaryGroups.push({
    name: "Proxy",
    type: "select",
    proxies: ["upstream-hk"],
  });

  assert.throws(
    () => buildClashmateConfig(state),
    /duplicate group name.*Proxy/i
  );
});

test("buildClashmateConfig rejects collisions between ordinary, relay, and AI group names", () => {
  const state = createBaseState();
  state.relayGroup = "Streaming";
  state.ordinaryGroups.push({
    name: "Streaming",
    type: "select",
    proxies: ["upstream-hk"],
  });

  assert.throws(
    () => buildClashmateConfig(state),
    /duplicate group name.*Streaming/i
  );
});
