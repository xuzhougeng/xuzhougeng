const state = {
  relayProxies: [],
  targetProxy: {
    name: "target-socks5",
    type: "socks5",
    server: "",
    port: "",
    username: "",
    password: "",
    dialerProxy: "relay-group"
  }
};

const refs = {
  relayInput: document.getElementById("relayInput"),
  parseRelayBtn: document.getElementById("parseRelayBtn"),
  relaySummary: document.getElementById("relaySummary"),
  relayContainer: document.getElementById("relayContainer"),
  clearRelayBtn: document.getElementById("clearRelayBtn"),
  targetName: document.getElementById("targetName"),
  targetType: document.getElementById("targetType"),
  targetServer: document.getElementById("targetServer"),
  targetPort: document.getElementById("targetPort"),
  targetUsername: document.getElementById("targetUsername"),
  targetPassword: document.getElementById("targetPassword"),
  dialerProxy: document.getElementById("dialerProxy"),
  generateYamlBtn: document.getElementById("generateYamlBtn"),
  loadExampleBtn: document.getElementById("loadExampleBtn"),
  downloadYamlBtn: document.getElementById("downloadYamlBtn"),
  yamlOutput: document.getElementById("yamlOutput"),
  copyYamlBtn: document.getElementById("copyYamlBtn"),
  themeToggle: document.getElementById("themeToggle"),
  // Modal elements
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage"),
  modalConfirmBtn: document.getElementById("modalConfirmBtn"),
  modalCancelBtn: document.getElementById("modalCancelBtn")
};

const THEME_KEY = "dialer-proxy-theme";

// Modal dialog functions
function showModal(title, message, confirmText = "使用示例生成", cancelText = "去填写数据") {
  return new Promise((resolve) => {
    refs.modalTitle.textContent = title;
    refs.modalMessage.innerHTML = message;
    refs.modalConfirmBtn.textContent = confirmText;
    refs.modalCancelBtn.textContent = cancelText;
    refs.modalOverlay.classList.remove("hidden");

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleOverlayClick = (e) => {
      if (e.target === refs.modalOverlay) {
        handleCancel();
      }
    };

    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    };

    const cleanup = () => {
      refs.modalOverlay.classList.add("hidden");
      refs.modalConfirmBtn.removeEventListener("click", handleConfirm);
      refs.modalCancelBtn.removeEventListener("click", handleCancel);
      refs.modalOverlay.removeEventListener("click", handleOverlayClick);
      document.removeEventListener("keydown", handleKeydown);
    };

    refs.modalConfirmBtn.addEventListener("click", handleConfirm);
    refs.modalCancelBtn.addEventListener("click", handleCancel);
    refs.modalOverlay.addEventListener("click", handleOverlayClick);
    document.addEventListener("keydown", handleKeydown);
  });
}

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
    // ignore
  }
  updateThemeToggleLabel(t);
}

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (_) {
    // ignore
  }
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

