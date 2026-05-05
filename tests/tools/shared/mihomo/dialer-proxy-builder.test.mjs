import test from "node:test";
import assert from "node:assert/strict";

import { buildDialerProxyConfig } from "../../../../tools/shared/mihomo/dialer-proxy-builder.mjs";

test("buildDialerProxyConfig emits target dialer-proxy, relay group, and shared AI relay rules", () => {
  const { config, summary } = buildDialerProxyConfig({
    relayProxies: [
      {
        name: "relay-hk-01",
        type: "ss",
        server: "relay1.example.com",
        port: "443",
        "plugin-opts": {
          host: "cdn.example.com",
          mode: "websocket",
          path: "/ss",
        },
        raw: `  - name: "relay-hk-01"
    type: ss
    server: relay1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password1"
`,
      },
      {
        name: "relay-us-02",
        type: "vmess",
        server: "relay2.example.com",
        port: "8443",
        uuid: "abcdef12-3456-7890-abcd-ef1234567890",
        "ws-opts": {
          path: "/relay",
          headers: {
            Host: "edge.example.com",
          },
        },
        raw: `  - name: relay-us-02
    type: vmess
    server: relay2.example.com
    port: 8443
    uuid: abcdef12-3456-7890-abcd-ef1234567890
    alterId: 0
    cipher: auto
`,
      },
    ],
    targetProxy: {
      name: "target-socks5",
      type: "socks5",
      server: "target.example.com",
      port: "1080",
      username: "  ",
      password: "",
      "dialer-proxy": "relay-group",
    },
  });

  assert.deepEqual(
    config.proxies.map(proxy => proxy.name),
    ["relay-hk-01", "relay-us-02", "target-socks5"]
  );
  assert.deepEqual(config.proxies[0], {
    name: "relay-hk-01",
    type: "ss",
    server: "relay1.example.com",
    port: "443",
    "plugin-opts": {
      host: "cdn.example.com",
      mode: "websocket",
      path: "/ss",
    },
  });
  assert.equal("raw" in config.proxies[0], false);
  assert.equal("cipher" in config.proxies[0], false);
  assert.equal("password" in config.proxies[0], false);
  assert.deepEqual(config.proxies[1], {
    name: "relay-us-02",
    type: "vmess",
    server: "relay2.example.com",
    port: "8443",
    uuid: "abcdef12-3456-7890-abcd-ef1234567890",
    "ws-opts": {
      path: "/relay",
      headers: {
        Host: "edge.example.com",
      },
    },
  });
  assert.equal("raw" in config.proxies[1], false);
  assert.equal("alterId" in config.proxies[1], false);
  assert.equal("cipher" in config.proxies[1], false);
  assert.deepEqual(config.proxies.at(-1), {
    name: "target-socks5",
    type: "socks5",
    server: "target.example.com",
    port: "1080",
    "dialer-proxy": "relay-group",
  });
  assert.deepEqual(config["proxy-groups"], [
    {
      name: "relay-group",
      type: "select",
      proxies: ["relay-hk-01", "relay-us-02"],
    },
    {
      name: "Proxy",
      type: "select",
      proxies: ["relay-hk-01", "relay-us-02", "target-socks5"],
    },
  ]);
  assert.ok(config.rules.includes("DOMAIN-SUFFIX,openai.com,target-socks5"));
  assert.ok(config.rules.includes("DOMAIN-SUFFIX,claude.ai,target-socks5"));
  assert.equal(config.rules.at(-1), "MATCH,DIRECT");
  assert.equal(
    config.rules.filter(rule => rule === "MATCH,DIRECT").length,
    1
  );
  assert.deepEqual(summary.enabledRulePacks, ["extendedAiRelay"]);
});

test("buildDialerProxyConfig rejects empty relay input", () => {
  assert.throws(
    () =>
      buildDialerProxyConfig({
        relayProxies: [],
        targetProxy: {
          name: "target-socks5",
          type: "socks5",
          server: "target.example.com",
          port: "1080",
          "dialer-proxy": "relay-group",
        },
      }),
    /at least one relay proxy/i
  );
});
