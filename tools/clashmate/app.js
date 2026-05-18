import { RULES_DEF } from "../shared/mihomo/provider-catalog.mjs";
import { coreAiRelay, extendedAiRelay, renderRulePackLines } from "../shared/mihomo/ai-rule-packs.mjs";
import { parseYamlProxies, buildTargetProxyNode } from "../shared/mihomo/relay-parser.mjs";
import {
  buildRelayFlowPreview,
  buildRuleTargetOptions,
  createDefaultClashmateState,
  createDefaultTargetProxyDraft,
  rewriteCustomRuleTargets,
} from "../shared/mihomo/clashmate-state.mjs";
import { buildClashmateConfig } from "../shared/mihomo/clashmate-builder.mjs";

const yaml = globalThis.jsyaml;

if (!yaml) {
  throw new Error("jsyaml is required for ClashMate");
}

const RULE_PACKS = {
  coreAiRelay: {
    label: "AI 核心规则",
    description: "OpenAI / Claude 等核心 AI 域名集合。",
    pack: coreAiRelay,
  },
  extendedAiRelay: {
    label: "AI 扩展规则",
    description: "在核心规则之外额外覆盖 Copilot、Gemini、Perplexity 等域名。",
    pack: extendedAiRelay,
  },
};

const $ = id => document.getElementById(id);

const state = createDefaultClashmateState();
const uiState = {
  relayYamlText: "",
  packTargets: {
    coreAiRelay: state.aiRelayGroup,
    extendedAiRelay: state.aiRelayGroup,
  },
};

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function defaultProviderTarget(rule) {
  if (rule.defaultAction === "REJECT") {
    return "REJECT";
  }

  if (rule.defaultAction === "DIRECT") {
    return "DIRECT";
  }

  return "Proxy";
}

function normalizeRuleLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  return trimmed.replace(/^-+\s*/, "");
}

function indentBlock(text, indentSize = 2) {
  const padding = " ".repeat(indentSize);
  return String(text ?? "")
    .split(/\r?\n/)
    .map(line => (line ? `${padding}${line}` : line))
    .join("\n");
}

function getUpstreamProxyNames() {
  return state.upstreamProxies.map(proxy => String(proxy?.name ?? "").trim()).filter(Boolean);
}

function getExtraRelayProxyNames() {
  return state.relayProxies.map(proxy => String(proxy?.name ?? "").trim()).filter(Boolean);
}

function getRelayCandidateNames() {
  const seen = new Set();
  const names = [];

  for (const proxy of [...state.upstreamProxies, ...state.relayProxies]) {
    const name = String(proxy?.name ?? "").trim();
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    names.push(name);
  }

  return names;
}

function setRelayProxyNames(proxyNames) {
  const allowed = new Set(getRelayCandidateNames());
  const seen = new Set();
  state.relayProxyNames = (Array.isArray(proxyNames) ? proxyNames : [])
    .map(proxyName => String(proxyName ?? "").trim())
    .filter(proxyName => {
      if (!proxyName || !allowed.has(proxyName) || seen.has(proxyName)) {
        return false;
      }

      seen.add(proxyName);
      return true;
    });
}

function replaceExtraRelayProxies(relayProxies, { selectNew = true } = {}) {
  const previousExtraNames = new Set(getExtraRelayProxyNames());
  const selectedNames = new Set(
    state.relayProxyNames.filter(proxyName => !previousExtraNames.has(proxyName))
  );

  state.relayProxies = Array.isArray(relayProxies)
    ? relayProxies.map(proxy => structuredClone(proxy))
    : [];

  if (selectNew) {
    getExtraRelayProxyNames().forEach(proxyName => selectedNames.add(proxyName));
  }

  setRelayProxyNames(getRelayCandidateNames().filter(proxyName => selectedNames.has(proxyName)));
}

function createDefaultOrdinaryGroups(proxyNames = []) {
  return [
    { name: "Auto", type: "url-test", proxies: [...proxyNames] },
    { name: "Proxy", type: "select", proxies: [...proxyNames] },
  ];
}

function createCustomOrdinaryGroup(proxyNames = []) {
  return {
    name: `Group${Math.max(1, state.ordinaryGroups.length - 1)}`,
    type: "select",
    proxies: [...proxyNames],
  };
}

