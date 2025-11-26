const state = {
  base: {
    mixedPort: 7890,
    socksPort: 7891,
    mode: "Rule",
    logLevel: "info",
    allowLan: true,
    udp: true,
  },
  nodes: [],
};

const refs = {
  mixedPort: document.getElementById("mixedPort"),
  socksPort: document.getElementById("socksPort"),
  mode: document.getElementById("mode"),
  logLevel: document.getElementById("logLevel"),
  allowLan: document.getElementById("allowLan"),
  udp: document.getElementById("udp"),
  parseBtn: document.getElementById("parseBtn"),
  parseSummary: document.getElementById("parseSummary"),
  rawInput: document.getElementById("rawInput"),
  fileInput: document.getElementById("fileInput"),
  addNodeBtn: document.getElementById("addNodeBtn"),
  clearNodesBtn: document.getElementById("clearNodesBtn"),
  generateYamlBtn: document.getElementById("generateYamlBtn"),
  downloadYamlBtn: document.getElementById("downloadYamlBtn"),
  yamlOutput: document.getElementById("yamlOutput"),
  nodesContainer: document.getElementById("nodesContainer"),
  copyYamlBtn: document.getElementById("copyYamlBtn"),
  resetBaseBtn: document.getElementById("resetBaseBtn"),
  themeToggle: document.getElementById("themeToggle"),
  connectivityTestContainer: document.getElementById("connectivityTestContainer"),
};

const typeOptions = [
  { value: "trojan", label: "Trojan" },
  { value: "ss", label: "Shadowsocks" },
  { value: "socks5", label: "Socks5" },
  { value: "http", label: "HTTP" },
  { value: "hysteria2", label: "Hysteria2" },
];

const THEME_KEY = "clash-helper-theme";

function updateThemeToggleLabel(theme) {
  if (!refs.themeToggle) return;
  refs.themeToggle.textContent = theme === "light" ? "切换为暗色" : "切换为浅色";
}

function setTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (_) {
    // ignore storage failures
  }
  updateThemeToggleLabel(t);
}

function getPreferredTheme() {
  const stored = (() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (_) {
      return null;
    }
  })();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripEmoji(str = "") {
  return str.replace(
    /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F700}-\u{1F77F}\u{1F900}-\u{1F9FF}]/gu,
    ""
  );
}

function normalizeRegionName(str = "") {
  const replacements = [
    { re: /(香港|香\s*港)/gi, code: "HK" },
    { re: /(台湾|台\s*湾|tw)/gi, code: "TW" },
    { re: /(日本|东京|大阪|jp)/gi, code: "JP" },
    { re: /(新加坡|狮城|sg)/gi, code: "SG" },
    { re: /(美国|美\s*国|usa|us)/gi, code: "US" },
    { re: /(英国|英\s*国|uk)/gi, code: "UK" },
    { re: /(澳大利亚|澳洲|澳\s*洲|australia|au)/gi, code: "AU" },
    { re: /(加拿大|ca)/gi, code: "CA" },
    { re: /(德国|德\s*国|de)/gi, code: "DE" },
    { re: /(法国|法\s*国|fr)/gi, code: "FR" },
    { re: /(荷兰|nl)/gi, code: "NL" },
    { re: /(韩国|韩\s*国|kr)/gi, code: "KR" },
    { re: /(印度|in)/gi, code: "IN" },
  ];
  let out = str;
  replacements.forEach(({ re, code }) => {
    out = out.replace(re, code);
  });
  return out;
}

function extractInlineValue(line) {
  const colonIndex = line.search(/[:：]/);
  if (colonIndex !== -1) {
    return line.slice(colonIndex + 1).trim();
  }
  const parts = line.trim().split(/\s+/);
  if (parts.length > 1) {
    return parts.slice(1).join(" ").trim();
  }
  return "";
}

