// 规则定义
const RULES_DEF = {
  '过滤': [
    { name: 'AdBlock', defaultAction: 'REJECT' },
    { name: 'HTTPDNS', defaultAction: 'REJECT' },
  ],
  '国际流媒体': [
    { name: 'Netflix', defaultAction: 'Proxy' },
    { name: 'YouTube', defaultAction: 'Proxy' },
    { name: 'Spotify', defaultAction: 'Proxy' },
    { name: 'Disney Plus', defaultAction: 'Proxy' },
    { name: 'Max', defaultAction: 'Proxy' },
    { name: 'Amazon', defaultAction: 'Proxy' },
    { name: 'Apple TV', defaultAction: 'Proxy' },
    { name: 'Hulu', defaultAction: 'Proxy' },
    { name: 'BBC iPlayer', defaultAction: 'Proxy' },
    { name: 'Bahamut', defaultAction: 'Proxy' },
  ],
  '国内流媒体': [
    { name: 'Bilibili', defaultAction: 'DIRECT' },
    { name: 'IQIYI', defaultAction: 'DIRECT' },
    { name: 'Youku', defaultAction: 'DIRECT' },
    { name: 'Tencent Video', defaultAction: 'DIRECT' },
    { name: 'Netease Music', defaultAction: 'DIRECT' },
  ],
  '社交通讯': [
    { name: 'Telegram', defaultAction: 'Proxy' },
    { name: 'Discord', defaultAction: 'Proxy' },
    { name: 'TikTok', defaultAction: 'Proxy' },
  ],
  '服务': [
    { name: 'AI Suite', defaultAction: 'Proxy' },
    { name: 'Microsoft', defaultAction: 'Proxy' },
    { name: 'Apple', defaultAction: 'Proxy' },
    { name: 'Google FCM', defaultAction: 'Proxy' },
    { name: 'Steam', defaultAction: 'DIRECT' },
    { name: 'PayPal', defaultAction: 'Proxy' },
    { name: 'Scholar', defaultAction: 'Proxy' },
    { name: 'miHoYo', defaultAction: 'DIRECT' },
  ],
  '通用': [
    { name: 'Special', defaultAction: 'DIRECT' },
    { name: 'PROXY', defaultAction: 'Proxy' },
    { name: 'Domestic', defaultAction: 'DIRECT' },
    { name: 'Domestic IPs', defaultAction: 'DIRECT' },
    { name: 'LAN', defaultAction: 'DIRECT' },
  ],
};

// URL 映射
const PROVIDER_URLS = {
  AdBlock: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/AdBlock.yaml',
  HTTPDNS: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/HTTPDNS.yaml',
  Special: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Special.yaml',
  PROXY: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Proxy.yaml',
  Domestic: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Domestic.yaml',
  'Domestic IPs': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Domestic%20IPs.yaml',
  LAN: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/LAN.yaml',
  Netflix: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Netflix.yaml',
  Spotify: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Spotify.yaml',
  YouTube: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/YouTube.yaml',
  Max: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Max.yaml',
  Bilibili: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Bilibili.yaml',
  IQIYI: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/IQIYI.yaml',
  'Netease Music': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Netease%20Music.yaml',
  'Tencent Video': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Tencent%20Video.yaml',
  Youku: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Youku.yaml',
  Amazon: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Amazon.yaml',
  'Apple TV': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Apple%20TV.yaml',
  Bahamut: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Bahamut.yaml',
  'BBC iPlayer': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/BBC%20iPlayer.yaml',
  'Disney Plus': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Disney%20Plus.yaml',
  Hulu: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Media/Hulu.yaml',
  Telegram: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Telegram.yaml',
  Discord: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Discord.yaml',
  Steam: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Steam.yaml',
  TikTok: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/TikTok.yaml',
  PayPal: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/PayPal.yaml',
  Microsoft: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Microsoft.yaml',
  'AI Suite': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/AI%20Suite.yaml',
  Apple: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Apple.yaml',
  'Google FCM': 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Google%20FCM.yaml',
  Scholar: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/Scholar.yaml',
  miHoYo: 'https://raw.dler.io/dler-io/Rules/main/Clash/Provider/miHoYo.yaml',
};

