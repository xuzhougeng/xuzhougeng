# ClashMate Rule Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `tools/clashmate/` into the main Mihomo rule adapter with built-in dual-hop AI routing for `OpenAI` and `Anthropic`, while keeping `tools/dialer-proxy/` functional as a standalone transitional tool.

**Architecture:** Extract pure Mihomo helpers into browser-safe ES modules under `tools/shared/mihomo/`, then make both `ClashMate` and `dialer-proxy` import those modules through `type="module"` entrypoints. Keep YAML serialization in the browser via the existing `js-yaml` CDN, but move parsing, rule-pack construction, validation, config building, and summary generation into testable functions that run under `node --test`.

**Tech Stack:** Static HTML, vanilla JavaScript ES modules, CSS, browser `js-yaml`, Node built-in test runner (`node --test`)

---

## File Map

### Create

- `tools/shared/mihomo/provider-catalog.mjs`
- `tools/shared/mihomo/ai-rule-packs.mjs`
- `tools/shared/mihomo/relay-parser.mjs`
- `tools/shared/mihomo/clashmate-state.mjs`
- `tools/shared/mihomo/clashmate-builder.mjs`
- `tools/shared/mihomo/dialer-proxy-builder.mjs`
- `tests/tools/shared/mihomo/ai-rule-packs.test.mjs`
- `tests/tools/shared/mihomo/relay-parser.test.mjs`
- `tests/tools/shared/mihomo/clashmate-state.test.mjs`
- `tests/tools/shared/mihomo/clashmate-builder.test.mjs`
- `tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs`

### Modify

- `tools/clashmate/index.html`
- `tools/clashmate/style.css`
- `tools/clashmate/app.js`
- `tools/dialer-proxy/index.html`
- `tools/dialer-proxy/app.js`

### Responsibilities

- `provider-catalog.mjs`: existing remote provider groups and URLs used by `ClashMate`
- `ai-rule-packs.mjs`: built-in `Core AI Relay` and `Extended AI Relay` inline rule packs plus rendering helpers
- `relay-parser.mjs`: relay YAML snippet parsing and target proxy normalization helpers
- `clashmate-state.mjs`: default state, reserved groups, and rule target option helpers for the upgraded `ClashMate` UI
- `clashmate-builder.mjs`: validation, summary generation, and final Mihomo config object builder
- `dialer-proxy-builder.mjs`: standalone dual-hop config object builder reused by `dialer-proxy`

## Task 1: Extract Shared AI Rule Packs And Relay Parsing

**Files:**
- Create: `tools/shared/mihomo/provider-catalog.mjs`
- Create: `tools/shared/mihomo/ai-rule-packs.mjs`
- Create: `tools/shared/mihomo/relay-parser.mjs`
- Test: `tests/tools/shared/mihomo/ai-rule-packs.test.mjs`
- Test: `tests/tools/shared/mihomo/relay-parser.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/tools/shared/mihomo/ai-rule-packs.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_RULE_PACKS,
  renderRulePackLines
} from "../../../../tools/shared/mihomo/ai-rule-packs.mjs";

test("core ai relay pack defaults to AI-Relay and covers OpenAI plus Anthropic", () => {
  const core = BUILT_IN_RULE_PACKS.coreAiRelay;

  assert.equal(core.defaultEnabled, true);
  assert.equal(core.defaultTarget, "AI-Relay");
  assert.deepEqual(
    core.rules.slice(0, 8),
    [
      "DOMAIN-SUFFIX,openai.com,{target}",
      "DOMAIN-SUFFIX,chatgpt.com,{target}",
      "DOMAIN-SUFFIX,oaistatic.com,{target}",
      "DOMAIN-SUFFIX,oaiusercontent.com,{target}",
      "DOMAIN,chat.openai.com.cdn.cloudflare.net,{target}",
      "DOMAIN,openaiapi-site.azureedge.net,{target}",
      "DOMAIN-SUFFIX,anthropic.com,{target}",
      "DOMAIN-SUFFIX,claude.ai,{target}"
    ]
  );
});

test("renderRulePackLines replaces target placeholder without mutating rule order", () => {
  const lines = renderRulePackLines(BUILT_IN_RULE_PACKS.coreAiRelay, "AI-Relay");
  assert.equal(lines[0], "DOMAIN-SUFFIX,openai.com,AI-Relay");
  assert.equal(lines.at(-1), "DOMAIN-SUFFIX,claudeusercontent.com,AI-Relay");
});
```

```js
// tests/tools/shared/mihomo/relay-parser.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseYamlProxies,
  buildTargetProxyNode
} from "../../../../tools/shared/mihomo/relay-parser.mjs";

test("parseYamlProxies extracts relay names, metadata, and raw blocks", () => {
  const yaml = `
proxies:
  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443
    cipher: aes-256-gcm
    password: demo-1
  - name: relay-hk-02
    type: vmess
    server: relay2.example.com
    port: 8443
    uuid: 11111111-1111-1111-1111-111111111111