function normalizeName(name = "") {
  const noEmoji = stripEmoji(name);
  return normalizeRegionName(noEmoji).replace(/\s+/g, " ").trim();
}

function updateBaseFromInputs() {
  state.base.mixedPort = Number(refs.mixedPort.value) || 0;
  state.base.socksPort = Number(refs.socksPort.value) || 0;
  state.base.mode = refs.mode.value;
  state.base.logLevel = refs.logLevel.value;
  state.base.allowLan = refs.allowLan.value === "true";
  state.base.udp = state.base.udp = refs.udp.value === "true";
}

function resetBaseInputs() {
  refs.mixedPort.value = state.base.mixedPort;
  refs.socksPort.value = state.base.socksPort;
  refs.mode.value = state.base.mode;
  refs.logLevel.value = state.base.logLevel;
  refs.allowLan.value = state.base.allowLan ? "true" : "false";
  refs.udp.value = state.base.udp ? "true" : "false";
}

function newNode(name = "") {
  return {
    name: name || `节点 ${state.nodes.length + 1}`,
    type: "ss",
    server: "",
    port: "",
    method: "",
    username: "",
    password: "",
    sni: "",
    tls: false,
    skipCertVerify: false,
    obfs: "",
    obfsPassword: "",
    alpn: "",
    ports: "",
    "dialer-proxy": "",
  };
}

function renderConnectivityTestCommands() {
  if (!refs.connectivityTestContainer) return; // Ensure the element exists

  if (!state.nodes.length) {
    refs.connectivityTestContainer.innerHTML =
      '<p class="subtle">请解析或添加节点以生成测试命令。</p>';
    return;
  }

  const firstNode = state.nodes[0];
  const server = firstNode.server;
  const port = firstNode.port || firstNode.ports; // Use port or ports for Hysteria2

  if (!server || (!port && firstNode.type !== "hysteria2") || (firstNode.type === "hysteria2" && !port)) {
    refs.connectivityTestContainer.innerHTML =
      '<p class="subtle">无法为当前节点生成连通性测试命令，缺少服务器地址或端口。</p>';
    return;
  }

  const powershellCommand = `Test-NetConnection ${server} -Port ${port}`;
  const linuxMacCommand = `nc -vz ${server} ${port}`;

  refs.connectivityTestContainer.innerHTML = `
    <p class="subtle">以下是针对第一个节点的连通性测试命令：</p>
    <pre><code class="language-powershell"># PowerShell (Windows)
${powershellCommand}</code></pre>
    <pre><code class="language-bash"># nc (Linux/macOS)
${linuxMacCommand}</code></pre>
    <p class="tiny">请注意：这些命令仅测试基础网络连通性，不保证服务可用性。</p>
  `;
}


