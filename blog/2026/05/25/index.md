# 给 Clash Verge 用户的 AI 分流方案：用 ClashMate 做本地直连和二次跳转

如果你已经在用 Clash Verge，最常见的做法通常是：导入订阅、切到 `Rule` 模式、然后给不同网站分配不同的代理组。这个方法对日常上网完全够用，但对 `Codex`、`ChatGPT`、`Claude` 这类 AI 工具来说，很多时候还差最后一步。

问题往往不在于“能不能出海”，而在于“AI 流量是不是走了一条稳定、可控、和普通流量分开的链路”。

我这次把原来的 `ClashMate` 和 `Dialer-Proxy` 两个工具重新整理了一遍，本质上是给 Mihomo / Clash Verge 做了一层规则适配器：

1. 普通流量继续按原有规则分流
2. AI 流量单独命中一条二次代理链路
3. 最终输出还是一份可以直接导入 Clash Verge 的 Mihomo 配置

## 为什么单纯“AI 走代理”还不够

很多人一开始的配置思路其实很直接：

1. 建一个叫 `AI` 的组
2. 把美国节点放进去
3. 再把 `AI Suite`、`OpenAI`、`Claude` 之类的规则指到这个组

这当然能用，但它隐含了一个假设：AI 流量和普通出海流量可以共用同一类出口。

实际使用里，这个假设不一定成立。对 `Clash Verge` 用户来说，常见问题反而是：

1. 日常浏览和 AI 请求混在一起，不容易单独调试
2. 某些 AI 服务希望走一条固定出口，而不是和其它普通代理共享同一组节点
3. 你可能已经有一套中转节点，但 AI 流量还需要再接一个目标代理，这时单层代理组就不够描述了

所以这次工具升级的重点不是“再加几个域名规则”，而是把规则结构升级成两层：

1. 第一层处理普通分流
2. 第二层处理 AI 的二次跳转

## 这套方案的核心结构

现在的 `ClashMate` 生成的不是单纯的“规则列表”，而是一套明确分层的 Mihomo 配置。

最核心的流量路径可以写成这样：

```text
普通流量 -> Auto / Proxy / 自定义普通组

AI 流量
  -> AI-Relay
  -> Target Proxy
  -> Relay-Group
  -> Relay Proxy
  -> 最终出口
```

这里面有 4 个关键角色：

| 角色 | 作用 |
|------|------|
| `Auto` / `Proxy` | 处理普通上游节点分流 |
| `Relay-Group` | 第一跳中转组 |
| `Target Proxy` | 真正承接 AI 流量的目标代理节点 |
| `AI-Relay` | AI 规则命中的目标组 |

对应到实际配置，就是：

1. 你先导入原来的上游订阅节点
2. 这些节点继续服务普通流量
3. 再额外导入一组 relay 节点
4. 然后定义一个 target 节点，并通过 `dialer-proxy` 指向 `Relay-Group`
5. 最后让 `OpenAI` / `Anthropic` 之类规则命中 `AI-Relay`

这里要特别注意：`AI-Relay` 只在你真的配置了 relay 和 target 之后才有意义。如果你只是普通分流，不做二次跳转，`AI Suite` 这个 Provider 仍然可以正常使用，只是默认走普通 `Proxy`。

这样做的好处是，AI 流量和普通流量彻底分开了。你不用再把所有问题都归结为“这个美国节点好不好用”，而是能明确区分：

1. 普通规则有没有命中
2. AI 规则有没有命中
3. Relay 有没有问题
4. Target 有没有问题

## 现在两个工具分别负责什么

这次我没有把两个工具简单合并成一个大页面，而是让它们各自做清楚自己的事。

### ClashMate

现在的 `ClashMate` 是主入口，负责生成最终可导入 `Clash Verge` 的 Mihomo 配置：

1. 导入上游订阅
2. 编辑普通代理组
3. 配置 relay 和 target
4. 启用内置 AI 规则包
5. 生成最终 YAML

入口：

<https://xuzhougeng.top/tools/clashmate/>

### Dialer-Proxy

`Dialer-Proxy` 继续保留，但它现在更像一个 standalone 的双跳配置生成器，适合这些场景：

1. 你只想快速验证 relay + target 这条链路
2. 你暂时不需要完整的普通流量分流
3. 你只想单独生成一份 AI 双跳配置

入口：

<https://xuzhougeng.top/tools/dialer-proxy/>

## 给 Clash Verge 用户的最短使用步骤

如果你已经会用 Clash Verge，这套工具的实际用法并不复杂。

### 1. 先导入上游节点

打开 `ClashMate`，把你现有订阅地址或者 YAML 文件导进去。

这一步导入的是普通上游节点，它们还是给日常流量用的。

### 2. 处理普通代理组

保留默认的 `Auto` 和 `Proxy`，如果你有需要，可以再加自己的普通组，比如：

1. `Streaming`
2. `Work`
3. `Browser`

这部分仍然是普通 Mihomo 分流逻辑，没有什么特别的。

### 3. 配置 Relay

在 relay 区域里粘贴第一跳中转节点，可以是：

1. bare list
2. 带 `proxies:` 的 Clash / Mihomo YAML

然后指定 `Relay-Group` 的名字和类型。

### 4. 配置 Target

再创建一个或多个 target 节点。