function buildAllRuleTargetOptions() {
  const options = buildRuleTargetOptions({
    ordinaryGroups: state.ordinaryGroups,
    aiRelayGroup: state.aiRelayGroup,
  });

  if (!options.includes(state.relayGroup)) {
    options.push(state.relayGroup);
  }

  return options.filter(Boolean);
}

function setStatus(id, type, message) {
  const element = $(id);
  element.hidden = false;
  element.className = `status ${type}`;
  element.textContent = message;
}

function clearStatus(id) {
  const element = $(id);
  element.hidden = true;
  element.className = "status";
  element.textContent = "";
}

function resetOutput() {
  $("resultError").hidden = true;
  $("resultError").textContent = "";
  $("summaryOutput").hidden = true;
  $("summaryOutput").textContent = "";
  $("yamlOutput").hidden = true;
  $("yamlOutput").textContent = "";
  $("copyBtn").hidden = true;
  $("downloadBtn").hidden = true;
}

function applyBaseConfig(config) {
  $("cfgPort").value = config.port ?? 7893;
  $("cfgSocksPort").value = config["socks-port"] ?? 7894;
  $("cfgAllowLan").value = config["allow-lan"] === false ? "false" : "true";
  $("cfgMode").value = config.mode ?? "rule";
  $("cfgLogLevel").value = config["log-level"] ?? "info";
  $("cfgController").value = config["external-controller"] ?? "0.0.0.0:9090";
}

function collectBaseConfig() {
  return {
    port: Number.parseInt($("cfgPort").value, 10) || 7893,
    "socks-port": Number.parseInt($("cfgSocksPort").value, 10) || 7894,
    "allow-lan": $("cfgAllowLan").value === "true",
    mode: $("cfgMode").value,
    "log-level": $("cfgLogLevel").value,
    "external-controller": $("cfgController").value.trim() || "0.0.0.0:9090",
  };
}

function showGeneratedSections() {
  ["groupsSection", "advancedSection", "rulesSection", "outputSection"].forEach(id => {
    $(id).hidden = false;
  });
}

function initializeStateFromConfig(config) {
  const nextState = createDefaultClashmateState();
  const upstreamProxies = Array.isArray(config.proxies)
    ? config.proxies.map(proxy => structuredClone(proxy))
    : [];
  const upstreamProxyNames = upstreamProxies.map(proxy => String(proxy?.name ?? "").trim()).filter(Boolean);
  nextState.originalConfig = structuredClone(config);
  nextState.upstreamProxies = upstreamProxies;
  nextState.ordinaryGroups = createDefaultOrdinaryGroups(upstreamProxyNames);
  nextState.relayProxyNames = [...upstreamProxyNames];
  nextState.targetProxies = [createDefaultTargetProxyDraft(nextState.relayGroup)];

  Object.assign(state, nextState);

  uiState.relayYamlText = "";
  uiState.packTargets = {
    coreAiRelay: nextState.aiRelayGroup,
    extendedAiRelay: nextState.aiRelayGroup,
  };

  applyBaseConfig(config);
  $("relayYamlInput").value = "";
  $("customRulesInput").value = "";
  clearStatus("relayStatus");
  resetOutput();
  showGeneratedSections();
  renderAll();
}

async function fetchConfig(url) {
  const proxies = [
    inputUrl => `https://api.allorigins.win/raw?url=${encodeURIComponent(inputUrl)}`,
    inputUrl => `https://corsproxy.io/?${encodeURIComponent(inputUrl)}`,
  ];

  for (const makeUrl of proxies) {
    try {
      const response = await fetch(makeUrl(url));
      if (response.ok) {
        return await response.text();
      }
    } catch {}
  }

  const directResponse = await fetch(url);
  if (directResponse.ok) {
    return await directResponse.text();
  }

  throw new Error("无法获取配置");
}

function processConfig(text) {
  const config = yaml.load(text);
  if (!config?.proxies?.length) {
    throw new Error("未找到节点");
  }

  initializeStateFromConfig(config);
  return state.upstreamProxies.length;
}

function renderProxyList() {
  const proxyList = $("proxyList");
  proxyList.hidden = false;
  proxyList.innerHTML = state.upstreamProxies
    .map(proxy => `<span class="proxy-tag">${escapeHtml(proxy.name ?? "(未命名)")}</span>`)
    .join("");
}

