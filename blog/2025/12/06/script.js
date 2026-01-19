const data = {
    "browser": {
        title: "Web 浏览器",
        subtitle: "前端 / CLIENT SIDE",
        description: "浏览器是用户进入互联网的窗口。它的核心职责是向服务器发送请求，接收代码（HTML/CSS/JS），并将代码渲染成用户可见的图形界面。",
        analogy: "就像是“餐厅的服务员和菜单”。你（用户）坐在这里看菜单（页面），点菜（发送请求），最后服务员把做好的菜（数据）端上来给你享用。",
        tools: [
            { name: "Chrome (V8引擎)", color: "bg-blue-400" },
            { name: "Firefox", color: "bg-orange-400" },
            { name: "Safari (WebKit)", color: "bg-slate-400" },
            { name: "Edge", color: "bg-blue-600" }
        ],
        concepts: [
            { name: "DOM 渲染", color: "bg-orange-400" },
            { name: "JavaScript 引擎", color: "bg-yellow-400" },
            { name: "本地存储 (Cookies/LocalStorage)", color: "bg-purple-400" },
            { name: "DevTools 调试器", color: "bg-green-400" }
        ],
        icon: "monitor",
        bannerGradient: "from-blue-900 to-slate-800"
    },
    "html-css-js": {
        title: "HTML/CSS/JS",
        subtitle: "前端 / CLIENT SIDE",
        description: "Web 开发的基石。HTML 定义网页结构，CSS 负责样式和布局，JavaScript 实现交互和动态功能。",
        analogy: "就像是房子的“骨架（HTML）、装修（CSS）和电器（JS）”。骨架决定房间布局，装修决定好看程度，电器决定能不能住得舒服。",
        tools: [
            { name: "HTML5", color: "bg-orange-500" },
            { name: "CSS3", color: "bg-blue-500" },
            { name: "ES6+", color: "bg-yellow-400" },
            { name: "TypeScript", color: "bg-blue-600" }
        ],
        concepts: [
            { name: "语义化标签", color: "bg-red-400" },
            { name: "Flexbox/Grid", color: "bg-blue-400" },
            { name: "事件循环", color: "bg-yellow-500" },
            { name: "原型链", color: "bg-yellow-600" }
        ],
        icon: "code-2",
        bannerGradient: "from-orange-800 to-red-900"
    },
    "frameworks": {
        title: "前端框架",
        subtitle: "前端 / CLIENT SIDE",
        description: "现代 Web 开发的加速器。提供组件化开发模式、状态管理和路由功能，极大提高了开发效率和应用性能。",
        analogy: "就像是“预制菜和流水线厨房”。不需要从头切菜洗菜（原生JS），直接用半成品（组件）快速组装出一桌大餐。",
        tools: [
            { name: "React", color: "bg-cyan-400" },
            { name: "Vue.js", color: "bg-emerald-500" },
            { name: "Angular", color: "bg-red-600" },
            { name: "Svelte", color: "bg-orange-500" }
        ],
        concepts: [
            { name: "组件化", color: "bg-blue-400" },
            { name: "虚拟 DOM", color: "bg-purple-400" },
            { name: "状态管理", color: "bg-green-400" },
            { name: "SPA 单页应用", color: "bg-indigo-400" }
        ],
        icon: "layout",
        bannerGradient: "from-cyan-900 to-blue-900"
    },
    "dns": {
        title: "域名 & DNS",
        subtitle: "网络 / NETWORK",
        description: "互联网的地址簿。将人类可读的域名（google.com）转换为机器可读的 IP 地址（142.250.1.1）。",
        analogy: "就像是“手机通讯录”。你只需要记住朋友的名字（域名），不需要记住那串长长的电话号码（IP地址），通讯录会自动帮你拨通。",
        tools: [
            { name: "Cloudflare", color: "bg-orange-500" },
            { name: "GoDaddy", color: "bg-green-600" },
            { name: "Route53", color: "bg-yellow-500" },
            { name: "Namecheap", color: "bg-red-500" }
        ],
        concepts: [
            { name: "A 记录 / CNAME", color: "bg-blue-400" },
            { name: "DNS 缓存", color: "bg-purple-400" },
            { name: "TTL", color: "bg-green-400" },
            { name: "根域名服务器", color: "bg-slate-500" }
        ],
        icon: "tag",
        bannerGradient: "from-purple-900 to-indigo-900"
    },
    "http": {
        title: "HTTP/HTTPS",
        subtitle: "网络 / NETWORK",
        description: "Web 通信的通用语言。定义了客户端和服务器之间交换数据的格式和规则。",
        analogy: "就像是“寄信的格式规范”。信封怎么写、邮票贴哪、内容怎么折，大家都按这个标准来，信才能准确寄到并被读懂。",
        tools: [
            { name: "Postman", color: "bg-orange-500" },
            { name: "Wireshark", color: "bg-blue-600" },
            { name: "Curl", color: "bg-slate-600" },
            { name: "SSL/TLS证书", color: "bg-green-500" }
        ],
        concepts: [
            { name: "GET / POST", color: "bg-blue-400" },
            { name: "状态码 (200/404)", color: "bg-yellow-400" },
            { name: "Header / Body", color: "bg-purple-400" },
            { name: "RESTful API", color: "bg-green-400" }
        ],
        icon: "arrow-left-right",
        bannerGradient: "from-slate-800 to-gray-900"
    },
    "cdn": {
        title: "CDN 内容分发",
        subtitle: "网络 / NETWORK",
        description: "内容分发网络。通过在全球部署边缘节点，将内容缓存到离用户最近的地方，加速访问。",
        analogy: "就像是“连锁便利店”。如果你想买可乐，不用跑去位于总部的工厂买，直接去楼下的便利店（边缘节点）就能买到。",
        tools: [
            { name: "Cloudflare", color: "bg-orange-500" },
            { name: "AWS CloudFront", color: "bg-blue-500" },
            { name: "Akamai", color: "bg-blue-700" },
            { name: "阿里云 CDN", color: "bg-orange-600" }
        ],
        concepts: [
            { name: "边缘节点", color: "bg-green-400" },
            { name: "缓存命中率", color: "bg-blue-400" },
            { name: "回源", color: "bg-red-400" },
            { name: "静态资源加速", color: "bg-purple-400" }
        ],
        icon: "zap",
        bannerGradient: "from-orange-800 to-yellow-900"
    },
    "web-server": {
        title: "Web 服务器 (网关)",
        subtitle: "后端 / INFRASTRUCTURE",
        description: "这是请求到达服务器的第一道门。它负责处理静态文件（图片、CSS）、负载均衡（分发流量）以及反向代理（把请求转给Django/Node）。",
        analogy: "公司前台：客户（请求）来了，前台（Nginx）先接待。如果是取快递（静态文件），前台直接给你；如果是谈业务，前台把你带到会议室找专员（应用服务器）。",
        tools: [
            { name: "Nginx", color: "bg-green-600" },
            { name: "Apache", color: "bg-red-600" },
            { name: "Caddy", color: "bg-blue-500" },
            { name: "IIS", color: "bg-blue-400" }
        ],
        concepts: [
            { name: "反向代理 (Reverse Proxy)", color: "bg-orange-400" },
            { name: "负载均衡 (Load Balancing)", color: "bg-orange-400" },
            { name: "静态资源托管", color: "bg-orange-400" },
            { name: "HTTPS配置", color: "bg-orange-400" }
        ],
        icon: "door-open",
        bannerGradient: "from-green-900 to-teal-900"
    },
    "app-server": {
        title: "应用服务器 (逻辑)",
        subtitle: "后端 / SERVER",
        description: "业务逻辑的核心。运行后端代码，处理复杂计算，通过数据库存取数据，生成动态内容。",
        analogy: "就像是“后厨的厨师”。根据前台传来的菜单（请求），进行切配烹饪（逻辑处理），最后做好菜（响应内容）。",
        tools: [
            { name: "Node.js", color: "bg-green-500" },
            { name: "Python (Django/Flask)", color: "bg-blue-500" },
            { name: "Java (Spring)", color: "bg-red-500" },
            { name: "Go (Gin)", color: "bg-cyan-500" }
        ],
        concepts: [
            { name: "MVC 架构", color: "bg-blue-400" },
            { name: "API 接口设计", color: "bg-green-400" },
            { name: "中间件", color: "bg-yellow-400" },
            { name: "微服务", color: "bg-purple-400" }
        ],
        icon: "settings",
        bannerGradient: "from-slate-800 to-green-900"
    },
    "db-sql": {
        title: "关系型数据库",
        subtitle: "数据 / DATA",
        description: "结构化数据存储。使用表格存储数据，支持复杂的关联查询和事务，保证数据的一致性。",
        analogy: "就像是“严谨的财务账本”。每一笔账都必须按规定的格式记录，确保账目清晰，一分钱都不能差。",
        tools: [
            { name: "MySQL", color: "bg-blue-600" },
            { name: "PostgreSQL", color: "bg-blue-400" },
            { name: "Oracle", color: "bg-red-600" },
            { name: "SQL Server", color: "bg-slate-600" }
        ],
        concepts: [
            { name: "SQL 语法", color: "bg-blue-400" },
            { name: "ACID 事务", color: "bg-green-400" },
            { name: "索引优化", color: "bg-yellow-400" },
            { name: "表关联 (Join)", color: "bg-purple-400" }
        ],
        icon: "database",
        bannerGradient: "from-blue-900 to-indigo-900"
    },
    "db-nosql": {
        title: "NoSQL 数据库",
        subtitle: "数据 / DATA",
        description: "非关系型数据库。灵活的数据模型，适合存储大规模、非结构化或半结构化的数据，读写性能高。",
        analogy: "就像是“随手记的便签本”。想记什么记什么，不需要固定的格式，写起来快，翻起来也方便。",
        tools: [
            { name: "MongoDB", color: "bg-green-500" },
            { name: "Cassandra", color: "bg-blue-500" },
            { name: "DynamoDB", color: "bg-blue-700" },
            { name: "Couchbase", color: "bg-red-500" }
        ],
        concepts: [
            { name: "文档存储", color: "bg-yellow-400" },
            { name: "键值对", color: "bg-blue-400" },
            { name: "最终一致性", color: "bg-purple-400" },
            { name: "分片 (Sharding)", color: "bg-green-400" }
        ],
        icon: "file-json",
        bannerGradient: "from-green-800 to-emerald-900"
    },
    "db-cache": {
        title: "缓存 (Cache)",
        subtitle: "数据 / DATA",
        description: "高速数据存储层。通常基于内存，用于存储频繁访问的数据，以减少对数据库的访问，极大提高响应速度。",
        analogy: "就像是“常用的调料盒”。大厨把最常用的盐和油放在手边，不用每次都去仓库里翻找，做菜速度自然就快了。",
        tools: [
            { name: "Redis", color: "bg-red-600" },
            { name: "Memcached", color: "bg-green-500" },
            { name: "Varnish", color: "bg-blue-500" },
            { name: "Ehcache", color: "bg-yellow-600" }
        ],
        concepts: [
            { name: "键值存储", color: "bg-blue-400" },
            { name: "过期策略", color: "bg-yellow-400" },
            { name: "缓存击穿/雪崩", color: "bg-red-400" },
            { name: "持久化", color: "bg-green-400" }
        ],
        icon: "zap",
        bannerGradient: "from-red-900 to-orange-900"
    },
    "linux": {
        title: "操作系统 (Linux)",
        subtitle: "基础设施 / INFRASTRUCTURE",
        description: "服务器的基础软件环境。绝大多数Web服务器都运行在Linux上（如Ubuntu, CentOS）。开发者通过命令行与之交互。",
        analogy: "地基和水电：不仅是电脑的系统，更是整个服务运行的土壤。没有它，上层的所有程序都无法运行。",
        tools: [
            { name: "Ubuntu", color: "bg-orange-500" },
            { name: "CentOS", color: "bg-blue-600" },
            { name: "Debian", color: "bg-red-600" },
            { name: "Bash / Shell", color: "bg-slate-600" }
        ],
        concepts: [
            { name: "文件权限", color: "bg-yellow-500" },
            { name: "SSH 远程连接", color: "bg-blue-500" },
            { name: "进程管理", color: "bg-green-500" },
            { name: "Cron 定时任务", color: "bg-purple-500" }
        ],
        icon: "terminal",
        bannerGradient: "from-green-900 to-slate-900"
    },
    "docker": {
        title: "Docker & 容器化",
        subtitle: "DEVOPS / TOOLS",
        description: "一种打包技术。把代码和它运行所需的所有环境（系统库、配置）打包在一个“容器”里，保证在任何机器上跑起来效果都一样。",
        analogy: "集装箱：以前运输货物（代码）很麻烦，散装容易坏。现在把货物装进标准集装箱（Docker容器），无论是卡车、轮船还是火车（不同的服务器），都能直接运。",
        tools: [
            { name: "Docker", color: "bg-blue-500" },
            { name: "Kubernetes (K8s)", color: "bg-blue-700" },
            { name: "Docker Compose", color: "bg-indigo-500" },
            { name: "Podman", color: "bg-purple-600" }
        ],
        concepts: [
            { name: "镜像 (Image)", color: "bg-blue-400" },
            { name: "容器 (Container)", color: "bg-green-400" },
            { name: "微服务架构", color: "bg-orange-400" },
            { name: "环境隔离", color: "bg-red-400" }
        ],
        icon: "package",
        bannerGradient: "from-blue-800 to-cyan-900"
    },
    "git": {
        title: "Git 版本控制",
        subtitle: "DEVOPS / TOOLS",
        description: "代码的时光机。它记录了代码的每一次修改，允许团队协作，同时如果不小心改坏了，可以随时回滚到以前的版本。",
        analogy: "游戏的存档点：打Boss前存个档（Commit），如果挂了（代码写崩了），直接读取存档（Revert），不用从头再来。",
        tools: [
            { name: "Git", color: "bg-orange-600" },
            { name: "GitHub", color: "bg-slate-800" },
            { name: "GitLab", color: "bg-orange-500" },
            { name: "Bitbucket", color: "bg-blue-600" }
        ],
        concepts: [
            { name: "Commit (提交)", color: "bg-green-500" },
            { name: "Branch (分支)", color: "bg-purple-500" },
            { name: "Merge (合并)", color: "bg-blue-500" },
            { name: "Pull Request", color: "bg-orange-500" }
        ],
        icon: "git-branch",
        bannerGradient: "from-slate-800 to-stone-900"
    },
    "cloud": {
        title: "云计算服务",
        subtitle: "基础设施 / INFRASTRUCTURE",
        description: "通过互联网提供计算资源（服务器、数据库、存储）。不需要自己买物理服务器，按需付费，随时扩展。",
        analogy: "共享单车/电网：不需要自己买发电机，插上插座就能用电；不需要自己买车，扫码就能骑走。省去了维护硬件的麻烦。",
        tools: [
            { name: "AWS", color: "bg-orange-500" },
            { name: "阿里云", color: "bg-orange-600" },
            { name: "Google Cloud", color: "bg-blue-500" },
            { name: "Azure", color: "bg-blue-600" }
        ],
        concepts: [
            { name: "弹性伸缩", color: "bg-blue-400" },
            { name: "按需付费", color: "bg-green-400" },
            { name: "Serverless", color: "bg-purple-400" },
            { name: "云原生", color: "bg-cyan-400" }
        ],
        icon: "cloud",
        bannerGradient: "from-orange-800 to-blue-900"
    },
    "cicd": {
        title: "CI/CD 自动化",
        subtitle: "DEVOPS / AUTOMATION",
        description: "持续集成与持续部署。让代码的测试、构建、发布过程自动化，减少人工错误，提高发布频率。",
        analogy: "汽车流水线：以前造车是手工敲打，现在是全自动机械臂流水线，从零件到整车下线，既快又标准，还能自动检测质量。",
        tools: [
            { name: "Jenkins", color: "bg-slate-600" },
            { name: "GitHub Actions", color: "bg-blue-600" },
            { name: "GitLab CI", color: "bg-orange-600" },
            { name: "CircleCI", color: "bg-green-600" }
        ],
        concepts: [
            { name: "自动化测试", color: "bg-green-400" },
            { name: "构建流水线", color: "bg-blue-400" },
            { name: "蓝绿部署", color: "bg-teal-400" },
            { name: "灰度发布", color: "bg-purple-400" }
        ],
        icon: "rocket",
        bannerGradient: "from-indigo-900 to-purple-900"
    }
};

