# 让 Claude Code / Codex 用上 Git Worktree：并行开发的正确姿势

当你开始频繁地让 AI 帮你写代码，很快会撞到一个尴尬的限制：**一个工作目录，同一时间只能 checkout 一个分支**。

于是常见的场景就变成了——你让 AI 在 `feat-a` 分支上改东西，改到一半你又想起来 `feat-b` 还有个 bug 要修，只能先 `git stash`、切分支、再切回来。如果你想同时跑两个 AI 会话各干各的，那基本是不可能的：它们会在同一个目录里互相踩脚。

`git worktree` 就是为了解决这个问题而生的，而它恰好和「AI 编程」这件事天然契合。

## 什么是 Git Worktree

一句话：**一个仓库，多个工作目录**。

平时我们用 git，是「一个 `.git` 仓库 + 一个工作目录」。`git worktree` 允许你从同一个仓库里 checkout 出**多个**工作目录，每个目录可以停在不同的分支上，但它们共享同一份 `.git` 数据（提交历史、对象、远程配置都是同一套）。

```text
my-repo/                      <- 主工作树 (main)
my-repo/.worktrees/
  ├── codex-feat-a/           <- worktree (codex/feat-a)
  ├── codex-feat-b/           <- worktree (codex/feat-b)
  └── codex-fix-login/        <- worktree (codex/fix-login)
```

它和「克隆多份仓库」相比，优势很明显：

| 对比项 | 多次 clone | git worktree |
|--------|-----------|--------------|
| 磁盘占用 | 每份都是完整副本 | 共享 `.git`，只多出工作文件 |
| 提交/分支 | 各自独立，要手动同步 | 共享同一套历史和分支 |
| 远程配置 | 每份都要配 | 配一次，全部可用 |
| 适合场景 | 完全隔离的两个项目 | 同一项目的并行任务 |

对 AI 编程来说，这意味着：你可以为每一个「任务」开一个独立的 worktree，让一个 AI 会话在里面专心干活，互不干扰。任务做完了，连同分支一起删掉即可，主目录始终保持干净。

## Claude Code 这边：基本开箱即用

Claude Code 对 worktree 有比较完善的内置支持。它把 worktree 当成一种「隔离工作区」的能力：

- 当你让它**并行派发多个子任务**时，每个子任务可以跑在各自的 worktree 里，彼此的改动不会冲突；
- 当你要它**执行一份实现计划**时，可以直接让它「在一个独立 worktree 里跑」，全程不污染你当前的工作目录；
- 这些能力通过内置的工作流（skill）暴露出来，你不需要手动敲一堆 `git worktree add`。

换句话说，在 Claude Code 里你大多数时候只要表达意图——「用一个独立 worktree 来做这件事」——剩下的创建、进入、收尾它会帮你处理。

## Codex 这边：需要自己包一层

Codex CLI 目前没有把 worktree 封装成顺手的命令。你当然可以手动敲：

```bash
git worktree add ../.worktrees/my-task -b codex/my-task main
cd ../.worktrees/my-task
codex
```

但这套流程每次都要重复：算路径、起分支名、`cd` 进去、启动 codex；删的时候还要先 `worktree remove` 再 `branch -D`，稍不留神就会把没合并的提交删掉，或者误删了 `main`。

所以更省心的做法，是用三个 shell 函数把它包起来：

```text
cw     创建 worktree，自动进入并启动 codex
cwrm   删除 codex worktree 和对应的本地分支
cwls   查看当前仓库的 worktree 列表
```

下面这一版**同时支持 bash / zsh**，直接放进 `~/.zshrc` 或 `~/.bashrc` 即可。

## 三个函数能做什么

| 命令 | 作用 |
|------|------|
| `cw` | 基于某个基准分支创建一个 `codex/` 开头的 worktree，自动 `cd` 进去并启动 `codex` |
| `cwrm` | 安全地删除一个 codex worktree 及其本地分支（带未提交检查、可达性检查、二次确认） |
| `cwls` | 列出当前仓库的所有 worktree |

