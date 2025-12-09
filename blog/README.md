# Blog 项目说明

托管于 GitHub Pages 的个人博客。

## 风格指南

详见 [style.md](style.md)

## 目录结构

```
blog/
├── index.html              # 博客列表首页，展示所有文章
├── README.md               # 项目说明（本文件）
├── style.md                # 页面风格指南
└── YYYY/                   # 年份目录
    └── MM/                 # 月份目录
        └── DD/             # 日期目录
            ├── index.md    # 文章 Markdown 源文件
            ├── index.html  # 文章 HTML 页面
            └── images/     # 文章配图
```

## 工作流程

### 发布新文章

#### 方法1: 直接在项目中编辑

1. 根据当前日期, 创建目录 `blog/YYYY/MM/DD/`, 如果已经存在, 则DD+1, 确保文件夹不重复
2. 编写 `index.md` 文章内容
3. 将 `index.md` 转换为 `index.html`（参考 style.md）
4. 更新 `blog/index.html` 添加文章条目（最新文章在最上面）

#### 方法2: 基于wolai导出的markdown

1. 根据当前日期, 创建目录 `blog/YYYY/MM/DD/`, 如果已经存在, 则DD+1, 确保文件夹不重复
2. 对zip文件进行解压缩, 输出的文件夹名字不固定
3. 将解压缩文件中的md文件移动到 `blog/YYYY/MM/DD/index.md`
4. 将解压缩文件中的image移动到 `blog/YYYY/MM/DD/images`
5. 将 `index.md` 转换为 `index.html`（参考 style.md）
6. 更新 `blog/index.html` 添加文章条目（最新文章在最上面）

### Markdown 转 HTML 要点

- 读取 `index.md` 内容
- 按 style.md 风格生成 HTML
- 图片路径使用相对路径 `images/xxx.png`
- 返回链接使用 `../../../index.html`

### 更新首页列表

在 `blog/index.html` 的 `<ul class="blog-list">` 内添加条目：

```html
<li class="blog-item">
    <a href="YYYY/MM/DD/index.html">
        <h2>[ARTICLE] 文章标题</h2>
        <div class="blog-date">// YYYY-MM-DD</div>
        <p class="blog-excerpt">
            _INIT_ 文章摘要描述 _EOF_
        </p>
    </a>
</li>
```

## 现有文章

| 日期 | 标题 |
|------|------|
| 2025-12-10 | Clash配置 |
| 2025-12-09 | 科研人员科学上网指南 |
| 2025-12-08 | Git极简教程 |
| 2025-12-07 | uv管理Python环境极简教程 |
| 2025-11-30 | 网站开发历史调研报告 |
| 2025-11-29 | 2025年全球AI编程辅助工具全景研究报告 |
| 2025-11-28 | 早期AI编程辅助工具研究报告 (Pre-LLM) |
| 2025-11-27 | 加强版Python监控脚本 |
| 2025-11-07 | 不写一行代码，通过Claude Code搭建个人网站 |