function parseYamlProxies(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const proxies = [];
  let currentProxy = null;
  let inProxiesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith("#")) {
      if (currentProxy) {
        currentProxy.raw += line + "\n";
      }
      continue;
    }

    // 检测 proxies: 部分开始
    if (trimmed === "proxies:") {
      inProxiesSection = true;
      continue;
    }

    // 检测新节点开始（以 - name: 或 - {开头）
    if (trimmed.startsWith("- name:") || trimmed.startsWith("-name:") || trimmed.match(/^-\s*\{/)) {
      if (currentProxy && currentProxy.name) {
        proxies.push(currentProxy);
      }
      currentProxy = { raw: line + "\n" };

      // 提取 name
      const nameMatch = trimmed.match(/^-\s*name:\s*["']?([^"'\n]+)["']?/);
      if (nameMatch) {
        currentProxy.name = nameMatch[1].trim();
      }
    } else if (currentProxy) {
      currentProxy.raw += line + "\n";

      // 提取其他字段
      if (trimmed.startsWith("type:")) {
        const typeMatch = trimmed.match(/type:\s*["']?(\S+)["']?/);
        if (typeMatch) currentProxy.type = typeMatch[1];
      } else if (trimmed.startsWith("server:")) {
        const serverMatch = trimmed.match(/server:\s*["']?([^"'\n]+)["']?/);
        if (serverMatch) currentProxy.server = serverMatch[1].trim();
      } else if (trimmed.startsWith("port:")) {
        const portMatch = trimmed.match(/port:\s*(\d+)/);
        if (portMatch) currentProxy.port = portMatch[1];
      }
    } else if (inProxiesSection && (trimmed.startsWith("-") || line.match(/^\s{2,}-/))) {
      // 也可能是 "  - name:" 这种格式
      if (currentProxy && currentProxy.name) {
        proxies.push(currentProxy);
      }
      currentProxy = { raw: line + "\n" };

      const nameMatch = trimmed.match(/^-\s*name:\s*["']?([^"'\n]+)["']?/);
      if (nameMatch) {
        currentProxy.name = nameMatch[1].trim();
      }
    }
  }

  // 添加最后一个节点
  if (currentProxy && currentProxy.name) {
    proxies.push(currentProxy);
  }

  return proxies;
}

function renderRelayProxies() {
  if (!state.relayProxies.length) {
    refs.relayContainer.innerHTML = '<div class="hint">解析后的中转代理会显示在这里</div>';
    refs.relaySummary.textContent = "等待输入";
    return;
  }

  const html = state.relayProxies
    .map((proxy, index) => {
      return `
        <div class="relay-item" data-index="${index}">
          <div class="relay-header">
            <div>
              <strong>${escapeHtml(proxy.name)}</strong>
              <span class="relay-meta">${escapeHtml(proxy.type || "unknown")} - ${escapeHtml(proxy.server || "")}:${escapeHtml(proxy.port || "")}</span>
            </div>
            <button class="btn btn-ghost tiny-btn" data-action="remove-relay">删除</button>
          </div>
        </div>
      `;
    })
    .join("");

  refs.relayContainer.innerHTML = html;
  refs.relaySummary.textContent = `已加载 ${state.relayProxies.length} 个中转节点`;

  // 绑定删除按钮事件
  refs.relayContainer
    .querySelectorAll('[data-action="remove-relay"]')
    .forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const item = event.target.closest(".relay-item");
        if (!item) return;
        const idx = Number(item.dataset.index);
        state.relayProxies.splice(idx, 1);
        renderRelayProxies();
      });
    });
}

function updateTargetFromInputs() {
  state.targetProxy.name = refs.targetName.value.trim() || "target-socks5";
  state.targetProxy.type = refs.targetType.value;
  state.targetProxy.server = refs.targetServer.value.trim();
  state.targetProxy.port = refs.targetPort.value.trim();
  state.targetProxy.username = refs.targetUsername.value.trim();
  state.targetProxy.password = refs.targetPassword.value.trim();
  state.targetProxy.dialerProxy = refs.dialerProxy.value.trim() || "relay-group";
}