const $ = id => document.getElementById(id);

let originalConfig = null;
let proxyNames = []; // 包含获取的节点 + 手动添加的节点
let fetchedProxyNames = []; // 仅从URL/文件获取的节点名
let proxyGroups = [];
let manualProxies = []; // 手动添加的节点

// 获取远程配置
const fetchConfig = async url => {
  const proxies = [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const makeUrl of proxies) {
    try {
      const res = await fetch(makeUrl(url));
      if (res.ok) return await res.text();
    } catch {}
  }
  const direct = await fetch(url);
  if (direct.ok) return await direct.text();
  throw new Error('无法获取配置');
};

// 更新所有节点名列表
const updateProxyNames = () => {
  proxyNames = [...fetchedProxyNames, ...manualProxies.map(p => p.name)];
};

// 处理配置文本
const processConfig = text => {
  const config = jsyaml.load(text);
  if (!config?.proxies?.length) {
    throw new Error('未找到节点');
  }
  
  originalConfig = config;
  fetchedProxyNames = config.proxies.map(p => p.name);
  updateProxyNames();
  
  // 默认创建 Auto 组
  proxyGroups = [{
    name: 'Auto',
    type: 'url-test',
    proxies: [...proxyNames],
  }];

  // 填充基础配置到输入框
  if (config.port) $('cfgPort').value = config.port;
  if (config['socks-port']) $('cfgSocksPort').value = config['socks-port'];
  if (config['allow-lan'] !== undefined) $('cfgAllowLan').value = config['allow-lan'] ? 'true' : 'false';
  if (config.mode) $('cfgMode').value = config.mode;
  if (config['log-level']) $('cfgLogLevel').value = config['log-level'];
  if (config['external-controller']) $('cfgController').value = config['external-controller'];

  renderProxyList();
  renderManualProxies();
  renderGroups();
  renderRules();
  
  $('manualProxySection').hidden = false;
  $('groupsSection').hidden = false;
  $('rulesSection').hidden = false;
  $('outputSection').hidden = false;
  
  return proxyNames.length;
};

// 渲染节点列表
const renderProxyList = () => {
  $('proxyList').hidden = false;
  $('proxyList').innerHTML = proxyNames.map(n => 
    `<span class="proxy-tag">${n}</span>`
  ).join('');
};

// 渲染代理组
const renderGroups = () => {
  const container = $('groupsContainer');
  container.innerHTML = '';
  
  proxyGroups.forEach((g, idx) => {
    const div = document.createElement('div');
    div.className = 'group-item';
    
    const isAuto = g.name === 'Auto' && idx === 0;
    
    div.innerHTML = `
      <div class="group-header">
        <input type="text" class="group-name" value="${g.name}" placeholder="组名" ${isAuto ? 'readonly' : ''}>
        <select class="group-type">
          <option value="url-test" ${g.type === 'url-test' ? 'selected' : ''}>url-test</option>
          <option value="select" ${g.type === 'select' ? 'selected' : ''}>select</option>
          <option value="fallback" ${g.type === 'fallback' ? 'selected' : ''}>fallback</option>
          <option value="load-balance" ${g.type === 'load-balance' ? 'selected' : ''}>load-balance</option>
        </select>
        <button class="btn-sm select-all-proxies">全选</button>
        <button class="btn-sm invert-proxies">反选</button>
        ${!isAuto ? '<button class="btn-sm btn-danger del-group">删除</button>' : ''}
          </div>
      <div class="group-proxies">
        ${proxyNames.map(p => `
          <label class="proxy-checkbox ${g.proxies.includes(p) ? 'selected' : ''}">
            <input type="checkbox" value="${p}" ${g.proxies.includes(p) ? 'checked' : ''}>
            ${p}
            </label>
        `).join('')}
        </div>
      `;
    
    // 绑定事件
    const nameInput = div.querySelector('.group-name');
    nameInput.addEventListener('input', e => {
      proxyGroups[idx].name = e.target.value;
      renderRules();
      renderManualProxies();
    });
    
    const typeSelect = div.querySelector('.group-type');
    typeSelect.addEventListener('change', e => {
      proxyGroups[idx].type = e.target.value;
    });
    
    const delBtn = div.querySelector('.del-group');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        proxyGroups.splice(idx, 1);
        renderGroups();
        renderRules();
        renderManualProxies();
      });
    }
    
    // 全选
    div.querySelector('.select-all-proxies').addEventListener('click', () => {
      proxyGroups[idx].proxies = [...proxyNames];
      div.querySelectorAll('.proxy-checkbox').forEach(label => {
        label.classList.add('selected');
        label.querySelector('input').checked = true;
      });
    });
    
    // 反选
    div.querySelector('.invert-proxies').addEventListener('click', () => {
      div.querySelectorAll('.proxy-checkbox').forEach(label => {
        const checkbox = label.querySelector('input');
        checkbox.checked = !checkbox.checked;
        label.classList.toggle('selected', checkbox.checked);
      });
      proxyGroups[idx].proxies = proxyNames.filter(p => 
        div.querySelector(`input[value="${p}"]`).checked
      );
    });
    
    // 节点复选框
    div.querySelectorAll('.proxy-checkbox').forEach(label => {
      const checkbox = label.querySelector('input');
      label.addEventListener('click', e => {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        label.classList.toggle('selected', checkbox.checked);
        
        const proxyName = checkbox.value;
        if (checkbox.checked) {
          if (!proxyGroups[idx].proxies.includes(proxyName)) {
            proxyGroups[idx].proxies.push(proxyName);
          }
        } else {
          proxyGroups[idx].proxies = proxyGroups[idx].proxies.filter(x => x !== proxyName);
        }
      });
    });
    
    container.appendChild(div);
  });
};