`;

  const proxies = parseYamlProxies(yaml);

  assert.equal(proxies.length, 2);
  assert.equal(proxies[0].name, "relay-hk-01");
  assert.equal(proxies[1].server, "relay2.example.com");
  assert.match(proxies[0].raw, /cipher: aes-256-gcm/);
});

test("buildTargetProxyNode attaches dialer-proxy and trims optional credentials", () => {
  const node = buildTargetProxyNode({
    name: "ai-target-01",
    type: "socks5",
    server: "target.example.com",
    port: "1080",
    username: "demo",
    password: "secret",
    dialerProxy: "Relay-Group"
  });

  assert.deepEqual(node, {
    name: "ai-target-01",
    type: "socks5",
    server: "target.example.com",
    port: 1080,
    username: "demo",
    password: "secret",
    udp: true,
    "dialer-proxy": "Relay-Group"
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --test tests/tools/shared/mihomo/ai-rule-packs.test.mjs
node --test tests/tools/shared/mihomo/relay-parser.test.mjs
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Write the minimal shared modules**

Before writing the module files, move the full current `RULES_DEF` and `PROVIDER_URLS` catalogs out of `tools/clashmate/app.js` without deleting any existing provider entries. The code block below shows the new export shape; the implementation must preserve the full current catalog, not the reduced example set.

```js
// tools/shared/mihomo/provider-catalog.mjs
export const PROVIDER_RULES = {
  "过滤": [
    { name: "AdBlock", defaultAction: "REJECT" },
    { name: "HTTPDNS", defaultAction: "REJECT" }
  ],
  "国际流媒体": [
    { name: "Netflix", defaultAction: "Proxy" },
    { name: "YouTube", defaultAction: "Proxy" },
    { name: "Spotify", defaultAction: "Proxy" }
  ],
  "服务": [
    { name: "AI Suite", defaultAction: "Proxy" },
    { name: "Microsoft", defaultAction: "Proxy" },
    { name: "Scholar", defaultAction: "Proxy" }
  ],
  "通用": [
    { name: "Special", defaultAction: "DIRECT" },
    { name: "PROXY", defaultAction: "Proxy" },
    { name: "Domestic", defaultAction: "DIRECT" },
    { name: "Domestic IPs", defaultAction: "DIRECT" },
    { name: "LAN", defaultAction: "DIRECT" }
  ]
};

export const PROVIDER_URLS = {
  AdBlock: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/AdBlock.yaml",
  HTTPDNS: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/HTTPDNS.yaml",
  Special: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Special.yaml",
  PROXY: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Proxy.yaml",
  Domestic: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Domestic.yaml",
  "Domestic IPs": "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Domestic%20IPs.yaml",
  LAN: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/LAN.yaml",
  Netflix: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Netflix.yaml",
  YouTube: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/YouTube.yaml",
  Spotify: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Spotify.yaml",
  "AI Suite": "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/AI%20Suite.yaml",
  Microsoft: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Microsoft.yaml",
  Scholar: "https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Scholar.yaml"
};
```

```js
// tools/shared/mihomo/ai-rule-packs.mjs
export const BUILT_IN_RULE_PACKS = {
  coreAiRelay: {
    id: "coreAiRelay",
    label: "Core AI Relay",
    defaultEnabled: true,
    defaultTarget: "AI-Relay",
    rules: [
      "DOMAIN-SUFFIX,openai.com,{target}",
      "DOMAIN-SUFFIX,chatgpt.com,{target}",
      "DOMAIN-SUFFIX,oaistatic.com,{target}",
      "DOMAIN-SUFFIX,oaiusercontent.com,{target}",
      "DOMAIN,chat.openai.com.cdn.cloudflare.net,{target}",
      "DOMAIN,openaiapi-site.azureedge.net,{target}",
      "DOMAIN-SUFFIX,anthropic.com,{target}",
      "DOMAIN-SUFFIX,claude.ai,{target}",
      "DOMAIN-SUFFIX,claude.com,{target}",
      "DOMAIN-SUFFIX,claudeusercontent.com,{target}"
    ]
  },
  extendedAiRelay: {
    id: "extendedAiRelay",
    label: "Extended AI Relay",
    defaultEnabled: false,
    defaultTarget: "AI-Relay",
    rules: [
      "DOMAIN-SUFFIX,githubcopilot.com,{target}",
      "DOMAIN-SUFFIX,cursor.sh,{target}",
      "DOMAIN-SUFFIX,openrouter.ai,{target}",
      "DOMAIN-SUFFIX,perplexity.ai,{target}",
      "DOMAIN-SUFFIX,gemini.google.com,{target}",
      "DOMAIN-SUFFIX,generativelanguage.googleapis.com,{target}"
    ]
  }
};