它在设计上刻意做了几层「防呆」：

1. **只允许创建/删除 `codex/` 开头的分支**——避免手滑误删 `main`、`feat/*`、`dev` 这类正常开发分支；
2. **删除前检查未提交改动**——有改动时默认拒绝，提示你先 commit 或 stash，除非显式 `--force`；
3. **删除前检查分支是否「可达」**——如果分支上有还没合并、也没推送到任何地方的提交，默认拒绝删除，防止你丢掉工作成果；
4. **从任意 worktree 子目录都能操作**——函数会自动找到主工作树（admin worktree）来执行 `git` 命令。

## 完整代码

把下面这段完整粘贴进 `~/.zshrc` 或 `~/.bashrc`：

```bash
__FUNCTION_CODE__
```

> 也可以直接下载本文附带的 [function.sh](function.sh)，然后在配置文件里 `source /path/to/function.sh`。

## 安装与加载

粘贴（或 `source`）之后，重新加载你的 shell 配置：

```bash
source ~/.zshrc
```

或者：

```bash
source ~/.bashrc
```

两个可选的环境变量：

```bash
# 创建 worktree 后不自动启动 codex（只创建并 cd 进去）
export CW_START_CODEX=0

# 自定义 worktree 的存放根目录（默认在仓库同级的 .worktrees/<repo>/ 下）
export CW_WORKTREE_ROOT=/some/path
```

## 使用示例

### 创建 worktree

不带参数时，默认基于 `main` 创建一个时间戳命名的分支：

```bash
cw
```

指定基准分支和分支名：

```bash
cw main codex/my-feature
```

基准也可以是远程分支，函数会先 `fetch` 再创建：

```bash
cw origin/main codex/some-task
```

创建成功后，你会直接落在新 worktree 目录里，并自动进入 codex 会话。

### 查看 worktree 列表

```bash
cwls
```

### 删除 worktree 和分支

在某个 worktree 里直接删它自己：

```bash
cwrm
```

按分支名删除：

```bash
cwrm codex/my-feature
```

如果分支里有未提交改动、或者有还没合并出去的提交，默认会被拦下来。确认不要这些内容时，加 `--force`：

```bash
cwrm --force codex/my-feature
```

不想要交互确认（比如写在脚本里）时，加 `--yes`：

```bash
cwrm --yes --force codex/my-feature
```

## 几个值得注意的设计细节

**为什么只让删 `codex/` 分支？**
因为这套函数的定位就是「管理 AI 临时分支」。把 `main`、`dev`、`feat/*` 这些真正的开发分支挡在门外，是为了让 `cwrm --force` 这种带破坏性的操作有一个明确的边界——你不可能用它把主分支误删掉。

**「可达性检查」具体在防什么？**
`cwrm` 在非 `--force` 模式下，会用 `git for-each-ref --contains` 检查这个分支的最新提交，是否还能从**另一个本地或远程引用**到达。如果不能，说明这些提交只活在这一个分支上，删了就真的没了。这时它会拒绝，并提示你用 `--force`。这一层专门用来兜住「AI 刚跑完一堆改动、还没来得及合并就被删」的情况。

**从子目录也能用。**
worktree 的 `git` 操作需要落在主工作树上执行，函数里的 `_cw_main_worktree` 会通过 `git worktree list --porcelain` 找到那个「admin」目录，所以你在任何一个 worktree 的任意子目录里调用 `cw` / `cwrm` / `cwls` 都能正常工作。

## 小结

- **worktree = 一个仓库、多个工作目录**，天然适合「让多个 AI 会话并行干活」的场景；
- **Claude Code** 这边基本开箱即用，你只要表达「用独立 worktree 做这件事」即可；
- **Codex** 这边没有现成命令，用 `cw` / `cwrm` / `cwls` 三个函数补齐，并在删除路径上加了未提交检查、可达性检查和 `codex/` 前缀限制，让日常并行开发既顺手又不容易翻车。

把它扔进 shell 配置，下次想让 codex 单独跑一条线时，一个 `cw` 就出发了。
