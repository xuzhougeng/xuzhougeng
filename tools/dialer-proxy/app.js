import { parseYamlProxies } from "../shared/mihomo/relay-parser.mjs";
import { buildDialerProxyConfig } from "../shared/mihomo/dialer-proxy-builder.mjs";

const yaml = globalThis.jsyaml;

const state = {
  relayProxies: [],
  relayProxyObjects: [],
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
const EXAMPLE_RELAY_YAML = `  - name: "relay-hk-01"
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

function normalizeRelayYamlInput(yamlText) {
  const raw = String(yamlText ?? "");
  const trimmed = raw.trim();

  if (!trimmed) {
    return "";
  }

  if (/^proxies:\s*(?:$|\r?\n)/.test(trimmed)) {
    return raw;
  }

  if (/^-\s*(?:name:|\{)/.test(trimmed)) {
    return `proxies:\n${raw}`;
  }

  return raw;
}

function materializeRelayProxyObjects(yamlText) {
  if (!yaml?.load) {
    return null;
  }

  try {
    const document = yaml.load(normalizeRelayYamlInput(yamlText));
    const proxies = Array.isArray(document?.proxies)
      ? document.proxies
      : Array.isArray(document)
        ? document
        : null;

    if (!Array.isArray(proxies)) {
      return null;
    }

    return proxies
      .filter(proxy => proxy && typeof proxy === "object" && !Array.isArray(proxy))
      .map(proxy => structuredClone(proxy));
  } catch (_) {
    return null;
  }
}

function cloneRelayProxyMetadata(proxies) {
  return proxies.map(proxy => ({ ...proxy }));
}

function serializeYamlScalar(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  const text = String(value ?? "");
  if (text === "") {
    return '""';
  }

  if (/^[A-Za-z0-9_.\/-]+$/.test(text) && !/^(true|false|null|~)$/i.test(text)) {
    return text;
  }

  return `"${text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")}"`;
}

function serializeYamlValue(value, indent = "") {
  if (Array.isArray(value)) {
    if (!value.length) {
      return `${indent}[]`;
    }

    return value
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item);
          if (!entries.length) {
            return `${indent}- {}`;
          }

          const [firstKey, firstValue] = entries[0];
          const firstLine = serializeYamlKeyValue(firstKey, firstValue, indent, true);
          const rest = entries
            .slice(1)
            .map(([key, nestedValue]) => serializeYamlKeyValue(key, nestedValue, `${indent}  `, false))
            .join("\n");

          return rest ? `${firstLine}\n${rest}` : firstLine;
        }

        return `${indent}- ${serializeYamlScalar(item)}`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) {
      return `${indent}{}`;
    }

    return entries
      .map(([key, nestedValue]) => serializeYamlKeyValue(key, nestedValue, indent, false))
      .join("\n");
  }

  return `${indent}${serializeYamlScalar(value)}`;
}

function serializeYamlKeyValue(key, value, indent, listItem) {
  const prefix = listItem ? `${indent}- ${key}:` : `${indent}${key}:`;

  if (Array.isArray(value)) {
    if (!value.length) {
      return `${prefix} []`;
    }

    return `${prefix}\n${serializeYamlValue(value, `${indent}  `)}`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) {
      return `${prefix} {}`;
    }

    return `${prefix}\n${serializeYamlValue(value, `${indent}  `)}`;
  }

  return `${prefix} ${serializeYamlScalar(value)}`;
}

function serializeConfig(config) {
  if (yaml?.dump) {
    return yaml.dump(config, {
      lineWidth: -1,
      noRefs: true,
    });
  }

  return serializeYamlValue(config);
}

function getRelayYamlBlocksForOutput() {
  if (state.relayProxies.length) {
    return state.relayProxies
      .map(proxy => String(proxy?.raw ?? "").trimEnd())
      .filter(Boolean);
  }

  return parseYamlProxies(normalizeRelayYamlInput(EXAMPLE_RELAY_YAML))
    .map(proxy => String(proxy?.raw ?? "").trimEnd())
    .filter(Boolean);
}

function buildYamlWithRawRelayBlocks(config, relayYamlBlocks) {
  const targetProxy = config.proxies.at(-1);
  const sections = [
    `port: ${serializeYamlScalar(config.port)}`,
    `socks-port: ${serializeYamlScalar(config["socks-port"])}`,
    `allow-lan: ${serializeYamlScalar(config["allow-lan"])}`,
    `mode: ${serializeYamlScalar(config.mode)}`,
    `log-level: ${serializeYamlScalar(config["log-level"])}`,
    `external-controller: ${serializeYamlScalar(config["external-controller"])}`,
    "proxies:",
  ];

  if (relayYamlBlocks.length) {
    sections.push(relayYamlBlocks.join("\n\n"));
  }

  if (targetProxy) {
    sections.push(serializeYamlValue([targetProxy], "  "));
  }

  sections.push(`proxy-groups:\n${serializeYamlValue(config["proxy-groups"], "  ")}`);
  sections.push(`rules:\n${serializeYamlValue(config.rules, "  ")}`);

  return sections.join("\n");
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
        state.relayProxyObjects.splice(idx, 1);
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

function getRelayProxiesForOutput() {
  if (state.relayProxyObjects.length) {
    return state.relayProxyObjects;
  }

  return materializeRelayProxyObjects(EXAMPLE_RELAY_YAML)
    ?? parseYamlProxies(normalizeRelayYamlInput(EXAMPLE_RELAY_YAML));
}

function buildFullYaml() {
  const relayProxies = getRelayProxiesForOutput();
  const { config } = buildDialerProxyConfig({
    relayProxies,
    targetProxy: {
      name: state.targetProxy.name,
      type: state.targetProxy.type,
      server: state.targetProxy.server,
      port: state.targetProxy.port,
      username: state.targetProxy.username,
      password: state.targetProxy.password,
      "dialer-proxy": state.targetProxy.dialerProxy,
    },
  });

  if (!yaml?.load) {
    return buildYamlWithRawRelayBlocks(config, getRelayYamlBlocksForOutput());
  }

  return serializeConfig(config);
}

function handleParseRelay() {
  const raw = refs.relayInput.value;
  if (!raw.trim()) {
    refs.relaySummary.textContent = "输入为空";
    return;
  }

  const parsed = parseYamlProxies(normalizeRelayYamlInput(raw));
  if (!parsed.length) {
    refs.relaySummary.textContent = "未识别到节点";
    return;
  }

  state.relayProxies = parsed;
  state.relayProxyObjects = materializeRelayProxyObjects(raw) ?? cloneRelayProxyMetadata(parsed);
  renderRelayProxies();
}

function handleClearRelay() {
  state.relayProxies = [];
  state.relayProxyObjects = [];
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
  refs.relayInput.value = EXAMPLE_RELAY_YAML;

  handleParseRelay();

  refs.targetName.value = "target-socks5";
  refs.targetType.value = "socks5";
  refs.targetServer.value = "target.example.com";
  refs.targetPort.value = "1080";
  refs.targetUsername.value = "user";
  refs.targetPassword.value = "pass";
  refs.dialerProxy.value = "relay-group";

  updateTargetFromInputs();

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