function renderNodes() {
  if (!state.nodes.length) {
    refs.nodesContainer.innerHTML =
      '<div class="hint">解析结果会显示在这里，也可以点击“新增空节点”手动填写。</div>';
    refs.parseSummary.textContent = "等待解析";
    renderConnectivityTestCommands(); // Call here too
    return;
  }

  const html = state.nodes
    .map((node, index) => {
      return `
        <div class="node-card" data-index="${index}">
          <div class="node-card__title">
            <strong>${escapeHtml(node.name)}</strong>
            <button class="btn btn-ghost tiny-btn" data-action="remove-node">删除</button>
          </div>
          <div class="node-grid">
            <label>名称
              <input name="name" value="${escapeHtml(node.name)}" placeholder="节点名称">
            </label>
            <label>类型
              <select name="type">
                ${typeOptions
                  .map(
                    (opt) =>
                      `<option value="${opt.value}" ${
                        opt.value === node.type ? "selected" : ""
                      }>${opt.label}</option>`
                  )
                  .join("")}
              </select>
            </label>
            <label>服务器
              <input name="server" value="${escapeHtml(node.server)}" placeholder="cn1.gmdns.net 或 IP">
            </label>
            <label>端口
              <input name="port" value="${escapeHtml(node.port)}" placeholder="443">
            </label>
            <label>用户名（Socks5 可选）
              <input name="username" value="${escapeHtml(node.username)}" placeholder="留空则不写入">
            </label>
            <label>密码 / 密钥
              <input name="password" value="${escapeHtml(node.password)}" placeholder="密码或 secret">
            </label>
            <label>加密算法（SS）
              <input name="method" value="${escapeHtml(node.method)}" placeholder="例如 2022-blake3-aes-256-gcm">
            </label>
            <label>SNI / Server Name（可选）
              <input name="sni" value="${escapeHtml(node.sni)}" placeholder="TLS 需要时填写">
            </label>
            <label>TLS
              <select name="tls">
                <option value="false" ${node.tls ? "" : "selected"}>false</option>
                <option value="true" ${node.tls ? "selected" : ""}>true</option>
              </select>
            </label>
            <label>skip-cert-verify
              <select name="skipCertVerify">
                <option value="false" ${node.skipCertVerify ? "" : "selected"}>false</option>
                <option value="true" ${node.skipCertVerify ? "selected" : ""}>true</option>
              </select>
            </label>
            <label>Hysteria2 端口/范围
              <input name="ports" value="${escapeHtml(node.ports)}" placeholder="65000-65442">
            </label>
            <label>ALPN 列表
              <input name="alpn" value="${escapeHtml(node.alpn)}" placeholder="h3, h3-29">
            </label>
            <label>Obfs
              <input name="obfs" value="${escapeHtml(node.obfs)}" placeholder="salamander">
            </label>
            <label>Obfs 密码
              <input name="obfsPassword" value="${escapeHtml(node.obfsPassword)}" placeholder="混淆密码">
            </label>
            <label>dialer-proxy
              <input name="dialer-proxy" value="${escapeHtml(node['dialer-proxy'] || '')}" placeholder="前置代理名称">
            </label>
          </div>
        </div>
      `;
    })
    .join("");

  refs.nodesContainer.innerHTML = html;
  refs.parseSummary.textContent = `已加载 ${state.nodes.length} 个节点`;

  refs.nodesContainer.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", (event) => {
      const card = event.target.closest(".node-card");
      if (!card) return;
      const idx = Number(card.dataset.index);
      const field = event.target.name;
      let value = event.target.value;
      if (field === "tls" || field === "skipCertVerify") {
        value = value === "true";
      }
      state.nodes[idx][field] = value;
      if (field === "name") {
        renderNodes();
      }
      renderConnectivityTestCommands(); // Call here for live updates
    });
  });

  refs.nodesContainer
    .querySelectorAll('[data-action="remove-node"]')
    .forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const card = event.target.closest(".node-card");
        if (!card) return;
        const idx = Number(card.dataset.index);
        state.nodes.splice(idx, 1);
        renderNodes();
      });
    });
  renderConnectivityTestCommands(); // Call at the end of renderNodes
}

function normalizeKey(line) {
  const key = line.trim().toLowerCase();
  if (key.includes("服务器地址") || key === "地址" || key === "host" || key.includes("域名")) return "server";
  if (key.includes("ipv4") || key.includes("ip")) return "server";
  if (key.includes("端口")) return "port";
  if (key.includes("username") || key.includes("用户")) return "username";
  if (key.includes("密码") || key.includes("pass") || key.includes("secret")) return "password";
  if (key.includes("加密") || key.includes("cipher") || key.includes("method") || key.includes("encryption"))
    return "method";
  if (key === "type") return "type";
  if (key.includes("sni")) return "sni";
  if (key.includes("tls")) return "tls";
  if (key.includes("skip-cert") || key.includes("skip cert") || key.includes("verify")) return "skipCertVerify";
  if (key === "obfs" || key.includes("混淆")) return "obfs";
  if (key.includes("obfs-password") || key.includes("混淆密码")) return "obfsPassword";
  if (key === "alpn") return "alpn";
  if (key === "ports") return "ports";
  if (key.includes("dialer-proxy")) return "dialer-proxy";
  return "";
}