function yamlSafe(value) {
  if (value === undefined || value === null || value === "") return '""';
  const str = String(value);
  if (/[^a-zA-Z0-9_.-]/.test(str) || /^\d/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function generateTargetProxyYaml() {
  const lines = [
    `  - name: ${yamlSafe(state.targetProxy.name)}`,
    `    type: ${state.targetProxy.type}`,
    `    server: ${yamlSafe(state.targetProxy.server)}`,
    `    port: ${state.targetProxy.port}`
  ];

  if (state.targetProxy.username) {
    lines.push(`    username: ${yamlSafe(state.targetProxy.username)}`);
  }

  if (state.targetProxy.password) {
    lines.push(`    password: ${yamlSafe(state.targetProxy.password)}`);
  }

  lines.push(`    dialer-proxy: ${yamlSafe(state.targetProxy.dialerProxy)}`);

  return lines.join("\n");
}

function buildFullYaml() {
  // 如果没有中转代理，添加示例
  let relayYaml;
  let relayNames;
  if (state.relayProxies.length === 0) {
    relayYaml = `  # 示例中转代理（请替换为实际配置）
  - name: "relay-hk-01"
    type: ss
    server: relay1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password1"

  - name: "relay-hk-02"
    type: vmess
    server: relay2.example.com
    port: 443
    uuid: xxx-xxx-xxx
    alterId: 0
    cipher: auto`;
    relayNames = ["relay-hk-01", "relay-hk-02"];
  } else {
    relayYaml = state.relayProxies.map(p => p.raw.trimEnd()).join("\n\n");
    relayNames = state.relayProxies.map(p => yamlSafe(p.name));
  }

  const allProxyNames = [...relayNames, yamlSafe(state.targetProxy.name)];
  const targetYaml = generateTargetProxyYaml();

  const proxyGroup = [
    `  - name: ${yamlSafe(state.targetProxy.dialerProxy)}`,
    `    type: select`,
    `    proxies:`,
    ...relayNames.map(name => `      - ${name}`)
  ];

  const lines = [
    `# Dialer-Proxy 配置`,
    `# 生成时间: ${new Date().toLocaleString("zh-CN")}`,
    ``,
    `# ================== 基础设置 ==================`,
    `port: 1990               # HTTP 代理端口`,
    `socks-port: 1991         # SOCKS5 代理端口`,
    `allow-lan: true          # 是否允许局域网连接`,
    `mode: rule               # 规则模式：rule / global / direct`,
    `log-level: info          # 日志级别：info / warning / error / debug`,
    `external-controller: 127.0.0.1:1993   # 控制接口`,
    ``,
    `# ================== 代理节点 ==================`,
    `proxies:`,
    `  # 中转代理（第一跳）`,
    relayYaml,
    ``,
    `  # 目标代理（第二跳）- 通过中转出去`,
    targetYaml,
    ``,
    `# ================== 代理组 ==================`,
    `proxy-groups:`,
    proxyGroup.join("\n"),
    ``,
    `  - name: Proxy`,
    `    type: select`,
    `    proxies:`,
    ...allProxyNames.map(name => `      - ${name}`)
  ];

  lines.push(
    ``,
    `# ================== 分流规则 ==================`,
    `rules:`,
    `  # > Augment`,
    `  - DOMAIN-SUFFIX,augment.com,Proxy`,
    `  - DOMAIN-SUFFIX,augmentcode.com,Proxy`,
    ``,
    `  # > ChatGPT`,
    `  - DOMAIN-SUFFIX,ai.com,Proxy`,
    `  - DOMAIN-SUFFIX,chatgpt.com,Proxy`,
    `  - DOMAIN-SUFFIX,openai.com,Proxy`,
    ``,
    `  # > Chat GPT API & CDN`,
    `  - DOMAIN,chat.openai.com.cdn.cloudflare.net,Proxy`,
    `  - DOMAIN,openaiapi-site.azureedge.net,Proxy`,
    `  - DOMAIN,openaicom-api-bdcpf8c6d2e9atf6.z01.azurefd.net,Proxy`,
    `  - DOMAIN,openaicomproductionae4b.blob.core.windows.net,Proxy`,
    `  - DOMAIN,production-openaicom-storage.azureedge.net,Proxy`,
    `  - DOMAIN-SUFFIX,cdn.oaistatic.com,Proxy`,
    `  - DOMAIN-SUFFIX,oaiusercontent.com,Proxy`,
    `  - DOMAIN,o33249.ingest.sentry.io,Proxy`,
    ``,
    `  # > Cerebras`,
    `  - DOMAIN-SUFFIX,cerebras.ai,Proxy`,
    ``,
    `  # > Chorus`,
    `  - DOMAIN-SUFFIX,chorus.sh,Proxy`,
    ``,
    `  # > Claude`,
    `  - DOMAIN-SUFFIX,anthropic.com,Proxy`,
    `  - DOMAIN-SUFFIX,claude.ai,Proxy`,
    `  - DOMAIN-SUFFIX,claudeusercontent.com,Proxy`,
    ``,
    `  # > Cloudflare AI Gateway`,
    `  - DOMAIN,gateway.ai.cloudflare.com,Proxy`,
    ``,
    `  # > Copilot`,
    `  - DOMAIN-SUFFIX,githubcopilot.com,Proxy`,
    `  - DOMAIN-SUFFIX,microsoftonline.com,Proxy`,
    `  - DOMAIN,copilot.microsoft.com,Proxy`,
    ``,
    `  # > Cursor`,
    `  - DOMAIN-SUFFIX,cursor.sh,Proxy`,
    ``,
    `  # > DIA`,
    `  - DOMAIN-SUFFIX,diabrowser.engineering,Proxy`,
    ``,
    `  # > Dify.AI`,
    `  - DOMAIN-SUFFIX,dify.ai,Proxy`,
    ``,
    `  # > GitHub Copilot`,
    `  - DOMAIN,api.github.com,Proxy`,
    ``,
    `  # > Google AI Studio`,
    `  - DOMAIN-KEYWORD,alkalimakersuite-pa.clients6.google.com,Proxy`,
    `  - DOMAIN-SUFFIX,aistudio.google.com,Proxy`,
    `  - DOMAIN-SUFFIX,makersuite.google.com,Proxy`,
    `  - DOMAIN-SUFFIX,generativeai.google,Proxy`,
    `  - DOMAIN,ai.google.dev,Proxy`,
    `  - DOMAIN,alkalicore-pa.clients6.google.com,Proxy`,
    `  - DOMAIN,waa-pa.clients6.google.com,Proxy`,
    ``,
    `  # > Google DeepMind`,
    `  - DOMAIN-SUFFIX,deepmind.com,Proxy`,
    `  - DOMAIN-SUFFIX,deepmind.google,Proxy`,
    ``,
    `  # > Google Generative Language API`,
    `  - DOMAIN-SUFFIX,generativelanguage.googleapis.com,Proxy`,
    `  - DOMAIN-SUFFIX,geller-pa.googleapis.com,Proxy`,
    `  - DOMAIN-SUFFIX,proactivebackend-pa.googleapis.com,Proxy`,
    ``,
    `  # > Google Gemini`,
    `  - DOMAIN-SUFFIX,aisandbox-pa.googleapis.com,Proxy`,
    `  - DOMAIN-SUFFIX,apis.google.com,Proxy`,
    `  - DOMAIN-SUFFIX,bard.google.com,Proxy`,
    `  - DOMAIN-SUFFIX,gemini.google.com,Proxy`,
    `  - DOMAIN-SUFFIX,robinfrontend-pa.googleapis.com,Proxy`,
    ``,
    `  # > Google NotebookLM`,
    `  - DOMAIN-SUFFIX,notebooklm.google,Proxy`,
    `  - DOMAIN-SUFFIX,notebooklm.google.com,Proxy`,
    ``,
    `  # > Grok`,
    `  - DOMAIN-SUFFIX,x.ai,Proxy`,
    `  - DOMAIN-SUFFIX,grok.com,Proxy`,
    ``,
    `  # > Groq`,
    `  - DOMAIN-SUFFIX,groq.com,Proxy`,
    ``,
    `  # > Jasper`,
    `  - DOMAIN-SUFFIX,clipdrop.co,Proxy`,
    `  - DOMAIN-SUFFIX,jasper.ai,Proxy`,
    ``,
    `  # > JetBrains`,
    `  - DOMAIN-SUFFIX,jetbrains.ai,Proxy`,
    ``,
    `  # > Meta AI`,
    `  - DOMAIN-SUFFIX,meta.ai,Proxy`,
    ``,
    `  # > OpenArt`,
    `  - DOMAIN-SUFFIX,openart.ai,Proxy`,
    ``,
    `  # > OpenRouter`,
    `  - DOMAIN-SUFFIX,openrouter.ai,Proxy`,
    ``,
    `  # > Perplexity AI`,
    `  - DOMAIN-SUFFIX,perplexity.ai,Proxy`,
    ``,
    `  # > POE`,
    `  - DOMAIN-SUFFIX,poe.com,Proxy`,
    ``,
    `  # > Siri`,
    `  - DOMAIN-SUFFIX,apple-relay.apple.com,Proxy`,
    `  - DOMAIN-SUFFIX,apple-relay.fastly-edge.com,Proxy`,
    `  - DOMAIN-SUFFIX,apple-relay.cloudflare.com,Proxy`,
    `  - DOMAIN-SUFFIX,guzzoni.apple.com,Proxy`,
    `  - DOMAIN-SUFFIX,cp4.cloudflare.com,Proxy`,
    `  - DOMAIN-SUFFIX,gspe1-ssl.ls.apple.com,Proxy`,
    `  - DOMAIN-SUFFIX,smoot.apple.com,Proxy`,
    ``,
    `  # > Sora`,
    `  - DOMAIN-SUFFIX,sora.com,Proxy`,
    `  - DOMAIN,sora-cdn.oaistatic.com,Proxy`,
    ``,
    `  # > Windsurf`,
    `  - DOMAIN-SUFFIX,windsurf.com,Proxy`,
    `  - DOMAIN-SUFFIX,codeium.com,Proxy`,
    `  - DOMAIN-SUFFIX,codeiumdata.com,Proxy`,
    ``,
    `  # > Zed`,
    `  - DOMAIN-SUFFIX,zed.dev,Proxy`,
    ``,
    `  # > Final Rule`,
    `  - MATCH,DIRECT`
  );

  return lines.join("\n");
}

function handleParseRelay() {
  const raw = refs.relayInput.value;
  if (!raw.trim()) {
    refs.relaySummary.textContent = "输入为空";
    return;
  }

  const parsed = parseYamlProxies(raw);
  if (!parsed.length) {
    refs.relaySummary.textContent = "未识别到节点";
    return;
  }

  state.relayProxies = parsed;
  renderRelayProxies();
}

function handleClearRelay() {
  state.relayProxies = [];
  refs.relayInput.value = "";
  renderRelayProxies();
}

async function handleGenerate() {
  updateTargetFromInputs();

  // 检查是否填写了必要字段
  const missingFields = [];

  if (!state.targetProxy.server) {
    missingFields.push("服务器地址");
  }
  if (!state.targetProxy.port) {
    missingFields.push("端口");
  }

  if (missingFields.length > 0) {
    const fieldsText = missingFields.map(f => `<strong>${f}</strong>`).join(" 和 ");
    const confirmUseExample = await showModal(
      "字段未填写",
      `目标代理的 ${fieldsText} 为空。<br><br>` +
      `您可以使用示例数据生成配置预览，<br>` +
      `或点击「<strong>加载案例</strong>」按钮填充完整示例。`
    );

    if (!confirmUseExample) {
      return;
    }

    // 使用示例值
    if (!state.targetProxy.server) {
      state.targetProxy.server = "target.example.com";
    }
    if (!state.targetProxy.port) {
      state.targetProxy.port = "1080";
    }
  }

  const yaml = buildFullYaml();
  refs.yamlOutput.value = yaml;
}

function handleCopyYaml() {
  const text = refs.yamlOutput.value;
  if (!text) {
    alert("请先生成配置");
    return;
  }

  // 尝试使用现代 Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => {
        refs.copyYamlBtn.textContent = "已复制";
        setTimeout(() => (refs.copyYamlBtn.textContent = "复制配置"), 1500);
      })
      .catch((err) => {
        console.error("Clipboard API 失败:", err);
        fallbackCopy(text);
      });
  } else {
    // 使用备用方案
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  // 创建临时 textarea
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      refs.copyYamlBtn.textContent = "已复制";
      setTimeout(() => (refs.copyYamlBtn.textContent = "复制配置"), 1500);
    } else {
      alert("复制失败，请手动复制");
    }
  } catch (err) {
    console.error("备用复制方法失败:", err);
    alert("复制失败，请手动复制");
  }

  document.body.removeChild(textarea);
}

