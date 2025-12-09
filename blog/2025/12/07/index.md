# uv管理Python环境极简教程

用AI写Python代码的时候，经常需要安装各种包。传统的pip + venv组合用起来还行，但是速度太慢了。uv是Rust写的，安装包的速度能快10-100倍，体验提升非常明显。

## 安装uv

```bash
# Linux/Mac
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell), 更推荐WSL
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

安装完记得重启终端，或者 `source ~/.bashrc`。

## 配置镜像源

国内访问PyPI比较慢，可以配置国内镜像：

```bash
# 临时使用镜像
uv add --index-url https://pypi.tuna.tsinghua.edu.cn/simple requests

# 或者设置环境变量（推荐）
export UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple"

# 永久设置，加到 ~/.bashrc 或 ~/.zshrc
echo 'export UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple"' >> ~/.bashrc
```

常用国内镜像：
- 清华：`https://pypi.tuna.tsinghua.edu.cn/simple`
- 阿里云：`https://mirrors.aliyun.com/pypi/simple`
- 中科大：`https://pypi.mirrors.ustc.edu.cn/simple`

我一般直接设置环境变量，一劳永逸。

## 安装Python

uv本身是Rust写的，不依赖Python。如果你的系统里没有Python，或者想用uv管理Python版本：

```bash
# 安装最新稳定版Python
uv python install

# 安装指定版本
uv python install 3.12
uv python install 3.11

# 查看可安装的版本
uv python list --all-versions

# 查看已安装的版本
uv python list
```

装完之后，uv会自动使用对应的Python版本。


## 运行代码

```bash
# 运行Python脚本
uv run python main.py

# 运行Python模块
uv run python -m pytest
uv run python -m http.server 3001

# 指定Python版本运行
uv run --python 3.12 python main.py
uv run --python 3.11 python -m http.server 3001

# 直接运行命令行工具
uv run black .
```

注意：用 `uv run` 而不是 `uv python`。`uv python` 是管理Python版本的，`uv run` 才是运行代码的。

`uv run` 会自动激活虚拟环境，不需要手动 `source .venv/bin/activate`。如果没有指定版本，uv会使用项目固定的版本（`.python-version`文件）或系统默认版本。


## 创建项目

如果需要开发一个python项目, 建议一开始就用uv做环境管理

```bash
# 新建项目目录并初始化
uv init my-project
cd my-project

# 或者在现有目录初始化
cd existing-project
uv init
```

初始化后会生成 `pyproject.toml`，这是项目配置文件，类似于 `package.json`。

## 管理依赖

```bash
# 添加依赖
uv add requests
uv add pandas numpy

# 添加开发依赖
uv add --dev pytest black

# 移除依赖
uv remove requests

# 同步依赖（根据pyproject.toml安装所有包）
uv sync
```

我一般用 `uv add` 添加包，它会自动更新 `pyproject.toml` 和 `uv.lock`，比手动编辑方便。


## 切换Python版本

如果项目需要特定Python版本：

```bash
# 为当前项目固定Python版本
uv python pin 3.12

# 查看项目使用的版本
uv python find
```

固定版本后，会在项目目录生成 `.python-version` 文件，uv会自动使用这个版本。

## 迁移已有项目

如果项目里已经有 `requirements.txt`：

```bash
# 从requirements.txt导入
uv add -r requirements.txt
```

## 快速执行脚本

如果只是想临时跑个脚本，不想创建项目：

```bash
# 直接运行，自动安装依赖
uv run --with requests script.py

# 或者用uvx运行命令行工具
uvx black .
uvx ruff check .
```

## 常用命令速查

```bash
uv init              # 初始化项目
uv add <包名>         # 添加依赖
uv remove <包名>      # 移除依赖
uv sync              # 同步依赖
uv run <命令>        # 在虚拟环境中运行
uv python install    # 安装Python
uv pip install       # 兼容pip的安装方式
```

基本上掌握 `uv init`、`uv add`、`uv run` 这三个就够日常使用了。官方文档在 <https://docs.astral.sh/uv/>，遇到问题可以去查。