const rightPanel = document.querySelector('.w-5\\/12'); // Select right panel
let activeItem = 'browser';

function renderRightPanel(key) {
    const item = data[key];
    if (!item) return;

    // Update banner gradient
    const banner = rightPanel.querySelector('.bg-gradient-to-br');
    banner.className = `h-48 bg-gradient-to-br ${item.bannerGradient} relative overflow-hidden shrink-0 transition-colors duration-500`;
    
    // Update texts
    rightPanel.querySelector('.text-sm.font-medium').textContent = item.subtitle;
    rightPanel.querySelector('h2.text-4xl').textContent = item.title;
    
    // Update Description
    rightPanel.querySelector('p.leading-relaxed').textContent = item.description;

    // Update Analogy
    rightPanel.querySelector('.bg-blue-50 p').textContent = item.analogy;

    // Update Big Icon
    const bigIconContainer = rightPanel.querySelector('.absolute.top-6.right-6');
    bigIconContainer.innerHTML = `<i data-lucide="${item.icon}" class="w-32 h-32"></i>`;

    // Update Lists
    const lists = rightPanel.querySelectorAll('ul');
    
    // Tools List
    lists[0].innerHTML = item.tools.map(tool => `
        <li class="flex items-center gap-2 text-base text-slate-600">
            <span class="w-1.5 h-1.5 rounded-full ${tool.color}"></span>
            ${tool.name}
        </li>
    `).join('');

    // Concepts List
    lists[1].innerHTML = item.concepts.map(concept => `
        <li class="flex items-center gap-2 text-base text-slate-600">
            <span class="w-1.5 h-1.5 rounded-full ${concept.color}"></span>
            ${concept.name}
        </li>
    `).join('');

    // Refresh Icons
    lucide.createIcons();
}