function handleDownload() {
  updateTargetFromInputs();
  const text = refs.yamlOutput.value || buildFullYaml();
  const blob = new Blob([text], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dialer-proxy-config.yaml";
  a.click();
  URL.revokeObjectURL(url);
}

function handleLoadExample() {
  // 示例中转代理 YAML
  const exampleRelayYaml = `  - name: "relay-hk-01"
    type: ss
    server: relay1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password1"

  - name: "relay-hk-02"
    type: vmess
    server: relay2.example.com
    port: 443
    uuid: a1b2c3d4-e5f6-7890-abcd-ef1234567890
    alterId: 0
    cipher: auto`;

  // 填充中转代理输入框
  refs.relayInput.value = exampleRelayYaml;

  // 解析中转代理
  handleParseRelay();

  // 填充目标代理表单
  refs.targetName.value = "target-socks5";
  refs.targetType.value = "socks5";
  refs.targetServer.value = "target.example.com";
  refs.targetPort.value = "1080";
  refs.targetUsername.value = "user";
  refs.targetPassword.value = "pass";
  refs.dialerProxy.value = "relay-group";

  // 更新状态
  updateTargetFromInputs();

  // 提示用户
  refs.loadExampleBtn.textContent = "已加载";
  setTimeout(() => (refs.loadExampleBtn.textContent = "加载案例"), 1500);
}

function bindEvents() {
  refs.parseRelayBtn.addEventListener("click", handleParseRelay);
  refs.clearRelayBtn.addEventListener("click", handleClearRelay);
  refs.generateYamlBtn.addEventListener("click", handleGenerate);
  refs.loadExampleBtn.addEventListener("click", handleLoadExample);
  refs.copyYamlBtn.addEventListener("click", handleCopyYaml);
  refs.downloadYamlBtn.addEventListener("click", handleDownload);

  // 实时更新目标代理信息
  [
    refs.targetName,
    refs.targetType,
    refs.targetServer,
    refs.targetPort,
    refs.targetUsername,
    refs.targetPassword,
    refs.dialerProxy
  ].forEach(input => {
    if (input) {
      input.addEventListener("input", updateTargetFromInputs);
    }
  });

  refs.themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next);
  });
}

function init() {
  setTheme(getPreferredTheme());
  renderRelayProxies();
  bindEvents();
}

init();
