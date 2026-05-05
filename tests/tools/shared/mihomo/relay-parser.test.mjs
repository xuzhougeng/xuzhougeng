import test from "node:test";
import assert from "node:assert/strict";

import { buildTargetProxyNode, parseYamlProxies } from "../../../../tools/shared/mihomo/relay-parser.mjs";

test("parseYamlProxies extracts relay names, metadata, and raw blocks from YAML", () => {
  const yamlText = `proxies:
  - name: "relay-hk-01"
    type: ss
    server: relay1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password1"

  - name: relay-us-02
    type: vmess
    server: relay2.example.com
    port: 8443
    uuid: abc
`;

  const proxies = parseYamlProxies(yamlText);

  assert.deepEqual(
    proxies.map(proxy => ({
      name: proxy.name,
      type: proxy.type,
      server: proxy.server,
      port: proxy.port,
    })),
    [
      {
        name: "relay-hk-01",
        type: "ss",
        server: "relay1.example.com",
        port: "443",
      },
      {
        name: "relay-us-02",
        type: "vmess",
        server: "relay2.example.com",
        port: "8443",
      },
    ]
  );
  assert.equal(
    proxies[0].raw,
    `  - name: "relay-hk-01"
    type: ss
    server: relay1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password1"

`
  );
  assert.equal(
    proxies[1].raw,
    `  - name: relay-us-02
    type: vmess
    server: relay2.example.com
    port: 8443
    uuid: abc

`
  );
});

test("parseYamlProxies stops when leaving the proxies section in a full Mihomo config", () => {
  const yamlText = `port: 7890
proxies:
  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443

proxy-groups:
  - name: relay-group
    type: select
    proxies:
      - relay-hk-01
rules:
  - MATCH,DIRECT
`;

  const proxies = parseYamlProxies(yamlText);

  assert.deepEqual(proxies.map(proxy => proxy.name), ["relay-hk-01"]);
  assert.equal(
    proxies[0].raw,
    `  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443

`
  );
});

test("parseYamlProxies stops when the next top-level section uses inline YAML syntax", () => {
  const yamlText = `proxies:
  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443
proxy-groups: []
rules: [MATCH,DIRECT]
`;

  const proxies = parseYamlProxies(yamlText);

  assert.deepEqual(proxies.map(proxy => proxy.name), ["relay-hk-01"]);
  assert.equal(
    proxies[0].raw,
    `  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443
`
  );
});

test("parseYamlProxies stops when the next top-level key is a scalar assignment", () => {
  const yamlText = `proxies:
  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443
mode: rule
mixed-port: 7890
`;

  const proxies = parseYamlProxies(yamlText);

  assert.deepEqual(proxies.map(proxy => proxy.name), ["relay-hk-01"]);
  assert.equal(
    proxies[0].raw,
    `  - name: relay-hk-01
    type: ss
    server: relay1.example.com
    port: 443
`
  );
});

test("parseYamlProxies extracts fields from inline proxy entries", () => {
  const yamlText = `proxies:
  - { name: "relay-hk-01", type: ss, server: relay1.example.com, port: 443, password: "secret" }
  - { name: relay-us-02, type: vmess, server: relay2.example.com, port: 8443, uuid: abc }
`;

  const proxies = parseYamlProxies(yamlText);

  assert.deepEqual(
    proxies.map(proxy => ({
      name: proxy.name,
      type: proxy.type,
      server: proxy.server,
      port: proxy.port,
      raw: proxy.raw,
    })),
    [
      {
        name: "relay-hk-01",
        type: "ss",
        server: "relay1.example.com",
        port: "443",
        raw: `  - { name: "relay-hk-01", type: ss, server: relay1.example.com, port: 443, password: "secret" }
`,
      },
      {
        name: "relay-us-02",
        type: "vmess",
        server: "relay2.example.com",
        port: "8443",
        raw: `  - { name: relay-us-02, type: vmess, server: relay2.example.com, port: 8443, uuid: abc }

`,
      },
    ]
  );
});

test("buildTargetProxyNode attaches dialer-proxy and trims optional credentials", () => {
  assert.deepEqual(
    buildTargetProxyNode({
      name: " target-socks5 ",
      type: "socks5",
      server: " target.example.com ",
      port: "1080",
      username: " alice ",
      password: "   ",
      dialerProxy: " relay-group ",
    }),
    {
      name: "target-socks5",
      type: "socks5",
      server: "target.example.com",
      port: "1080",
      username: "alice",
      "dialer-proxy": "relay-group",
    }
  );
});
