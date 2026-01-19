# Git极简教程

使用AI编程的时候，我觉得最重要的就是版本控制，也就是在AI把你代码搞得一团糟后，你可以迅速的恢复到之前的版本，这就是为什么我们需要学习使用git对项目进行版本管理。

虽然git的使用可以很复杂，但是常用的、需要记忆的，就那么几个，复杂的，可以用直接问AI.

## 安装

Linux/Mac用户基本都自带git，没有的话：

```bash
# Ubuntu/Debian
sudo apt install git
# Mac
brew install git
```

Windows用户推荐使用WSL, 除非是Windows10 以前的版本，那么只能去 https://git-scm.com/downloads 下载安装包。

## 初始配置

安装完第一件事，设置用户名和邮箱，这个会出现在你的每次提交记录里：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

## 日常使用

### 克隆项目

从GitHub下载别人的项目：

```bash
git clone https://github.com/用户名/项目名.git
# 例如
git clone https://github.com/xuzhougeng/
```

如果下载太慢，可以参考推荐部分我写的科学上网配置，设置代理。

### 新建项目

在现有文件夹里初始化Git：

```bash
cd 你的项目目录
git init
```

我一般新建项目第一件事就是加 `.gitignore`，省得后面把不该传的东西传上去了，比如说下面这些：

```bash
# 忽略所有 .log 文件
*.log

# 忽略 node_modules 目录
node_modules/

# 忽略 Python 虚拟环境
venv/
__pycache__/

# 忽略编译产物
*.o
*.pyc

# 忽略 IDE 配置
.vscode/
.idea/

# 忽略敏感文件
.env
config.local.yaml
```

GitHub上有现成的模板可以参考：<https://github.com/github/gitignore> 也可以让AI生成。

### 提交代码

这是最常用的三连：

```bash
git add .                    # 把所有改动加到暂存区
git commit -m "描述你改了什么"  # 提交到本地仓库
git push                     # 推送到远程仓库
```

我一般习惯用 `git add .` 全加，如果只想加某个文件就 `git add 文件名`。

### 拉取更新

同步远程仓库的最新代码：

```bash
git pull
```

### 查看状态

不知道当前什么情况的时候，先看看：

```bash
git status   # 看哪些文件改了
git log      # 看提交历史
```

## 分支操作

多人协作或者想试验新功能的时候会用到：

```bash
git branch           # 查看所有分支
git branch 新分支名   # 创建分支
git checkout 分支名   # 切换分支
git merge 分支名      # 合并分支到当前分支
```

我个人比较喜欢用 `git checkout -b 新分支名`，创建并切换一步到位。

## 常见问题

### 提交错了想撤回

```bash
git reset --soft HEAD~1  # 撤回上一次提交，改动保留
```

### 想放弃本地改动

```bash
git checkout -- 文件名   # 放弃单个文件的改动
git checkout -- .       # 放弃所有改动
```

### 远程仓库地址

```bash
git remote -v                              # 查看当前远程地址
git remote set-url origin 新地址           # 修改远程地址
git remote add origin 地址                 # 添加远程仓库
```

## 关联GitHub

第一次推送到GitHub需要先在GitHub上创建仓库，然后：

```bash
git remote add origin https://github.com/用户名/项目名.git
git branch -M main
git push -u origin main
```

之后就可以直接 `git push` 了。

基本上掌握这些就够日常使用了，遇到复杂情况再去搜具体命令。


## 推荐阅读

- [科研人员科学上网指南](https://xuzhougeng.top/blog/2025/12/09/index.html)
- [Clash配置](https://xuzhougeng.top/blog/2025/12/10/index.html)