export function renderRulePackLines(rulePack, target) {
  return rulePack.rules.map((line) => line.replace("{target}", target));
}
```

```js
// tools/shared/mihomo/relay-parser.mjs
export function parseYamlProxies(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const proxies = [];
  let currentProxy = null;
  let inProxiesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      if (currentProxy) currentProxy.raw += `${line}\n`;
      continue;
    }

    if (trimmed === "proxies:") {
      inProxiesSection = true;
      continue;
    }

    if (trimmed.startsWith("- name:") || trimmed.match(/^-\s*\{/)) {
      if (currentProxy?.name) proxies.push(currentProxy);
      currentProxy = { raw: `${line}\n` };
      const nameMatch = trimmed.match(/^-\s*name:\s*["']?([^"'\n]+)["']?/);
      if (nameMatch) currentProxy.name = nameMatch[1].trim();
      continue;
    }

    if (currentProxy) {
      currentProxy.raw += `${line}\n`;
      if (trimmed.startsWith("type:")) currentProxy.type = trimmed.replace(/^type:\s*/, "").replace(/^["']|["']$/g, "");
      if (trimmed.startsWith("server:")) currentProxy.server = trimmed.replace(/^server:\s*/, "").replace(/^["']|["']$/g, "");
      if (trimmed.startsWith("port:")) currentProxy.port = trimmed.replace(/^port:\s*/, "");
      continue;
    }

    if (inProxiesSection && (trimmed.startsWith("-") || /^\s{2,}-/.test(line))) {
      if (currentProxy?.name) proxies.push(currentProxy);
      currentProxy = { raw: `${line}\n` };
    }
  }

  if (currentProxy?.name) proxies.push(currentProxy);
  return proxies;
}

export function buildTargetProxyNode(input) {
  const node = {
    name: input.name.trim(),
    type: input.type,
    server: input.server.trim(),
    port: Number(input.port)
  };

  if (input.username?.trim()) node.username = input.username.trim();
  if (input.password?.trim()) node.password = input.password.trim();
  if (input.type === "socks5" || input.type === "trojan") node.udp = true;
  node["dialer-proxy"] = input.dialerProxy.trim();
  return node;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node --test tests/tools/shared/mihomo/ai-rule-packs.test.mjs
node --test tests/tools/shared/mihomo/relay-parser.test.mjs
```

Expected:

```text
# tests 4
# pass 4
```

- [ ] **Step 5: Commit**

```bash
git add tools/shared/mihomo/provider-catalog.mjs tools/shared/mihomo/ai-rule-packs.mjs tools/shared/mihomo/relay-parser.mjs tests/tools/shared/mihomo/ai-rule-packs.test.mjs tests/tools/shared/mihomo/relay-parser.test.mjs
git commit -m "feat: extract mihomo rule packs and relay parser"
```

## Task 2: Build ClashMate State, Validation, And Config Assembly

**Files:**
- Create: `tools/shared/mihomo/clashmate-state.mjs`
- Create: `tools/shared/mihomo/clashmate-builder.mjs`
- Test: `tests/tools/shared/mihomo/clashmate-state.test.mjs`
- Test: `tests/tools/shared/mihomo/clashmate-builder.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/tools/shared/mihomo/clashmate-state.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  createClashmateState,
  buildRuleTargetOptions
} from "../../../../tools/shared/mihomo/clashmate-state.mjs";

test("createClashmateState seeds reserved groups and default rule-pack selections", () => {
  const state = createClashmateState();

  assert.equal(state.relayGroup.name, "Relay-Group");
  assert.equal(state.aiRelayGroup.name, "AI-Relay");
  assert.equal(state.builtInRuleSelections.coreAiRelay.enabled, true);
  assert.equal(state.builtInRuleSelections.extendedAiRelay.enabled, false);
});

test("buildRuleTargetOptions exposes DIRECT, reserved groups, and user ordinary groups", () => {
  const options = buildRuleTargetOptions({
    ordinaryGroups: [{ name: "Auto" }, { name: "Proxy" }, { name: "Work" }],
    aiRelayGroup: { name: "AI-Relay" }
  });

  assert.deepEqual(options, ["DIRECT", "Auto", "Proxy", "Work", "AI-Relay"]);
});
```

```js
// tests/tools/shared/mihomo/clashmate-builder.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildClashmateConfig } from "../../../../tools/shared/mihomo/clashmate-builder.mjs";

test("buildClashmateConfig isolates upstream, relay, and target proxy pools", () => {
  const result = buildClashmateConfig({
    originalConfig: { dns: { enable: true } },
    baseConfig: { port: 7893, "socks-port": 7894, mode: "rule", "allow-lan": true, "log-level": "info", "external-controller": "127.0.0.1:9090" },
    upstreamProxies: [{ name: "JP-01", type: "ss", server: "jp.example.com", port: 443 }],
    relayProxies: [{ name: "relay-hk-01", type: "ss", server: "relay.example.com", port: 443 }],
    targetProxies: [{ name: "ai-target-01", type: "socks5", server: "target.example.com", port: 1080, udp: true, "dialer-proxy": "Relay-Group" }],
    ordinaryGroups: [
      { name: "Auto", type: "url-test", proxies: ["JP-01"] },
      { name: "Proxy", type: "select", proxies: ["JP-01"] }
    ],
    relayGroup: { name: "Relay-Group", type: "select", proxies: ["relay-hk-01"] },
    aiRelayGroup: { name: "AI-Relay", type: "select", proxies: ["ai-target-01"] },
    selectedProviders: [{ name: "Netflix", action: "Proxy" }],
    builtInRuleSelections: {
      coreAiRelay: { enabled: true, target: "AI-Relay" },
      extendedAiRelay: { enabled: false, target: "AI-Relay" }
    },
    customRules: ["PROCESS-NAME,Codex,AI-Relay"]
  });

  assert.equal(result.errors.length, 0);
  assert.deepEqual(
    result.config["proxy-groups"].map((group) => group.name),
    ["Auto", "Proxy", "Relay-Group", "AI-Relay"]
  );
  assert.deepEqual(
    result.config.rules.slice(0, 4),
    [
      "PROCESS-NAME,Codex,AI-Relay",
      "DOMAIN-SUFFIX,openai.com,AI-Relay",
      "DOMAIN-SUFFIX,chatgpt.com,AI-Relay",
      "DOMAIN-SUFFIX,oaistatic.com,AI-Relay"
    ]
  );
  assert.equal(result.summary[0], "Upstream Proxies: 1");
});

test("buildClashmateConfig blocks AI relay output when relay chain is incomplete", () => {
  const result = buildClashmateConfig({
    originalConfig: {},
    baseConfig: { port: 7893, "socks-port": 7894, mode: "rule", "allow-lan": true, "log-level": "info", "external-controller": "127.0.0.1:9090" },
    upstreamProxies: [{ name: "JP-01", type: "ss", server: "jp.example.com", port: 443 }],
    relayProxies: [],
    targetProxies: [{ name: "ai-target-01", type: "socks5", server: "target.example.com", port: 1080, udp: true, "dialer-proxy": "Relay-Group" }],
    ordinaryGroups: [
      { name: "Auto", type: "url-test", proxies: ["JP-01"] },
      { name: "Proxy", type: "select", proxies: ["JP-01"] }
    ],
    relayGroup: { name: "Relay-Group", type: "select", proxies: [] },
    aiRelayGroup: { name: "AI-Relay", type: "select", proxies: ["ai-target-01"] },
    selectedProviders: [],
    builtInRuleSelections: {
      coreAiRelay: { enabled: true, target: "AI-Relay" },
      extendedAiRelay: { enabled: false, target: "AI-Relay" }
    },
    customRules: []
  });

  assert.equal(result.config, null);
  assert.match(result.errors.join("\n"), /Relay-Group requires at least one relay proxy/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --test tests/tools/shared/mihomo/clashmate-state.test.mjs
node --test tests/tools/shared/mihomo/clashmate-builder.test.mjs
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Write the minimal state and builder modules**

```js
// tools/shared/mihomo/clashmate-state.mjs
export function createClashmateState() {
  return {
    originalConfig: null,
    upstreamProxies: [],
    relayProxies: [],
    targetProxies: [],
    ordinaryGroups: [
      { name: "Auto", type: "url-test", proxies: [] },
      { name: "Proxy", type: "select", proxies: [] }
    ],
    relayGroup: { name: "Relay-Group", type: "select", proxies: [] },
    aiRelayGroup: { name: "AI-Relay", type: "select", proxies: [] },
    builtInRuleSelections: {
      coreAiRelay: { enabled: true, target: "AI-Relay" },
      extendedAiRelay: { enabled: false, target: "AI-Relay" }
    },
    selectedProviders: [],
    customRules: []
  };
}

export function buildRuleTargetOptions({ ordinaryGroups, aiRelayGroup }) {
  const options = ["DIRECT"];
  for (const group of ordinaryGroups) {
    if (group.name && !options.includes(group.name)) options.push(group.name);
  }
  if (aiRelayGroup?.name && !options.includes(aiRelayGroup.name)) options.push(aiRelayGroup.name);
  return options;
}
```

```js
// tools/shared/mihomo/clashmate-builder.mjs
import { BUILT_IN_RULE_PACKS, renderRulePackLines } from "./ai-rule-packs.mjs";
import { PROVIDER_URLS } from "./provider-catalog.mjs";

function buildRuleProviders(selectedProviders) {
  const providers = {};
  for (const rule of selectedProviders) {
    if (!PROVIDER_URLS[rule.name]) continue;
    providers[rule.name] = {
      type: "http",
      behavior: "classical",
      url: PROVIDER_URLS[rule.name],
      path: `./Rules/${rule.name.replace(/\s+/g, "_")}`,
      interval: 86400
    };
  }
  return providers;
}

function validateInput(input) {
  const errors = [];
  const nameMap = new Map();
  const allPools = [...input.upstreamProxies, ...input.relayProxies, ...input.targetProxies];

  for (const proxy of allPools) {
    if (!proxy.name) errors.push("All proxies must have a name");
    if (!proxy.server) errors.push(`${proxy.name || "Unnamed proxy"} is missing server`);
    if (!proxy.port) errors.push(`${proxy.name || "Unnamed proxy"} is missing port`);
    if (proxy.name) nameMap.set(proxy.name, (nameMap.get(proxy.name) || 0) + 1);
  }

  for (const [name, count] of nameMap.entries()) {
    if (count > 1) errors.push(`Duplicate proxy name: ${name}`);
  }

  const aiRelayEnabled = Object.values(input.builtInRuleSelections).some((item) => item.enabled && item.target === input.aiRelayGroup.name);
  if (aiRelayEnabled && input.relayGroup.proxies.length === 0) errors.push(`${input.relayGroup.name} requires at least one relay proxy`);
  if (aiRelayEnabled && input.aiRelayGroup.proxies.length === 0) errors.push(`${input.aiRelayGroup.name} requires at least one target proxy`);

  return errors;
}

export function buildClashmateConfig(input) {
  const errors = validateInput(input);
  if (errors.length) return { config: null, summary: [], errors };

  const proxies = [...input.upstreamProxies, ...input.relayProxies, ...input.targetProxies];
  const proxyGroups = [
    ...input.ordinaryGroups.map((group) => ({
      ...group,
      ...(group.type === "url-test" || group.type === "fallback"
        ? { url: "http://www.gstatic.com/generate_204", interval: 300 }
        : {})
    })),
    input.relayGroup,
    input.aiRelayGroup
  ];
  const ruleProviders = buildRuleProviders(input.selectedProviders);
  const builtInRules = Object.entries(input.builtInRuleSelections)
    .filter(([, value]) => value.enabled)
    .flatMap(([key, value]) => renderRulePackLines(BUILT_IN_RULE_PACKS[key], value.target));
  const providerRules = input.selectedProviders
    .filter((rule) => PROVIDER_URLS[rule.name])
    .map((rule) => `RULE-SET,${rule.name},${rule.action}`);
  const rules = [
    ...input.customRules,
    ...builtInRules,
    ...providerRules,
    "GEOIP,CN,DIRECT",
    "MATCH,Auto"
  ];

  const config = {
    ...input.originalConfig,
    ...input.baseConfig,
    proxies,
    "proxy-groups": proxyGroups,
    "rule-providers": ruleProviders,
    rules
  };

  const summary = [
    `Upstream Proxies: ${input.upstreamProxies.length}`,
    `Relay Proxies: ${input.relayProxies.length}`,
    `Target Proxies: ${input.targetProxies.length}`,
    `Core AI Relay -> ${input.builtInRuleSelections.coreAiRelay.enabled ? input.builtInRuleSelections.coreAiRelay.target : "disabled"}`,
    `Extended AI Relay -> ${input.builtInRuleSelections.extendedAiRelay.enabled ? input.builtInRuleSelections.extendedAiRelay.target : "disabled"}`,
    "Default fallback -> Auto"
  ];

  return { config, summary, errors: [] };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node --test tests/tools/shared/mihomo/clashmate-state.test.mjs
node --test tests/tools/shared/mihomo/clashmate-builder.test.mjs
```

Expected:

```text
# tests 4
# pass 4
```

- [ ] **Step 5: Commit**

```bash
git add tools/shared/mihomo/clashmate-state.mjs tools/shared/mihomo/clashmate-builder.mjs tests/tools/shared/mihomo/clashmate-state.test.mjs tests/tools/shared/mihomo/clashmate-builder.test.mjs
git commit -m "feat: add clashmate dual-hop config builder"
```

## Task 3: Upgrade ClashMate UI To Use The Shared Mihomo Modules

**Files:**
- Modify: `tools/clashmate/index.html`
- Modify: `tools/clashmate/style.css`
- Modify: `tools/clashmate/app.js`

- [ ] **Step 1: Write the failing state-to-UI test**

```js
// append to tests/tools/shared/mihomo/clashmate-state.test.mjs
import { createTargetProxyDraft } from "../../../../tools/shared/mihomo/clashmate-state.mjs";

test("createTargetProxyDraft binds new targets to Relay-Group by default", () => {
  const draft = createTargetProxyDraft(2);

  assert.deepEqual(draft, {
    name: "AI-Target-2",
    type: "socks5",
    server: "",
    port: "",
    username: "",
    password: "",
    dialerProxy: "Relay-Group"
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/tools/shared/mihomo/clashmate-state.test.mjs
```

Expected:

```text
SyntaxError: The requested module ... does not provide an export named "createTargetProxyDraft"
```

- [ ] **Step 3: Implement the state helper and wire the ClashMate page**

```js
// append to tools/shared/mihomo/clashmate-state.mjs
export function createTargetProxyDraft(index) {
  return {
    name: `AI-Target-${index}`,
    type: "socks5",
    server: "",
    port: "",
    username: "",
    password: "",
    dialerProxy: "Relay-Group"
  };
}
```

```html
<!-- tools/clashmate/index.html -->
<section class="card" id="relaySection" hidden>
  <div class="card-header">
    <span class="step">2</span>
    <h2>链路增强</h2>
    <button id="addTargetProxyBtn" class="btn-sm">+ 新建目标代理</button>
  </div>
  <div class="dual-hop-grid">
    <label>
      <span>中转组名称</span>
      <input id="relayGroupName" type="text" value="Relay-Group">
    </label>
    <label>
      <span>中转组类型</span>
      <select id="relayGroupType">
        <option value="select">select</option>
        <option value="fallback">fallback</option>
        <option value="url-test">url-test</option>
      </select>
    </label>
  </div>
  <label class="stack">
    <span>Relay YAML</span>
    <textarea id="relayInput" rows="8" placeholder="粘贴中转节点 YAML"></textarea>
  </label>
  <div class="header-actions" style="margin-top: 12px;">
    <button id="parseRelayBtn" class="btn-primary">解析中转节点</button>
    <button id="clearRelayBtn" class="btn-sm">清空中转节点</button>
  </div>
  <div id="relayStatus" class="status" hidden></div>
  <div id="relayList" class="proxy-list"></div>
  <div id="targetProxiesContainer"></div>
</section>

<section class="card" id="enhancedRulesSection" hidden>
  <div class="card-header">
    <span class="step">4</span>
    <h2>增强规则</h2>
  </div>
  <div id="rulePacksContainer"></div>
  <label class="stack">
    <span>自定义规则</span>
    <textarea id="customRulesInput" rows="6" placeholder="PROCESS-NAME,Codex,AI-Relay"></textarea>
  </label>
</section>

<div id="summaryOutput" class="summary-list" hidden></div>
<div id="errorOutput" class="status error" hidden></div>

<script type="module" src="app.js"></script>
```

```css
/* tools/clashmate/style.css */
.dual-hop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.target-proxy-item,
.rule-pack-item,
.summary-list {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  padding: 12px;
  margin-top: 12px;
}

.summary-list {
  display: grid;
  gap: 8px;
  font-family: var(--mono);
}
```

```js
// tools/clashmate/app.js
import { PROVIDER_RULES } from "../shared/mihomo/provider-catalog.mjs";
import { BUILT_IN_RULE_PACKS } from "../shared/mihomo/ai-rule-packs.mjs";
import { parseYamlProxies, buildTargetProxyNode } from "../shared/mihomo/relay-parser.mjs";
import {
  createClashmateState,
  buildRuleTargetOptions,
  createTargetProxyDraft
} from "../shared/mihomo/clashmate-state.mjs";
import { buildClashmateConfig } from "../shared/mihomo/clashmate-builder.mjs";

const state = createClashmateState();
const $ = (id) => document.getElementById(id);

function renderRelayList() {
  $("relayList").innerHTML = state.relayProxies.map((proxy) => `<span class="proxy-tag">${proxy.name}</span>`).join("");
}

function renderTargetProxies() {
  $("targetProxiesContainer").innerHTML = state.targetProxies.map((proxy, index) => `
    <div class="target-proxy-item" data-index="${index}">
      <strong>${proxy.name}</strong>
      <div class="base-config-grid">
        <label><span>Server</span><input data-field="server" value="${proxy.server}"></label>
        <label><span>Port</span><input data-field="port" value="${proxy.port}"></label>
        <label><span>Username</span><input data-field="username" value="${proxy.username || ""}"></label>
        <label><span>Password</span><input data-field="password" value="${proxy.password || ""}"></label>
      </div>
    </div>
  `).join("");
}

function renderRulePacks() {
  const options = buildRuleTargetOptions({
    ordinaryGroups: state.ordinaryGroups,
    aiRelayGroup: state.aiRelayGroup
  });
  $("rulePacksContainer").innerHTML = Object.values(BUILT_IN_RULE_PACKS).map((pack) => `
    <div class="rule-pack-item">
      <label>
        <input type="checkbox" data-pack="${pack.id}" ${state.builtInRuleSelections[pack.id].enabled ? "checked" : ""}>
        ${pack.label}
      </label>
      <select data-pack-target="${pack.id}">
        ${options.map((target) => `<option value="${target}" ${target === state.builtInRuleSelections[pack.id].target ? "selected" : ""}>${target}</option>`).join("")}
      </select>
    </div>
  `).join("");
}

function renderSummary(summary) {
  $("summaryOutput").hidden = false;
  $("summaryOutput").innerHTML = summary.map((line) => `<div>${line}</div>`).join("");
}

$("addTargetProxyBtn").addEventListener("click", () => {
  state.targetProxies.push(createTargetProxyDraft(state.targetProxies.length + 1));
  renderTargetProxies();
});

$("parseRelayBtn").addEventListener("click", () => {
  state.relayProxies = parseYamlProxies($("relayInput").value);
  state.relayGroup.proxies = state.relayProxies.map((proxy) => proxy.name);
  renderRelayList();
});

$("generateBtn").addEventListener("click", () => {
  state.customRules = $("customRulesInput").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const result = buildClashmateConfig({
    originalConfig: state.originalConfig || {},
    baseConfig: {
      port: Number($("cfgPort").value),
      "socks-port": Number($("cfgSocksPort").value),
      "allow-lan": $("cfgAllowLan").value === "true",
      mode: $("cfgMode").value,
      "log-level": $("cfgLogLevel").value,
      "external-controller": $("cfgController").value
    },
    upstreamProxies: state.upstreamProxies,
    relayProxies: state.relayProxies,
    targetProxies: state.targetProxies.map((proxy) => buildTargetProxyNode(proxy)),
    ordinaryGroups: state.ordinaryGroups,
    relayGroup: state.relayGroup,
    aiRelayGroup: state.aiRelayGroup,
    selectedProviders: state.selectedProviders,
    builtInRuleSelections: state.builtInRuleSelections,
    customRules: state.customRules
  });

  if (result.errors.length) {
    $("errorOutput").hidden = false;
    $("errorOutput").textContent = result.errors.join(" | ");
    return;
  }

  $("errorOutput").hidden = true;
  $("yamlOutput").textContent = jsyaml.dump(result.config, { lineWidth: -1 });
  $("yamlOutput").hidden = false;
  renderSummary(result.summary);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/tools/shared/mihomo/clashmate-state.test.mjs
```

Expected:

```text
# tests 3
# pass 3
```

- [ ] **Step 5: Commit**

```bash
git add tools/clashmate/index.html tools/clashmate/style.css tools/clashmate/app.js tools/shared/mihomo/clashmate-state.mjs
git commit -m "feat: upgrade clashmate ui for dual-hop routing"
```

## Task 4: Rebuild Dialer-Proxy On Top Of Shared Mihomo Modules

**Files:**
- Create: `tools/shared/mihomo/dialer-proxy-builder.mjs`
- Modify: `tools/dialer-proxy/index.html`
- Modify: `tools/dialer-proxy/app.js`
- Test: `tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildDialerProxyConfig } from "../../../../tools/shared/mihomo/dialer-proxy-builder.mjs";

test("buildDialerProxyConfig reuses shared AI relay rules and target proxy modeling", () => {
  const result = buildDialerProxyConfig({
    relayProxies: [
      {
        name: "relay-hk-01",
        type: "ss",
        server: "relay.example.com",
        port: 443,
        raw: `  - name: relay-hk-01\n    type: ss\n    server: relay.example.com\n    port: 443\n`
      }
    ],
    targetProxy: {
      name: "target-socks5",
      type: "socks5",
      server: "target.example.com",
      port: "1080",
      username: "",
      password: "",
      dialerProxy: "relay-group"
    }
  });

  assert.equal(result.proxies.at(-1)["dialer-proxy"], "relay-group");
  assert.equal(result["proxy-groups"][0].name, "relay-group");
  assert.equal(result.rules[0], "DOMAIN-SUFFIX,openai.com,target-socks5");
  assert.match(result.rules.join("\n"), /anthropic\.com/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement the builder and switch `dialer-proxy` to module imports**

```js
// tools/shared/mihomo/dialer-proxy-builder.mjs
import { BUILT_IN_RULE_PACKS, renderRulePackLines } from "./ai-rule-packs.mjs";
import { buildTargetProxyNode } from "./relay-parser.mjs";

export function buildDialerProxyConfig({ relayProxies, targetProxy }) {
  const targetNode = buildTargetProxyNode(targetProxy);
  const relayNames = relayProxies.map((proxy) => proxy.name);
  const proxies = [
    ...relayProxies.map(({ raw, ...proxy }) => proxy),
    targetNode
  ];

  return {
    port: 1990,
    "socks-port": 1991,
    "allow-lan": true,
    mode: "rule",
    "log-level": "info",
    "external-controller": "127.0.0.1:1993",
    proxies,
    "proxy-groups": [
      { name: targetProxy.dialerProxy, type: "select", proxies: relayNames },
      { name: "Proxy", type: "select", proxies: [...relayNames, targetProxy.name] }
    ],
    rules: [
      ...renderRulePackLines(BUILT_IN_RULE_PACKS.coreAiRelay, targetProxy.name),
      ...renderRulePackLines(BUILT_IN_RULE_PACKS.extendedAiRelay, targetProxy.name),
      "MATCH,DIRECT"
    ]
  };
}
```

```html
<!-- tools/dialer-proxy/index.html -->
<script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>
<script type="module" src="app.js"></script>
```

```js
// tools/dialer-proxy/app.js
import { parseYamlProxies } from "../shared/mihomo/relay-parser.mjs";
import { buildDialerProxyConfig } from "../shared/mihomo/dialer-proxy-builder.mjs";

function handleGenerateYaml() {
  updateTargetFromInputs();
  const config = buildDialerProxyConfig({
    relayProxies: state.relayProxies,
    targetProxy: state.targetProxy
  });

  refs.yamlOutput.value = window.jsyaml
    ? window.jsyaml.dump(config, { lineWidth: -1 })
    : JSON.stringify(config, null, 2);
}

refs.parseRelayBtn.addEventListener("click", () => {
  state.relayProxies = parseYamlProxies(refs.relayInput.value);
  renderRelayProxies();
});

refs.generateYamlBtn.addEventListener("click", handleGenerateYaml);
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --test tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs
```

Expected:

```text
# tests 1
# pass 1
```

- [ ] **Step 5: Commit**

```bash
git add tools/shared/mihomo/dialer-proxy-builder.mjs tools/dialer-proxy/index.html tools/dialer-proxy/app.js tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs
git commit -m "refactor: share dialer proxy builder with clashmate"
```

## Task 5: Run The Full Test Pass And Manual Smoke Verification

**Files:**
- Modify: `tools/clashmate/app.js`
- Modify: `tools/dialer-proxy/app.js`
- Test: `tests/tools/shared/mihomo/ai-rule-packs.test.mjs`
- Test: `tests/tools/shared/mihomo/relay-parser.test.mjs`
- Test: `tests/tools/shared/mihomo/clashmate-state.test.mjs`
- Test: `tests/tools/shared/mihomo/clashmate-builder.test.mjs`
- Test: `tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs`

- [ ] **Step 1: Write the failing end-to-end builder assertion**

```js
// append to tests/tools/shared/mihomo/clashmate-builder.test.mjs
test("buildClashmateConfig includes provider rules after custom and core relay rules", () => {
  const result = buildClashmateConfig({
    originalConfig: {},
    baseConfig: { port: 7893, "socks-port": 7894, mode: "rule", "allow-lan": true, "log-level": "info", "external-controller": "127.0.0.1:9090" },
    upstreamProxies: [{ name: "JP-01", type: "ss", server: "jp.example.com", port: 443 }],
    relayProxies: [{ name: "relay-hk-01", type: "ss", server: "relay.example.com", port: 443 }],
    targetProxies: [{ name: "ai-target-01", type: "socks5", server: "target.example.com", port: 1080, udp: true, "dialer-proxy": "Relay-Group" }],
    ordinaryGroups: [
      { name: "Auto", type: "url-test", proxies: ["JP-01"] },
      { name: "Proxy", type: "select", proxies: ["JP-01"] }
    ],
    relayGroup: { name: "Relay-Group", type: "select", proxies: ["relay-hk-01"] },
    aiRelayGroup: { name: "AI-Relay", type: "select", proxies: ["ai-target-01"] },
    selectedProviders: [{ name: "Netflix", action: "Proxy" }],
    builtInRuleSelections: {
      coreAiRelay: { enabled: true, target: "AI-Relay" },
      extendedAiRelay: { enabled: false, target: "AI-Relay" }
    },
    customRules: ["PROCESS-NAME,ChatGPT,AI-Relay"]
  });

  const netflixRuleIndex = result.config.rules.indexOf("RULE-SET,Netflix,Proxy");
  const customRuleIndex = result.config.rules.indexOf("PROCESS-NAME,ChatGPT,AI-Relay");
  const openAiRuleIndex = result.config.rules.indexOf("DOMAIN-SUFFIX,openai.com,AI-Relay");

  assert.ok(customRuleIndex > -1);
  assert.ok(openAiRuleIndex > customRuleIndex);
  assert.ok(netflixRuleIndex > openAiRuleIndex);
});
```

- [ ] **Step 2: Run the full test suite to verify it fails**

Run:

```bash
node --test tests/tools/shared/mihomo/ai-rule-packs.test.mjs tests/tools/shared/mihomo/relay-parser.test.mjs tests/tools/shared/mihomo/clashmate-state.test.mjs tests/tools/shared/mihomo/clashmate-builder.test.mjs tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs
```

Expected:

```text
AssertionError
```

- [ ] **Step 3: Fix rule ordering and finish any app wiring gaps**

```js
// finalize in tools/shared/mihomo/clashmate-builder.mjs
const builtInRules = Object.entries(input.builtInRuleSelections)
  .filter(([, value]) => value.enabled)
  .flatMap(([key, value]) => renderRulePackLines(BUILT_IN_RULE_PACKS[key], value.target));

const providerRules = input.selectedProviders
  .filter((rule) => PROVIDER_URLS[rule.name])
  .map((rule) => `RULE-SET,${rule.name},${rule.action}`);

const rules = [
  ...input.customRules,
  ...builtInRules,
  ...providerRules,
  "GEOIP,CN,DIRECT",
  "MATCH,Auto"
];
```

```js
// finalize in tools/clashmate/app.js
document.querySelectorAll("[data-pack]").forEach((checkbox) => {
  checkbox.addEventListener("change", (event) => {
    const key = event.target.dataset.pack;
    state.builtInRuleSelections[key].enabled = event.target.checked;
  });
});

document.querySelectorAll("[data-pack-target]").forEach((select) => {
  select.addEventListener("change", (event) => {
    const key = event.target.dataset.packTarget;
    state.builtInRuleSelections[key].target = event.target.value;
  });
});
```

- [ ] **Step 4: Run the full test suite and manual browser smoke check**

Run:

```bash
node --test tests/tools/shared/mihomo/ai-rule-packs.test.mjs tests/tools/shared/mihomo/relay-parser.test.mjs tests/tools/shared/mihomo/clashmate-state.test.mjs tests/tools/shared/mihomo/clashmate-builder.test.mjs tests/tools/shared/mihomo/dialer-proxy-builder.test.mjs
```

Expected:

```text
# tests 9
# pass 9
```

Manual smoke checklist:

```text
1. Open tools/clashmate/index.html in a browser.
2. Import a config with at least one upstream proxy.
3. Paste one relay proxy YAML block and parse it.
4. Add one target proxy named AI-Target-1.
5. Leave Core AI Relay enabled and Extended AI Relay disabled.
6. Add PROCESS-NAME,Codex,AI-Relay to custom rules.
7. Generate YAML and confirm the summary shows Core AI Relay -> AI-Relay.
8. Confirm rules contain OpenAI and Anthropic domains before RULE-SET lines.
9. Open tools/dialer-proxy/index.html and confirm it still generates a standalone YAML.
```

- [ ] **Step 5: Commit**

```bash
git add tools/clashmate/app.js tools/dialer-proxy/app.js tools/shared/mihomo/clashmate-builder.mjs tests/tools/shared/mihomo/clashmate-builder.test.mjs
git commit -m "test: verify clashmate dual-hop routing flow"
```

## Self-Review Checklist

1. Spec coverage:
   - Dual-hop relay structure is implemented by Tasks 1, 2, and 3.
   - `OpenAI` and `Anthropic` core routing is locked by Task 1 and verified again in Task 5.
   - Reserved groups and proxy-pool isolation are covered by Task 2.
   - Keeping `dialer-proxy` functional is covered by Task 4.
   - Validation and summary output are covered by Tasks 2 and 3.
2. Placeholder scan:
   - No `TODO`, `TBD`, or “implement later” markers remain.
   - Every command uses an exact file path.
   - Every code step names concrete exports and concrete UI ids.
3. Type consistency:
   - Shared state uses `relayGroup`, `aiRelayGroup`, `builtInRuleSelections`, and `customRules` consistently.
   - Shared builder uses `coreAiRelay` and `extendedAiRelay` consistently across tests and code.

## Notes For Execution

1. Keep the initial `Core AI Relay` rule pack tight. Do not expand it beyond `OpenAI` and `Anthropic` supporting domains during this implementation pass.
2. Preserve unrelated imported Mihomo config keys from `originalConfig` unless the edited base settings explicitly override them.
3. Do not silently mix relay proxies or target proxies into ordinary upstream groups.
4. If `ClashMate` UI changes become too large for one pass, finish Task 2 first and land the shared builder before broad UI edits.