// Simulation Logic
async function simulateRequest() {
    const steps = ['browser', 'dns', 'web-server', 'app-server', 'db-sql'];
    const originalActive = activeItem;
    
    // Disable button
    const btn = document.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 请求中...`;
    lucide.createIcons();

    // Helper to wait
    const wait = ms => new Promise(r => setTimeout(r, ms));

    for (const step of steps) {
        // Highlight element
        const el = document.querySelector(`[data-key="${step}"]`);
        if (el) {
            el.click(); // This triggers the panel update and selection style
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add extra highlight effect
            el.classList.add('ring-4', 'ring-indigo-400', 'ring-opacity-50', 'scale-105');
            await wait(1500);
            el.classList.remove('ring-4', 'ring-indigo-400', 'ring-opacity-50', 'scale-105');
        }
    }

    // Restore
    btn.disabled = false;
    btn.innerHTML = originalText;
    lucide.createIcons();
    
    // Restore original view or stay at last? Let's stay at last or go back to browser.
    // Let's go back to browser to reset the cycle
    document.querySelector(`[data-key="browser"]`).click();
}

// Add click listener to simulation button
document.querySelector('button').addEventListener('click', simulateRequest);

// Add click listeners to all clickable items
document.querySelectorAll('[data-key]').forEach(el => {
    el.addEventListener('click', () => {
        const key = el.getAttribute('data-key');
        activeItem = key;
        
        // Remove active class from all
        document.querySelectorAll('[data-key]').forEach(item => {
            if(item.classList.contains('border-2')) {
                item.classList.remove('border-2', 'border-blue-400');
                item.classList.add('border', 'border-slate-200');
            }
            // For the green/server ones that have different styling
            if(item.closest('.bg-green-100\\/50')) {
                 // Reset server items specific styles if needed, 
                 // but for simplicity let's stick to the card style changes
            }
        });

        // Add active style to clicked
        // Simple logic: if it's one of the white cards
        if (el.classList.contains('bg-white')) {
            el.classList.remove('border', 'border-slate-200');
            el.classList.add('border-2', 'border-blue-400'); // Or dynamic color based on section
        }

        renderRightPanel(key);
    });
});

// Initial Render
renderRightPanel('browser');
