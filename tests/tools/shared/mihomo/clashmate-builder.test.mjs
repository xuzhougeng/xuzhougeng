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

test("buildClashmateConfig assembles reserved groups, keeps pools isolated, and preserves unrelated config keys", () => {
  const result = buildClashmateConfig(createBaseState());
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
    ["Auto", "Proxy", "Relay-Group", "AI-Relay"]
  );

  const autoGroup = config["proxy-groups"].find(group => group.name === "Auto");
  const proxyGroup = config["proxy-groups"].find(group => group.name === "Proxy");
  const relayGroup = config["proxy-groups"].find(group => group.name === "Relay-Group");
  const aiRelayGroup = config["proxy-groups"].find(group => group.name === "AI-Relay");

  assert.deepEqual(autoGroup.proxies, ["upstream-hk", "upstream-jp"]);
  assert.deepEqual(proxyGroup.proxies, ["upstream-hk", "upstream-jp"]);
  assert.deepEqual(relayGroup.proxies, ["relay-a", "relay-b"]);
  assert.deepEqual(aiRelayGroup.proxies, ["target-us"]);

  assert.deepEqual(summary.proxyPools, {
    upstream: ["upstream-hk", "upstream-jp"],
    relay: ["relay-a", "relay-b"],
    target: ["target-us"],
  });
  assert.deepEqual(summary.groups, {
    ordinary: ["Auto", "Proxy"],
    relay: "Relay-Group",
    aiRelay: "AI-Relay",
  });
});

test("buildClashmateConfig orders rules as custom, built-in AI lines, provider lines, GEOIP, then MATCH", () => {
  const { config, summary } = buildClashmateConfig(createBaseState());
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

test("buildClashmateConfig fails when AI-Relay is enabled but Relay-Group has no relay members", () => {
  const state = createBaseState();
  state.relayProxies = [];

  assert.throws(
    () => buildClashmateConfig(state),
    /Relay-Group requires at least one relay proxy/i
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
        ordinaryGroups: ["Auto", "Proxy"],
        relayGroup: "Relay-Group",
        aiRelayGroup: "AI-Relay",
        selectedRulePacks: {
          coreAiRelay: false,
          extendedAiRelay: false,
        },
      }),
    /Auto and Proxy require at least one upstream proxy/i
  );
});