function parseTypeFromLine(line) {
  if (/type\s*[:：]/i.test(line)) return "";
  if (/trojan/i.test(line)) return "trojan";
  if (/ssltide/i.test(line)) return "socks5";
  if (/hysteria2/i.test(line)) return "hysteria2";
  if (/http\b/i.test(line)) return "http";
  if (/shadowsocks|ss\b/i.test(line)) return "ss";
  return "";
}

function hasUsefulData(block) {
  return block.server || block.port || block.password || block.username || block.method;
}

function inferType(block) {
  if (block.hintType) return block.hintType;
  if (block.method) return "ss";
  if (block.username && block.password && !block.method) return "socks5";
  if (block.password && /trojan/i.test(block.rawText || "")) return "trojan";
  if (block.tls && block.username && block.password) return "http";
  if (block.alpn || block.obfs || block.ports) return "hysteria2";
  return "ss";
}

function finalizeBlock(block, index) {
  const boolVal = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v !== "string") return false;
    return /^(true|yes|on|1)$/i.test(v.trim());
  };
  const none = (v) => {
    if (v === undefined || v === null) return "";
    if (typeof v === "string" && v.toLowerCase() === "null") return "";
    return v;
  };

  const type = inferType(block);
  const rawName =
    block.rawName && block.rawName.length < 64
      ? block.rawName
      : block.hintType === "trojan"
      ? `Trojan ${index + 1}`
      : block.hintType === "socks5"
      ? `Socks5 ${index + 1}`
      : block.hintType === "http"
      ? `HTTP ${index + 1}`
      : block.hintType === "hysteria2"
      ? `Hysteria2 ${index + 1}`
      : `节点 ${index + 1}`;

  const name = normalizeName(rawName) || `节点 ${index + 1}`;

  return {
    name,
    type,
    server: block.server || "",
    port: block.port || "",
    method: none(block.method) || "",
    username: block.username || "",
    password: none(block.password) || "",
    sni: none(block.sni) || "",
    tls: boolVal(block.tls),
    skipCertVerify: boolVal(block.skipCertVerify || block["skip-cert-verify"]),
    obfs: none(block.obfs) || "",
    obfsPassword: none(block.obfsPassword) || "",
    alpn: none(block.alpn) || "",
    ports: none(block.ports) || "",
    "dialer-proxy": none(block["dialer-proxy"]) || "",
  };
}