// 新建分组
$('addGroupBtn').addEventListener('click', () => {
  proxyGroups.push({
    name: `Group${proxyGroups.length}`,
    type: 'select',
    proxies: [...proxyNames],
  });
  renderGroups();
  renderRules();
});

// 渲染手动添加的节点
const renderManualProxies = () => {
  const container = $('manualProxiesContainer');
  container.innerHTML = '';
  
  if (manualProxies.length === 0) return;
  
  // 可用的 dialer-proxy 选项
  const availableDialers = ['', 'DIRECT', ...proxyGroups.map(g => g.name).filter(Boolean), ...fetchedProxyNames];
  
  manualProxies.forEach((mp, idx) => {
    const div = document.createElement('div');
    div.className = 'manual-proxy-item';
    
    div.innerHTML = `
      <div class="proxy-header">
        <strong>节点 #${idx + 1}</strong>
        <select class="mp-type">
          <option value="socks5" ${mp.type === 'socks5' ? 'selected' : ''}>SOCKS5</option>
          <option value="http" ${mp.type === 'http' ? 'selected' : ''}>HTTP</option>
          <option value="trojan" ${mp.type === 'trojan' ? 'selected' : ''}>Trojan</option>
          <option value="ss" ${mp.type === 'ss' ? 'selected' : ''}>Shadowsocks</option>
        </select>
        <button class="btn-sm btn-danger del-manual">删除</button>
      </div>
      <div class="field-group">
        <label>名称 <input type="text" class="mp-name" value="${mp.name}" placeholder="MyProxy"></label>
        <label>服务器 <input type="text" class="mp-server" value="${mp.server}" placeholder="192.168.1.1"></label>
        <label>端口 <input type="number" class="mp-port" value="${mp.port}" placeholder="1080"></label>
        <label>用户名 <input type="text" class="mp-username" value="${mp.username || ''}" placeholder="可选"></label>
        <label>密码 <input type="text" class="mp-password" value="${mp.password || ''}" placeholder="可选"></label>
        <label>dialer-proxy
          <select class="mp-dialer">
            ${availableDialers.map(d => `<option value="${d}" ${d === (mp.dialerProxy || '') ? 'selected' : ''}>${d || '无'}</option>`).join('')}
          </select>
        </label>
      </div>
    `;
    
    // 绑定事件
    div.querySelector('.mp-type').addEventListener('change', e => {
      manualProxies[idx].type = e.target.value;
    });
    
    div.querySelector('.mp-dialer').addEventListener('change', e => {
      manualProxies[idx].dialerProxy = e.target.value;
    });
    
    div.querySelector('.del-manual').addEventListener('click', () => {
      manualProxies.splice(idx, 1);
      updateProxyNames();
      renderProxyList();
      renderManualProxies();
      renderGroups();
    });
    
    const nameInput = div.querySelector('.mp-name');
    nameInput.addEventListener('input', e => {
      const oldName = manualProxies[idx].name;
      const newName = e.target.value;
      manualProxies[idx].name = newName;
      
      // 更新代理组中的引用
      proxyGroups.forEach(g => {
        const oldIdx = g.proxies.indexOf(oldName);
        if (oldIdx !== -1) {
          g.proxies[oldIdx] = newName;
        }
      });
      
      updateProxyNames();
      renderProxyList();
      renderGroups();
    });
    
    div.querySelector('.mp-server').addEventListener('input', e => {
      manualProxies[idx].server = e.target.value;
    });
    
    div.querySelector('.mp-port').addEventListener('input', e => {
      manualProxies[idx].port = e.target.value;
    });
    
    div.querySelector('.mp-username').addEventListener('input', e => {
      manualProxies[idx].username = e.target.value;
    });
    
    div.querySelector('.mp-password').addEventListener('input', e => {
      manualProxies[idx].password = e.target.value;
    });
    
    container.appendChild(div);
  });
};