这些节点会自动带上 `dialer-proxy`，并指向 `Relay-Group`。它们不会混进普通组，而是专门给 `AI-Relay` 使用。

### 5. 启用 AI 规则包

如果你的目标是 AI 流量走二次跳转，我建议第一步只开 `AI 核心规则`。

这个规则包主要覆盖：

1. `OpenAI`
2. `ChatGPT`
3. `Anthropic`
4. `Claude`

`AI 扩展规则` 也可以开，但它只负责扩展更多 AI 相关站点和服务，例如 `Gemini`、`Copilot`、`Perplexity`、`Grok` 等。它现在不会再重复包含核心规则，所以同时开启核心和扩展时，不会再天然产生一批重复的 `ChatGPT` / `OpenAI` / `Claude` 规则。

这里还有一个容易混淆的点：`Rule Providers` 里的 `AI Suite` 不是 `AI-Relay` 本身，它只是一个远程 AI 规则集合。

现在工具的处理方式是：

1. 如果没有配置可用的 relay + target，`AI Suite` 默认仍然走普通 `Proxy`
2. 如果已经配置了可用的 AI 双跳链路，`AI Suite` 会自动指向 `AI-Relay`
3. 这种情况下，`AI Suite` 的目标会被锁定，避免 AI Provider 又被手动改回 `Auto` / `Proxy`

所以普通用户可以继续把 `AI Suite` 当作常规规则包使用；只有当你启用了中转方案时，它才会自动并且只能走 `AI-Relay`。

### 6. 生成 YAML 并导入 Clash Verge

配置完成后，直接生成 YAML，导入 `Clash Verge` 即可。

对于 `Clash Verge` 用户，最关键的其实就两点：

1. 导入生成后的配置
2. 保持 `Rule` 模式

工具输出的已经是 Mihomo 配置，不需要你再手工拼 `dialer-proxy` 或者自己维护那一大串 AI 域名规则。

生成后建议看一下摘要里的 `AI 实际命中预览`。它会按最终 YAML 的 `rules` 顺序模拟第一条命中，例如：

```text
chatgpt.com        -> AI-Relay  OK
openai.com         -> AI-Relay  OK
anthropic.com      -> AI-Relay  OK
claude.ai          -> AI-Relay  OK
gemini.google.com  -> AI-Relay  OK
```

如果你看到 `chatgpt.com -> Auto` 这种结果，就说明前面有更高优先级的规则抢先命中了。Mihomo 的规则是从上往下匹配，第一条命中就生效，所以这类提示要优先处理。

## 这篇文章更适合哪类人

这套方案最适合下面这类 `Clash Verge` 用户：

1. 已经有订阅节点，但 AI 流量想单独走一条链路
2. 想把 `OpenAI` / `Anthropic` 和普通出海流量彻底隔离
3. 不想再手改大段 Mihomo YAML
4. 想保留图形界面使用方式，而不是完全切回命令行

如果你只是临时测一个代理能不能用，那么 `Dialer-Proxy` 就够了。

如果你想真正把 `Clash Verge` 里的规则结构整理清楚，那么现在的 `ClashMate` 才是主入口。

## 使用时要注意的几件事

最后说几个这次工具升级后我刻意做得更严格的地方。

### 1. 这套方案依赖 Mihomo

这里用到了 `dialer-proxy`，所以目标就是 Mihomo 兼容内核。`Clash Verge` 本身没问题，但不要拿去假设所有老 Clash 内核都支持。

### 2. Relay 填错时，现在会直接失败

这次我把很多“静默生成错误配置”的路径都收掉了。

也就是说：

1. relay 为空，不会再生成一个空的双跳配置
2. relay 文本改坏了，不会继续偷偷沿用上一次解析成功的节点
3. 输入变了，旧输出会失效，避免你复制到过期 YAML

### 3. AI 扩展规则不要默认全开

`AI 扩展规则` 覆盖面更广，但它不是给所有人默认开启的。

如果你的目标只是稳定处理 `OpenAI` 和 `Anthropic`，从 `AI 核心规则` 开始就够了。

### 4. 不要把同一个 AI 域名写到多个不同目标

比如前面已经有：

```text
DOMAIN-SUFFIX,chatgpt.com,Auto
```

后面再生成：

```text
DOMAIN-SUFFIX,chatgpt.com,AI-Relay
```

实际生效的一定是前面的 `Auto`。工具现在会在生成摘要里提示这类冲突，并告诉你当前实际会走哪个目标。

### 5. 改完组名或目标后，要重新生成

工具现在会尽量同步更新内部引用，但本质上你最终导入 `Clash Verge` 的仍然是一份 YAML 文件，所以改完结构后，记得重新生成再导入。

## 结语

对 `Clash Verge` 用户来说，这次工具升级最重要的点不是“页面变复杂了”，而是它终于把一个过去经常写散的配置问题收成了一个稳定模型：

1. 普通流量走普通分流
2. AI 流量走 `AI-Relay`
3. `AI-Relay` 再通过 `Target + Relay-Group` 完成二次跳转

这样配置之后，`Clash Verge` 不再只是一个“切节点”的地方，而是真正变成了一个可控的规则分发入口。

如果你之前已经在用我那篇老的 `Clash配置` 方法，这篇文章可以理解成它的下一阶段：不是只解决“怎么配规则”，而是解决“怎么把 AI 相关流量单独抽出来，并且走一条稳定的双跳链路”。
