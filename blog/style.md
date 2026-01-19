# Blog 风格指南

## 设计风格：Geek Terminal / Cyberpunk Hacker

### 核心美学
- **主题**: 模拟终端/黑客风格，深色背景配霓虹绿色
- **氛围**: 科技感、复古终端、赛博朋克

### 颜色方案
- 背景: `#1a1a1a` (深灰黑)
- 容器背景: `#222`
- 主色调: `#00ff00` (霓虹绿)
- 标题强调: `#00ffff` (青色)
- 正文: `#eee` (浅白)
- 次要文字: `#aaa` / `#666`

### 字体
- 使用等宽字体: `'Roboto Mono', monospace`
- 营造代码/终端感

### 视觉效果
- 霓虹发光阴影: `box-shadow: 0 0 20px rgba(0, 255, 0, 0.4)`
- 文字发光: `text-shadow: 0 0 5px #00ff00`
- 绿色边框: `border: 1px solid #00ff00`
- 左侧强调边框: `border-left: 3px solid #00ff00`

### 文案风格
- 使用终端提示符: `>>>`
- 标题格式: `[ARTICLE] 文章标题`
- 日期格式: `// 2025-12-09`
- 摘要包裹: `_INIT_ 内容描述 _EOF_`
- 按钮文字: 大写下划线连接，如 `RETURN_TO_BLOG_INDEX`

### 交互效果
- hover时上移+放大: `transform: translateY(-5px) scale(1.02)`
- hover时增强发光效果
- 按钮hover反转配色

### 代码块复制按钮

代码块需包裹在 `.code-block` 容器中，并添加复制按钮：

```html
<div class="code-block">
    <button class="copy-btn" onclick="copyCode(this)">COPY</button>
    <pre><code>代码内容</code></pre>
</div>
```

CSS 样式：
```css
.code-block {
    position: relative;
    margin: 20px 0;
}

.copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #00ff00;
    color: #1a1a1a;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.75em;
    font-weight: 700;
    transition: all 0.3s;
    opacity: 0;
}

.code-block:hover .copy-btn { opacity: 1; }
.copy-btn:hover { background: #1a1a1a; color: #00ff00; box-shadow: 0 0 10px rgba(0, 255, 0, 0.8); }
.copy-btn.copied { background: #00ffff; color: #1a1a1a; }

pre { padding-top: 35px; margin: 0; }  /* 为按钮留空间 */
```

JavaScript（放在 `</body>` 前）：
```javascript
<script>
function copyCode(btn) {
    const code = btn.nextElementSibling.querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'COPIED!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'COPY';
            btn.classList.remove('copied');
        }, 2000);
    });
}
</script>
```

### 文件结构
```
blog/
├── index.html          # 博客列表页
└── YYYY/MM/DD/
    ├── index.html      # 文章页
    └── images/         # 文章图片
```

### 返回链接路径
从 `blog/YYYY/MM/DD/index.html` 返回 `blog/index.html` 使用 `../../../index.html`