function splitInlineParts(str) {
  const parts = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === quote) {
        quote = "";
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "," || ch === "，") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function cleanAlpn(value) {
  if (!value) return "";
  const cleaned = value.replace(/^\[|\]$/g, "").replace(/'/g, "").replace(/"/g, "");
  return cleaned.replace(/\s+/g, ",").replace(/,+/g, ",").replace(/(^,|,$)/g, "");
}

function parseInlineNode(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("-")) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const content = trimmed.slice(start + 1, end);
  const record = {};
  const pairs = splitInlineParts(content);
  pairs.forEach((pair) => {
    const [kRaw, ...rest] = pair.split(":");
    if (!kRaw || !rest.length) return;
    const key = kRaw.trim().replace(/^['"]|['"]$/g, "");
    const valueRaw = rest.join(":").trim();
    const value = valueRaw.replace(/^['"]|['"]$/g, "");
    record[key] = value;
  });
  if (!record.server && !record.host) return null;
  return {
    rawName: record.name || "",
    rawText: line,
    hintType: record.type || "",
    server: record.server || record.host || "",
    port: record.port || "",
    username: record.username || record.user || "",
    password: record.password || record.pwd || "",
    method: record.cipher || record.method || "",
    sni: record.sni || "",
    tls: record.tls,
    skipCertVerify: record["skip-cert-verify"] || record.skipCertVerify,
    obfs: record.obfs || "",
    obfsPassword: record["obfs-password"] || "",
    alpn: cleanAlpn(record.alpn || ""),
    ports: record.ports || "",
    "dialer-proxy": record["dialer-proxy"] || "",
  };
}

function parseRawText(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const blocks = [];
  let current = {
    rawName: "",
    rawText: "",
    hintType: "",
    server: "",
    port: "",
    username: "",
    password: "",
    method: "",
    sni: "",
    tls: "",
    skipCertVerify: "",
    obfs: "",
    obfsPassword: "",
    alpn: "",
    ports: "",
    "dialer-proxy": "",
  };

  const hostPortPattern =
    /\b((?:\d{1,3}\.){3}\d{1,3}|[a-z0-9.-]+\.[a-z]{2,})(?::|：)(\d{2,5})\b/i;
  const hostPattern = /\b((?:\d{1,3}\.){3}\d{1,3}|[a-z0-9.-]+\.[a-z]{2,})\b/i;

  const pushCurrent = () => {
    if (hasUsefulData(current)) {
      blocks.push(finalizeBlock(current, blocks.length));
    }
    current = {
      rawName: "",
      rawText: "",
      hintType: "",
      server: "",
      port: "",
      username: "",
      password: "",
      method: "",
    sni: "",
    tls: "",
    skipCertVerify: "",
    obfs: "",
    obfsPassword: "",
    alpn: "",
        ports: "",
        "dialer-proxy": "",
      };
    };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    current.rawText += `${line}\n`;

    const inlineNode = parseInlineNode(line);
    if (inlineNode) {
      if (hasUsefulData(current)) {
        pushCurrent();
      }
      blocks.push(finalizeBlock(inlineNode, blocks.length));
      continue;
    }

    const nameMatch = line.match(/^-?\s*name\s*[:：]\s*(.+)$/i);
    if (nameMatch) {
      if (hasUsefulData(current)) {
        pushCurrent();
      }
      current.rawName = nameMatch[1].trim();
      continue;
    }

    const typeGuess = parseTypeFromLine(line);
    if (typeGuess) {
      if (hasUsefulData(current)) {
        pushCurrent();
      }
      current.rawName = line;
      current.hintType = typeGuess;
      continue;
    }

    const normalizedKey = normalizeKey(line);
    if (normalizedKey) {
      const nextValue = lines[i + 1] ? lines[i + 1].trim() : "";
      const inlineValue = extractInlineValue(line);

      if (normalizedKey === "type") {
        const value = inlineValue || nextValue;
        if (value) {
          current.hintType = value.trim().toLowerCase();
          if (nextValue) i += 1;
          continue;
        }
      }

      if (normalizedKey === "alpn") {
        const items = [];
        if (nextValue && nextValue.startsWith("-")) {
          let j = i + 1;
          for (; j < lines.length; j++) {
            const l = lines[j].trim();
            if (!l.startsWith("-")) break;
            items.push(l.replace(/^-\s*/, ""));
          }
          i = j - 1;
        } else if (inlineValue) {
          items.push(...inlineValue.split(",").map((v) => v.trim()).filter(Boolean));
        } else if (nextValue) {
          items.push(nextValue);
          i += 1;
        }
        if (items.length) {
          current.alpn = items.join(",");
          continue;
        }
      }

      const hasInline = inlineValue.length > 0;
      const hasNext = !!nextValue;
      if (hasInline || hasNext) {
        if (normalizedKey === "server" && current.server) {
          pushCurrent();
        }
        current[normalizedKey] = hasInline ? inlineValue : nextValue;
        if (!hasInline && hasNext) {
          i += 1;
        }
        continue;
      }
    }

    const inlineHostPort = line.match(hostPortPattern);
    if (inlineHostPort) {
      if (current.server && current.port) {
        pushCurrent();
      }
      current.server = inlineHostPort[1];
      current.port = inlineHostPort[2];
      continue;
    }

    if (!current.server) {
      const hostMatch = line.match(hostPattern);
      if (hostMatch) {
        current.server = hostMatch[1];
        continue;
      }
    }

    if (!current.port && /^\d{2,5}$/.test(line)) {
      current.port = line;
      continue;
    }

    if (/密码|pass|secret/i.test(line) && lines[i + 1] && !line.includes(":")) {
      current.password = lines[i + 1].trim();
      i += 1;
      continue;
    }
  }

  pushCurrent();
  return blocks;
}

function buildYaml() {
  const proxiesYaml = state.nodes
    .map((node) => nodeToYaml(node))
    .filter(Boolean)
    .join("\n");

  const proxyNames = state.nodes.map((n) => yamlSafe(n.name));

  const lines = [
    `mixed-port: ${state.base.mixedPort}`,
    `socks-port: ${state.base.socksPort}`,
    `allow-lan: ${state.base.allowLan}`,
    `mode: ${state.base.mode}`,
    `log-level: ${state.base.logLevel}`,
    `udp: ${state.base.udp}`,
    `proxies:`,
    proxiesYaml || "  # 在上方粘贴节点信息后自动生成",
    `proxy-groups:`,
    `  - name: Proxy`,
    `    type: select`,
    `    proxies:`,
    ...(proxyNames.length
      ? proxyNames.map((n) => `      - ${n}`)
      : ["      - DIRECT"]),
    `rules:`,
    `  - MATCH,Proxy`,
  ];

  return lines.join("\n");
}

function yamlSafe(value) {
  if (value === undefined || value === null) return '""';
  if (/[^a-zA-Z0-9_.-]/.test(value)) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }
  return String(value);
}

function alpnList(str) {
  if (!str) return [];
  return str
    .split(/[,\s]+/)
    .map((s) => s.replace(/^-/, "").trim())
    .filter(Boolean);
}

function nodeToYaml(node) {
  if (!node.server) return "";
  if (node.type === "hysteria2" && !node.port && !node.ports) return "";
  if (node.type !== "hysteria2" && !node.port) return "";
  const dialerProxyLine = node["dialer-proxy"] ? `    dialer-proxy: ${yamlSafe(node["dialer-proxy"])}` : "";
  if (node.type === "trojan") {
    return [
      `  - name: ${yamlSafe(node.name)}`,
      `    type: trojan`,
      `    server: ${yamlSafe(node.server)}`,
      `    port: ${node.port}`,
      `    password: ${yamlSafe(node.password)}`,
      node.sni ? `    sni: ${yamlSafe(node.sni)}` : "",
      dialerProxyLine,
      `    udp: true`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (node.type === "http") {
    return [
      `  - name: ${yamlSafe(node.name)}`,
      `    type: http`,
      `    server: ${yamlSafe(node.server)}`,
      `    port: ${node.port}`,
      node.username ? `    username: ${yamlSafe(node.username)}` : "",
      node.password ? `    password: ${yamlSafe(node.password)}` : "",
      typeof node.tls === "boolean" ? `    tls: ${node.tls}` : "",
      typeof node.skipCertVerify === "boolean" ? `    skip-cert-verify: ${node.skipCertVerify}` : "",
      dialerProxyLine,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (node.type === "hysteria2") {
    const alpn = alpnList(node.alpn);
    const alpnLines = alpn.length ? ["    alpn:", ...alpn.map((v) => `      - ${yamlSafe(v)}`)] : [];
    return [
      `  - name: ${yamlSafe(node.name)}`,
      `    type: hysteria2`,
      `    server: ${yamlSafe(node.server)}`,
      node.port ? `    port: ${node.port}` : "",
      node.ports ? `    ports: ${node.ports}` : "",
      `    password: ${yamlSafe(node.password)}`,
      node.sni ? `    sni: ${yamlSafe(node.sni)}` : "",
      typeof node.skipCertVerify === "boolean" ? `    skip-cert-verify: ${node.skipCertVerify}` : "",
      node.obfs ? `    obfs: ${yamlSafe(node.obfs)}` : "",
      node.obfsPassword ? `    obfs-password: ${yamlSafe(node.obfsPassword)}` : "",
      dialerProxyLine,
      ...alpnLines,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (node.type === "socks5") {
    return [
      `  - name: ${yamlSafe(node.name)}`,
      `    type: socks5`,
      `    server: ${yamlSafe(node.server)}`,
      `    port: ${node.port}`,
      node.username ? `    username: ${yamlSafe(node.username)}` : "",
      node.password ? `    password: ${yamlSafe(node.password)}` : "",
      dialerProxyLine,
      `    udp: true`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // default Shadowsocks
  return [
    `  - name: ${yamlSafe(node.name)}`,
    `    type: ss`,
    `    server: ${yamlSafe(node.server)}`,
    `    port: ${node.port}`,
    `    cipher: ${yamlSafe(node.method || "aes-256-gcm")}`,
    `    password: ${yamlSafe(node.password)}`,
    dialerProxyLine,
    `    udp: true`,
  ]
    .filter(Boolean)
    .join("\n");
}

function handleParse() {
  const raw = refs.rawInput.value;
  const parsed = parseRawText(raw);
  if (!parsed.length) {
    refs.parseSummary.textContent = "没有识别到节点，请检查格式";
    renderConnectivityTestCommands(); // Call here too
    return;
  }
  state.nodes = [...state.nodes, ...parsed];
  renderNodes();
}

function handleFileInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    refs.rawInput.value = String(e.target?.result || "");
  };
  reader.readAsText(file);
}

function handleGenerate() {
  updateBaseFromInputs();
  const yaml = buildYaml();
  refs.yamlOutput.value = yaml;
}

function handleCopyYaml() {
  const text = refs.yamlOutput.value;
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => {
    refs.copyYamlBtn.textContent = "已复制";
    setTimeout(() => (refs.copyYamlBtn.textContent = "复制文本"), 1200);
  });
}

function handleDownload() {
  updateBaseFromInputs();
  const text = refs.yamlOutput.value || buildYaml();
  const blob = new Blob([text], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.yaml";
  a.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  refs.parseBtn.addEventListener("click", handleParse);
  refs.fileInput.addEventListener("change", handleFileInput);
  refs.generateYamlBtn.addEventListener("click", handleGenerate);
  refs.copyYamlBtn.addEventListener("click", handleCopyYaml);
  refs.downloadYamlBtn.addEventListener("click", handleDownload);
  refs.addNodeBtn.addEventListener("click", () => {
    state.nodes.push(newNode());
    renderNodes();
    renderConnectivityTestCommands(); // Call here too
  });
  refs.clearNodesBtn.addEventListener("click", () => {
    state.nodes = [];
    renderNodes();
    renderConnectivityTestCommands(); // Call here too
  });
  refs.resetBaseBtn.addEventListener("click", () => {
    state.base = {
      mixedPort: 7890,
      socksPort: 7891,
      mode: "Rule",
      logLevel: "info",
      allowLan: true,
      udp: true,
    };
    resetBaseInputs();
  });

  ["mixedPort", "socksPort", "mode", "logLevel", "allowLan", "udp"].forEach((key) => {
    refs[key].addEventListener("change", updateBaseFromInputs);
    refs[key].addEventListener("input", updateBaseFromInputs);
  });

  refs.themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next);
  });
}

function init() {
  setTheme(getPreferredTheme());
  resetBaseInputs();
  renderNodes();
  bindEvents();
  renderConnectivityTestCommands(); // Call here too
}

init();