function rewriteReferencedTargets(renameMap) {
  const normalizedEntries = Object.entries(renameMap).filter(([oldName, newName]) => oldName && newName && oldName !== newName);
  if (!normalizedEntries.length) {
    return;
  }

  state.customRules = rewriteCustomRuleTargets(state.customRules, Object.fromEntries(normalizedEntries));
  $("customRulesInput").value = state.customRules.join("\n");

  normalizedEntries.forEach(([oldName, newName]) => {
    Object.entries(state.selectedProviders).forEach(([providerName, target]) => {
      if (target === oldName) {
        state.selectedProviders[providerName] = newName;
      }
    });

    Object.keys(uiState.packTargets).forEach(packName => {
      if (uiState.packTargets[packName] === oldName) {
        uiState.packTargets[packName] = newName;
      }
    });
  });
}

function renderOrdinaryGroups() {
  const container = $("groupsContainer");
  const upstreamProxyNames = getUpstreamProxyNames();

  container.innerHTML = state.ordinaryGroups
    .map((group, index) => {
      const isReserved = group.name === "Auto" || group.name === "Proxy";
      return `
        <div class="group-item" data-group-index="${index}">
          <div class="group-header">
            <input
              type="text"
              class="group-name"
              value="${escapeHtml(group.name)}"
              placeholder="组名"
              ${isReserved ? "readonly" : ""}
            >
            <select class="group-type">
              <option value="url-test" ${group.type === "url-test" ? "selected" : ""}>url-test</option>
              <option value="select" ${group.type === "select" ? "selected" : ""}>select</option>
              <option value="fallback" ${group.type === "fallback" ? "selected" : ""}>fallback</option>
              <option value="load-balance" ${group.type === "load-balance" ? "selected" : ""}>load-balance</option>
            </select>
            <button class="btn-sm select-all-proxies">全选</button>
            <button class="btn-sm invert-proxies">反选</button>
            ${isReserved ? "" : '<button class="btn-sm btn-danger del-group">删除</button>'}
          </div>
          <div class="group-proxies">
            ${upstreamProxyNames
              .map(
                proxyName => `
                  <label class="proxy-checkbox ${group.proxies.includes(proxyName) ? "selected" : ""}">
                    <input type="checkbox" value="${escapeHtml(proxyName)}" ${group.proxies.includes(proxyName) ? "checked" : ""}>
                    ${escapeHtml(proxyName)}
                  </label>
                `
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  state.ordinaryGroups.forEach((group, index) => {
    const root = container.querySelector(`[data-group-index="${index}"]`);
    if (!root) {
      return;
    }

    const nameInput = root.querySelector(".group-name");
    if (!nameInput.readOnly) {
      nameInput.addEventListener("input", event => {
        const oldName = state.ordinaryGroups[index].name;
        const nextName = event.target.value.trim();
        state.ordinaryGroups[index].name = nextName;
        rewriteReferencedTargets({ [oldName]: nextName });
        renderRulePacks();
        renderProviders();
        resetOutput();
      });
    }

    root.querySelector(".group-type").addEventListener("change", event => {
      state.ordinaryGroups[index].type = event.target.value;
      resetOutput();
    });

    const deleteButton = root.querySelector(".del-group");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        const oldName = state.ordinaryGroups[index].name;
        state.ordinaryGroups.splice(index, 1);
        rewriteReferencedTargets({ [oldName]: "Proxy" });
        renderOrdinaryGroups();
        renderRulePacks();
        renderProviders();
        resetOutput();
      });
    }

    root.querySelector(".select-all-proxies").addEventListener("click", () => {
      state.ordinaryGroups[index].proxies = [...upstreamProxyNames];
      renderOrdinaryGroups();
      resetOutput();
    });

    root.querySelector(".invert-proxies").addEventListener("click", () => {
      state.ordinaryGroups[index].proxies = upstreamProxyNames.filter(
        proxyName => !state.ordinaryGroups[index].proxies.includes(proxyName)
      );
      renderOrdinaryGroups();
      resetOutput();
    });

    root.querySelectorAll(".proxy-checkbox").forEach(label => {
      const checkbox = label.querySelector("input");
      label.addEventListener("click", event => {
        event.preventDefault();
        const proxyName = checkbox.value;
        const proxies = new Set(state.ordinaryGroups[index].proxies);

        if (proxies.has(proxyName)) {
          proxies.delete(proxyName);
        } else {
          proxies.add(proxyName);
        }

        state.ordinaryGroups[index].proxies = upstreamProxyNames.filter(name => proxies.has(name));
        renderOrdinaryGroups();
        resetOutput();
      });
    });
  });
}

function renderRelaySection() {
  $("relayGroupName").value = state.relayGroup;
  $("relayGroupType").value = state.relayGroupType;
  $("relayYamlInput").value = uiState.relayYamlText;

  setRelayProxyNames(state.relayProxyNames);

  const relayCandidateNames = getRelayCandidateNames();
  const selectedNames = new Set(state.relayProxyNames);
  const extraRelayNames = new Set(getExtraRelayProxyNames());
  $("relaySelectionSummary").textContent = `已选 ${selectedNames.size} / ${relayCandidateNames.length} 个 Relay 节点`;

  const relaySourceList = $("relaySourceList");
  if (!relayCandidateNames.length) {
    relaySourceList.innerHTML = `<div class="empty-state">上传 YAML 后会在这里选择 Relay 第一跳节点。</div>`;
    return;
  }

  relaySourceList.innerHTML = relayCandidateNames
    .map(
      proxyName => `
        <label class="proxy-checkbox ${selectedNames.has(proxyName) ? "selected" : ""}">
          <input type="checkbox" value="${escapeHtml(proxyName)}" ${selectedNames.has(proxyName) ? "checked" : ""}>
          ${escapeHtml(proxyName)}${extraRelayNames.has(proxyName) ? " · 额外" : ""}
        </label>
      `
    )
    .join("");

  relaySourceList.querySelectorAll(".proxy-checkbox").forEach(label => {
    const checkbox = label.querySelector("input");
    label.addEventListener("click", event => {
      event.preventDefault();
      const proxyName = checkbox.value;
      const nextSelectedNames = new Set(state.relayProxyNames);

      if (nextSelectedNames.has(proxyName)) {
        nextSelectedNames.delete(proxyName);
      } else {
        nextSelectedNames.add(proxyName);
      }

      setRelayProxyNames(relayCandidateNames.filter(name => nextSelectedNames.has(name)));
      renderRelaySection();
      renderFlowPreview();
      resetOutput();
    });
  });
}

function renderTargetProxies() {
  $("aiRelayGroupName").value = state.aiRelayGroup;

  const container = $("targetsContainer");
  if (!state.targetProxies.length) {
    container.innerHTML = `<div class="empty-state">尚未创建目标节点。点击“新建目标节点”添加一个目标出口。</div>`;
    return;
  }

  container.innerHTML = state.targetProxies
    .map(
      (proxy, index) => `
        <article class="target-proxy-item" data-target-index="${index}">
          <div class="target-proxy-header">
            <strong>目标节点 #${index + 1}</strong>
            <button class="btn-sm btn-danger" data-target-delete="${index}">删除</button>
          </div>
          <div class="target-grid">
            <label>
              <span>名称</span>
              <input type="text" data-target-field="name" value="${escapeHtml(proxy.name)}" placeholder="target-us">
            </label>
            <label>
              <span>类型</span>
              <input type="text" data-target-field="type" value="${escapeHtml(proxy.type)}" placeholder="socks5">
            </label>
            <label>
              <span>服务器</span>
              <input type="text" data-target-field="server" value="${escapeHtml(proxy.server)}" placeholder="target.example.com">
            </label>
            <label>
              <span>端口</span>
              <input type="number" data-target-field="port" value="${escapeHtml(proxy.port)}" placeholder="1080">
            </label>
            <label>
              <span>用户名</span>
              <input type="text" data-target-field="username" value="${escapeHtml(proxy.username ?? "")}" placeholder="可选">
            </label>
            <label>
              <span>密码</span>
              <input type="text" data-target-field="password" value="${escapeHtml(proxy.password ?? "")}" placeholder="可选">
            </label>
            <label>
              <span>dialer-proxy</span>
              <input type="text" value="${escapeHtml(proxy["dialer-proxy"] ?? "")}" readonly>
            </label>
          </div>
        </article>
      `
    )
    .join("");

  state.targetProxies.forEach((proxy, index) => {
    const card = container.querySelector(`[data-target-index="${index}"]`);
    if (!card) {
      return;
    }

    card.querySelectorAll("[data-target-field]").forEach(input => {
      input.addEventListener("input", event => {
        const field = event.target.dataset.targetField;
        state.targetProxies[index][field] = event.target.value;
        renderFlowPreview();
        resetOutput();
      });
    });

    card.querySelector(`[data-target-delete="${index}"]`).addEventListener("click", () => {
      state.targetProxies.splice(index, 1);
      renderTargetProxies();
      renderFlowPreview();
      resetOutput();
    });

    if (!proxy["dialer-proxy"]) {
      state.targetProxies[index]["dialer-proxy"] = state.relayGroup;
    }
  });
}

function renderFlowPreview() {
  const preview = buildRelayFlowPreview(state);
  const renderChain = steps =>
    steps
      .map((step, index) => {
        const stepMarkup = `<span class="flow-step">${escapeHtml(step)}</span>`;
        if (index === steps.length - 1) {
          return stepMarkup;
        }

        return `${stepMarkup}<span class="flow-arrow">→</span>`;
      })
      .join("");

  $("ordinaryFlowPreview").innerHTML = renderChain(preview.ordinary);
  $("aiFlowPreview").innerHTML = renderChain(preview.ai);
  $("dialerFlowPreview").innerHTML = renderChain(preview.dialer);
}

function renderRulePacks() {
  const options = buildAllRuleTargetOptions();
  const optionsMarkup = target =>
    options
      .map(option => `<option value="${escapeHtml(option)}" ${option === target ? "selected" : ""}>${escapeHtml(option)}</option>`)
      .join("");

  const container = $("builtInRulePacks");
  container.innerHTML = Object.entries(RULE_PACKS)
    .map(([packName, metadata]) => {
      const enabled = Boolean(state.selectedRulePacks[packName]);
      const selectedTarget = options.includes(uiState.packTargets[packName]) ? uiState.packTargets[packName] : state.aiRelayGroup;
      uiState.packTargets[packName] = selectedTarget;

      return `
        <div class="rule-pack-row">
          <label>
            <input type="checkbox" data-pack-toggle="${packName}" ${enabled ? "checked" : ""}>
            <span>
              ${escapeHtml(metadata.label)}
              <small>${escapeHtml(metadata.description)}</small>
            </span>
          </label>
          <select data-pack-target="${packName}">
            ${optionsMarkup(selectedTarget)}
          </select>
        </div>
      `;
    })
    .join("");

  Object.keys(RULE_PACKS).forEach(packName => {
    const toggle = container.querySelector(`[data-pack-toggle="${packName}"]`);
    const select = container.querySelector(`[data-pack-target="${packName}"]`);

    toggle.addEventListener("change", event => {
      state.selectedRulePacks[packName] = event.target.checked;
      resetOutput();
    });

    select.addEventListener("change", event => {
      uiState.packTargets[packName] = event.target.value;
      resetOutput();
    });
  });
}

function renderProviders() {
  const options = buildAllRuleTargetOptions();
  const optionMarkup = selected =>
    options
      .map(option => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`)
      .join("");

  let html = "";
  Object.entries(RULES_DEF).forEach(([category, rules]) => {
    html += `<div class="rule-category"><h3>${escapeHtml(category)}</h3>`;
    rules.forEach(rule => {
      const enabled = Object.hasOwn(state.selectedProviders, rule.name);
      const selectedTarget = options.includes(state.selectedProviders[rule.name])
        ? state.selectedProviders[rule.name]
        : defaultProviderTarget(rule);

      if (enabled) {
        state.selectedProviders[rule.name] = selectedTarget;
      }

      html += `
        <div class="rule-row" data-provider-row="${escapeHtml(rule.name)}">
          <label>
            <input type="checkbox" data-provider-check="${escapeHtml(rule.name)}" ${enabled ? "checked" : ""}>
            ${escapeHtml(rule.name)}
          </label>
          <select data-provider-target="${escapeHtml(rule.name)}">
            ${optionMarkup(selectedTarget)}
          </select>
        </div>
      `;
    });
    html += "</div>";
  });

  const container = $("rulesContainer");
  container.innerHTML = html;

  Object.values(RULES_DEF)
    .flat()
    .forEach(rule => {
      const check = container.querySelector(`[data-provider-check="${rule.name}"]`);
      const select = container.querySelector(`[data-provider-target="${rule.name}"]`);

      check.addEventListener("change", event => {
        if (event.target.checked) {
          state.selectedProviders[rule.name] = select.value;
        } else {
          delete state.selectedProviders[rule.name];
        }
        resetOutput();
      });

      select.addEventListener("change", event => {
        state.selectedProviders[rule.name] = event.target.value;
        check.checked = true;
        resetOutput();
      });
    });
}

function renderAll() {
  renderProxyList();
  renderOrdinaryGroups();
  renderRelaySection();
  renderTargetProxies();
  renderFlowPreview();
  renderRulePacks();
  renderProviders();
}

function syncRelayGroupReferences(oldName, nextName) {
  state.targetProxies = state.targetProxies.map(proxy => ({
    ...proxy,
    "dialer-proxy": nextName,
  }));
  rewriteReferencedTargets({ [oldName]: nextName });
}

function syncAiRelayReferences(oldName, nextName) {
  rewriteReferencedTargets({ [oldName]: nextName });
}

function parseRelayYamlText(text) {
  const trimmed = String(text ?? "").trim();
  const candidates = [text];

  if (trimmed.startsWith("-")) {
    candidates.unshift(`proxies:\n${indentBlock(text, 2)}`);
  }

  for (const candidate of candidates) {
    const proxies = parseYamlProxies(candidate);
    if (proxies.length) {
      return proxies;
    }
  }

  return [];
}

function resolveRelayProxiesFromText(text) {
  const rawText = String(text ?? "");
  if (!rawText.trim()) {
    return [];
  }

  const proxies = parseRelayYamlText(rawText);
  if (!proxies.length) {
    throw new Error("未解析到任何 Relay 节点");
  }

  return proxies.map(proxy => reconstructRelayProxy(proxy.raw));
}

function reconstructRelayProxy(raw) {
  const parsed = yaml.load(`proxies:\n${raw}`);
  const proxy = parsed?.proxies?.[0];

  if (!proxy || typeof proxy !== "object") {
    throw new Error("Relay YAML 中存在无法识别的节点");
  }

  return proxy;
}

function buildPreparedTargetProxies() {
  return state.targetProxies
    .map(proxy => {
      const normalized = buildTargetProxyNode({
        ...proxy,
        dialerProxy: state.relayGroup,
      });
      normalized["dialer-proxy"] = state.relayGroup;
      return normalized;
    })
    .filter(proxy => proxy.name && proxy.type && proxy.server && proxy.port);
}

function buildPreparedOrdinaryGroups() {
  return state.ordinaryGroups.map(group => ({
    name: String(group?.name ?? "").trim(),
    type: String(group?.type ?? "").trim() || "select",
    proxies: Array.isArray(group?.proxies) ? group.proxies.map(proxyName => String(proxyName ?? "").trim()).filter(Boolean) : [],
  }));
}

function materializeRulePacks() {
  const selectedRulePacks = Object.fromEntries(Object.keys(RULE_PACKS).map(packName => [packName, false]));
  const extraLines = [];
  const enabledTargets = [];

  Object.entries(RULE_PACKS).forEach(([packName, metadata]) => {
    if (!state.selectedRulePacks[packName]) {
      return;
    }

    const target = uiState.packTargets[packName] || state.aiRelayGroup;
    enabledTargets.push({ packName, target });

    if (target === state.aiRelayGroup) {
      selectedRulePacks[packName] = true;
      return;
    }

    renderRulePackLines(metadata.pack, target).forEach(line => {
      const normalized = normalizeRuleLine(line);
      if (normalized) {
        extraLines.push(normalized);
      }
    });
  });

  return { selectedRulePacks, extraLines, enabledTargets };
}

function renderSummary(summary, context) {
  const providerTargets = Object.entries(summary.providerTargets);
  const builtInPacks = context.enabledTargets.length
    ? context.enabledTargets.map(item => `${RULE_PACKS[item.packName].label} -> ${item.target}`).join(", ")
    : "无";
  const providerSummary = providerTargets.length
    ? providerTargets.map(([name, target]) => `${name} -> ${target}`).join(", ")
    : "无";

  $("summaryOutput").hidden = false;
  $("summaryOutput").textContent = [
    `上游节点: ${summary.proxyPools.upstream.length}`,
    `Relay 节点: ${summary.proxyPools.relay.length}`,
    `目标节点: ${summary.proxyPools.target.length}`,
    `保留组: ${summary.groups.ordinary.join(", ")}`,
    `Relay 组: ${summary.groups.relay} (${context.relayGroupType})`,
    `目标组: ${summary.groups.aiRelay}`,
    `内置规则包: ${builtInPacks}`,
    `Providers: ${providerSummary}`,
    `自定义规则: ${summary.customRuleCount}`,
    `总规则数: ${summary.ruleCount}`,
    context.ignoredTargets > 0 ? `已忽略未填写完整的目标节点: ${context.ignoredTargets}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleFetch() {
  const url = $("configUrl").value.trim();
  if (!url) {
    return;
  }

  $("fetchBtn").disabled = true;
  setStatus("proxyStatus", "", "正在获取...");

  try {
    const text = await fetchConfig(url);
    const count = processConfig(text);
    setStatus("proxyStatus", "success", `✓ 获取到 ${count} 个上游节点`);
  } catch (error) {
    setStatus("proxyStatus", "error", `✗ ${error.message}`);
  } finally {
    $("fetchBtn").disabled = false;
  }
}

function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  setStatus("proxyStatus", "", "正在读取文件...");

  const reader = new FileReader();
  reader.onload = loadEvent => {
    try {
      const count = processConfig(loadEvent.target.result);
      setStatus("proxyStatus", "success", `✓ 从文件读取 ${count} 个上游节点`);
    } catch (error) {
      setStatus("proxyStatus", "error", `✗ ${error.message}`);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function handleRelayParse() {
  uiState.relayYamlText = $("relayYamlInput").value;

  if (!uiState.relayYamlText.trim()) {
    replaceExtraRelayProxies([], { selectNew: false });
    clearStatus("relayStatus");
    renderRelaySection();
    renderFlowPreview();
    resetOutput();
    return;
  }

  try {
    replaceExtraRelayProxies(resolveRelayProxiesFromText(uiState.relayYamlText));
    renderRelaySection();
    renderFlowPreview();
    setStatus("relayStatus", "success", `✓ 追加 ${state.relayProxies.length} 个额外 Relay 节点`);
    resetOutput();
  } catch (error) {
    replaceExtraRelayProxies([], { selectNew: false });
    renderRelaySection();
    renderFlowPreview();
    setStatus("relayStatus", "error", `✗ ${error.message}`);
  }
}

function handleRelayClear() {
  uiState.relayYamlText = "";
  replaceExtraRelayProxies([], { selectNew: false });
  $("relayYamlInput").value = "";
  renderRelaySection();
  renderFlowPreview();
  clearStatus("relayStatus");
  resetOutput();
}

function handleGenerate() {
  if (!state.originalConfig || typeof state.originalConfig !== "object") {
    return;
  }

  resetOutput();

  try {
    uiState.relayYamlText = $("relayYamlInput").value;
    if (uiState.relayYamlText.trim()) {
      replaceExtraRelayProxies(resolveRelayProxiesFromText(uiState.relayYamlText));
      renderRelaySection();
      renderFlowPreview();
    } else {
      replaceExtraRelayProxies([], { selectNew: false });
      renderRelaySection();
      renderFlowPreview();
    }
    clearStatus("relayStatus");

    const preparedTargets = buildPreparedTargetProxies();
    const ignoredTargets = state.targetProxies.length - preparedTargets.length;
    const { selectedRulePacks, extraLines, enabledTargets } = materializeRulePacks();
    const buildState = {
      ...state,
      originalConfig: {
        ...structuredClone(state.originalConfig),
        ...collectBaseConfig(),
      },
      ordinaryGroups: buildPreparedOrdinaryGroups(),
      upstreamProxies: state.upstreamProxies.map(proxy => structuredClone(proxy)),
      relayProxies: state.relayProxies.map(proxy => structuredClone(proxy)),
      relayProxyNames: [...state.relayProxyNames],
      targetProxies: preparedTargets,
      selectedProviders: { ...state.selectedProviders },
      selectedRulePacks,
      customRules: [...state.customRules, ...extraLines],
    };

    const { config, summary } = buildClashmateConfig(buildState);

    $("yamlOutput").hidden = false;
    $("yamlOutput").textContent = yaml.dump(config, { lineWidth: -1 });
    $("copyBtn").hidden = false;
    $("downloadBtn").hidden = false;
    renderSummary(summary, {
      enabledTargets,
      ignoredTargets,
      relayGroupType: buildState.relayGroupType,
    });
  } catch (error) {
    $("resultError").hidden = false;
    $("resultError").textContent = error.message;
  }
}

$("fetchBtn").addEventListener("click", handleFetch);
$("fileInput").addEventListener("change", handleFileUpload);
$("configUrl").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    handleFetch();
  }
});

$("addGroupBtn").addEventListener("click", () => {
  state.ordinaryGroups.push(createCustomOrdinaryGroup(getUpstreamProxyNames()));
  renderOrdinaryGroups();
  renderRulePacks();
  renderProviders();
  resetOutput();
});

$("relayGroupName").addEventListener("input", event => {
  const nextName = event.target.value.trim();
  const oldName = state.relayGroup;
  state.relayGroup = nextName;
  syncRelayGroupReferences(oldName, nextName);
  renderTargetProxies();
  renderFlowPreview();
  renderRulePacks();
  renderProviders();
  resetOutput();
});

$("relayGroupType").addEventListener("change", event => {
  state.relayGroupType = event.target.value;
  resetOutput();
});

$("relayYamlInput").addEventListener("input", event => {
  uiState.relayYamlText = event.target.value;
  replaceExtraRelayProxies([], { selectNew: false });
  renderRelaySection();
  renderFlowPreview();
  clearStatus("relayStatus");
  resetOutput();
});

$("relaySelectAllBtn").addEventListener("click", () => {
  setRelayProxyNames(getRelayCandidateNames());
  renderRelaySection();
  renderFlowPreview();
  resetOutput();
});

$("relayClearSelectionBtn").addEventListener("click", () => {
  state.relayProxyNames = [];
  renderRelaySection();
  renderFlowPreview();
  resetOutput();
});

$("parseRelayBtn").addEventListener("click", handleRelayParse);
$("clearRelayBtn").addEventListener("click", handleRelayClear);

$("aiRelayGroupName").addEventListener("input", event => {
  const nextName = event.target.value.trim();
  const oldName = state.aiRelayGroup;
  state.aiRelayGroup = nextName;
  syncAiRelayReferences(oldName, nextName);
  renderFlowPreview();
  renderRulePacks();
  renderProviders();
  resetOutput();
});

$("addTargetBtn").addEventListener("click", () => {
  state.targetProxies.push(createDefaultTargetProxyDraft(state.relayGroup));
  renderTargetProxies();
  renderFlowPreview();
  resetOutput();
});

$("customRulesInput").addEventListener("input", event => {
  state.customRules = event.target.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  resetOutput();
});

$("selectAllProviders").addEventListener("click", () => {
  Object.values(RULES_DEF)
    .flat()
    .forEach(rule => {
      state.selectedProviders[rule.name] = state.selectedProviders[rule.name] || defaultProviderTarget(rule);
    });
  renderProviders();
  resetOutput();
});

$("clearProviders").addEventListener("click", () => {
  state.selectedProviders = {};
  renderProviders();
  resetOutput();
});

$("generateBtn").addEventListener("click", handleGenerate);

["cfgPort", "cfgSocksPort", "cfgAllowLan", "cfgMode", "cfgLogLevel", "cfgController"].forEach(id => {
  $(id).addEventListener("input", resetOutput);
  $(id).addEventListener("change", resetOutput);
});

$("copyBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("yamlOutput").textContent);
  $("copyBtn").textContent = "已复制";
  setTimeout(() => {
    $("copyBtn").textContent = "复制";
  }, 1500);
});

$("downloadBtn").addEventListener("click", () => {
  const blob = new Blob([$("yamlOutput").textContent], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "config.yaml";
  anchor.click();
  URL.revokeObjectURL(url);
});

resetOutput();