// 新建手动节点
$('addManualProxyBtn').addEventListener('click', () => {
  const newProxy = {
    name: `Manual${manualProxies.length + 1}`,
    type: 'socks5',
    server: '',
    port: '',
    username: '',
    password: '',
    dialerProxy: '',
  };
  manualProxies.push(newProxy);
  updateProxyNames();
  renderProxyList();
  renderManualProxies();
  renderGroups();
});

// 获取所有可用的代理选项
const getProxyOptions = () => {
  const options = ['DIRECT', 'REJECT'];
  proxyGroups.forEach(g => {
    if (g.name && !options.includes(g.name)) {
      options.push(g.name);
    }
  });
  return options;
};

// 渲染规则
const renderRules = () => {
  const options = getProxyOptions();
  
  let html = '';
  Object.entries(RULES_DEF).forEach(([category, rules]) => {
    html += `<div class="rule-category"><h3>${category}</h3>`;
    rules.forEach(rule => {
      const defaultVal = rule.defaultAction === 'REJECT' ? 'REJECT' 
        : rule.defaultAction === 'DIRECT' ? 'DIRECT' 
        : options.find(o => o !== 'DIRECT' && o !== 'REJECT') || 'DIRECT';
      
      html += `
        <div class="rule-row">
          <label>
            <input type="checkbox" data-rule="${rule.name}">
            ${rule.name}
          </label>
          <select data-rule-select="${rule.name}">
            ${options.map(o => `<option value="${o}" ${o === defaultVal ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
      `;
    });
    html += '</div>';
  });
  
  $('rulesContainer').innerHTML = html;
};

// 全选/清空
$('selectAll').addEventListener('click', () => {
  document.querySelectorAll('[data-rule]').forEach(cb => cb.checked = true);
});

$('selectNone').addEventListener('click', () => {
  document.querySelectorAll('[data-rule]').forEach(cb => cb.checked = false);
});

// URL 获取
$('fetchBtn').addEventListener('click', async () => {
  const url = $('configUrl').value.trim();
  if (!url) return;

  $('fetchBtn').disabled = true;
  $('proxyStatus').hidden = false;
  $('proxyStatus').className = 'status';
  $('proxyStatus').textContent = '正在获取...';

  try {
    const text = await fetchConfig(url);
    const count = processConfig(text);
    $('proxyStatus').className = 'status success';
    $('proxyStatus').textContent = `✓ 获取到 ${count} 个节点`;
  } catch (err) {
    $('proxyStatus').className = 'status error';
    $('proxyStatus').textContent = `✗ ${err.message}`;
  } finally {
    $('fetchBtn').disabled = false;
  }
});

// 文件上传
$('fileInput').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  $('proxyStatus').hidden = false;
  $('proxyStatus').className = 'status';
  $('proxyStatus').textContent = '正在读取文件...';
  
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const count = processConfig(evt.target.result);
      $('proxyStatus').className = 'status success';
      $('proxyStatus').textContent = `✓ 从文件读取 ${count} 个节点`;
    } catch (err) {
      $('proxyStatus').className = 'status error';
      $('proxyStatus').textContent = `✗ ${err.message}`;
    }
  };
  reader.readAsText(file);
});

// 生成配置
$('generateBtn').addEventListener('click', () => {
  if (!originalConfig) return;

  // 收集基础配置
  const baseConfig = {
    port: parseInt($('cfgPort').value) || 7893,
    'socks-port': parseInt($('cfgSocksPort').value) || 7894,
    'allow-lan': $('cfgAllowLan').value === 'true',
    mode: $('cfgMode').value,
    'log-level': $('cfgLogLevel').value,
    'external-controller': $('cfgController').value || '0.0.0.0:9090',
  };

  // 收集选中的规则
  const selectedRules = [];
  document.querySelectorAll('[data-rule]:checked').forEach(cb => {
    const name = cb.dataset.rule;
    const action = document.querySelector(`[data-rule-select="${name}"]`).value;
    selectedRules.push({ name, action });
  });

  // 构建手动添加的节点
  const manualProxyNodes = manualProxies
    .filter(mp => mp.name && mp.server && mp.port)
    .map(mp => {
      const node = {
        name: mp.name,
        type: mp.type,
        server: mp.server,
        port: parseInt(mp.port),
      };
      if (mp.username) node.username = mp.username;
      if (mp.password) node.password = mp.password;
      if (mp.dialerProxy) node['dialer-proxy'] = mp.dialerProxy;
      if (mp.type === 'socks5' || mp.type === 'trojan') {
        node.udp = true;
      }
      return node;
    });

  // 合并原始节点和手动节点
  const allProxies = [...originalConfig.proxies, ...manualProxyNodes];

  // 构建 proxy-groups
  const finalGroups = proxyGroups.filter(g => g.name && g.proxies.length).map(g => {
    const base = {
      name: g.name,
      type: g.type,
      proxies: g.proxies,
    };
    if (g.type === 'url-test' || g.type === 'fallback') {
      base.url = 'http://www.gstatic.com/generate_204';
      base.interval = 300;
    }
    return base;
  });

  // 构建 rule-providers
  const ruleProviders = {};
  selectedRules.forEach(r => {
    if (PROVIDER_URLS[r.name]) {
      ruleProviders[r.name] = {
        type: 'http',
        behavior: 'classical',
        url: PROVIDER_URLS[r.name],
        path: `./Rules/${r.name.replace(/\s+/g, '_')}`,
        interval: 86400,
      };
    }
  });

  // 构建 rules
  const rules = selectedRules
    .filter(r => PROVIDER_URLS[r.name])
    .map(r => `RULE-SET,${r.name},${r.action}`);
  rules.push('GEOIP,CN,DIRECT');
  rules.push('MATCH,Auto');

  // 组装配置（基础配置放在最前面）
  const config = {
    ...baseConfig,
    ...originalConfig,
    ...baseConfig, // 再次覆盖，确保基础配置优先
    proxies: allProxies,
    'proxy-groups': finalGroups,
    'rule-providers': ruleProviders,
    rules,
  };

  const yaml = jsyaml.dump(config, { lineWidth: -1 });
  
  $('yamlOutput').textContent = yaml;
  $('yamlOutput').hidden = false;
  $('copyBtn').hidden = false;
  $('downloadBtn').hidden = false;
});

// 复制
$('copyBtn').addEventListener('click', async () => {
  const yaml = $('yamlOutput').textContent;
  await navigator.clipboard.writeText(yaml);
  $('copyBtn').textContent = '已复制';
  setTimeout(() => $('copyBtn').textContent = '复制', 1500);
});

// 下载
$('downloadBtn').addEventListener('click', () => {
  const yaml = $('yamlOutput').textContent;
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.yaml';
  a.click();
  URL.revokeObjectURL(url);
});

// Enter 键
$('configUrl').addEventListener('keydown', e => e.key === 'Enter' && $('fetchBtn').click());
