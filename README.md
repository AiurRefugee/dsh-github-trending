<div align="center">

# dsh-github-trending

**给 DeepSeek Harness 加一块 GitHub 热点看板：一次 Firecrawl 请求同时拿到榜单、中文译文与总结。**

[![npm version](https://img.shields.io/npm/v/dsh-github-trending?color=4d6bfe&logo=npm&label=npm)](https://www.npmjs.com/package/dsh-github-trending)
[![npm downloads](https://img.shields.io/npm/dm/dsh-github-trending?color=4d6bfe)](https://www.npmjs.com/package/dsh-github-trending)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/AiurRefugee/dsh-github-trending)](https://github.com/AiurRefugee/dsh-github-trending)
[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4d6bfe.svg)](https://github.com/AiurRefugee/dsh-github-trending)

</div>

> 从 [`dsh-github-flow`](https://github.com/ItQianChen/dsh-github-flow) 的热点看板功能拆出来的独立插件：同一份榜单数据，不再需要 gh 登录，也不需要工作区仓库。

## 这是什么

GitHub Trending 每天都在变，但 DSH 里想看一眼今天什么项目在涨，得先装整套 GitHub 工作流插件、配好 `gh`、切到对应仓库。这个插件只做一件事：**把热点看板单独拿出来**。

- 一个工具 `github_trending`，让 Agent 直接查榜
- 一条 `/trending` 指令，人类随手看一眼
- 一块常驻看板，日 / 周 / 月三档切换，中英双语简介，右侧带趋势洞察

## 安装

```bash
# 从 npm 装（发布后可用）
dsh plugin --profile desktop add dsh-github-trending

# 或从 GitHub 直装
dsh plugin --profile desktop add github:AiurRefugee/dsh-github-trending
```

装完**重启一次 DeepSeek Harness**。之后的源码改动交给 [`dsh-live-reload`](https://github.com/Monter-code/dsh-live-reload) 热更新即可，不必反复重启。

本地源码调试：

```bash
git clone https://github.com/AiurRefugee/dsh-github-trending.git
cd dsh-github-trending
pnpm install     # 触发 prepare → tsc
pnpm test
dsh plugin --profile desktop add link:$PWD
```

> ⚠️ **不要和 `dsh-github-flow` 同时加载**：两者都注册 `github_trending` 工具、都占用侧边栏入口，会互相抢占。换用时先 `dsh plugin --profile desktop remove dsh-github-flow`。

## 启动故障修复与检查

如果 DSH 显示“启动时没能加载，未能运行”，请确认已安装包含启动修复的新版本，而不是本地旧的 `lib/` 编译文件。此前插件在注册 HTTP 路由时直接读取 `ctx.get('webServer')`，没有先声明 Cordis 注入依赖；这可能使插件在启动阶段抛出“未注入服务”的错误。现在 WebServer、Tools 和 Commands 均采用 `ctx.inject` 的可选服务加载机制，在没有 WebServer 的 CLI/TUI profile 里不会因此失败。

从 GitHub 更新并重建本地安装：

```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm run build
pnpm test
```

如使用链接安装，重新启动 DSH 以加载新的 `lib/main.js`。如使用 GitHub 直装或打包安装，请重新安装最新版源码，不要只刷新浏览器页面。若仍失败，查看 DSH 的启动日志中的原始异常（尤其是 `Cannot find module`、`without inject`、`duplicate`），以区分依赖缺失、注入依赖和重复插件。

`pnpm test` 包含真实的 `lib/main.js` 加载测试，模拟缺少可选 WebServer / Commands 的宿主，防止再次将只通过 TypeScript 编译、却无法在 Cordis 中激活的版本发布。

## 功能

- 🔥 **六字段榜单**：`name / url / description / language / stars / starsToday`，日 / 周 / 月三档独立缓存。
- 🌏 **中英双语简介**：表格里一键切换，译文缺失时自动回退原文。
- ✦ **右侧趋势洞察**：总结 + 3–5 条观察，**与榜单同一次响应返回**，不额外消耗第二次请求。
- 🧰 **Agent 工具**：`github_trending({ period: 'daily' | 'weekly' | 'monthly' | 'all' })`，支持 `read_only` 档位。
- ⌨️ **Slash 指令**：`/trending [daily|weekly|monthly|all]`，默认 `daily`。
- ⚡ **零后台消耗**：没有定时抓取；除手动刷新外，所有入口都先命中缓存。

## 抓取模式与额度

| 模式 | 接口 | 单周期消耗 | 耗时 | 条数 |
| --- | --- | ---: | ---: | ---: |
| `scrape`（默认） | `/v2/scrape` 的 JSON 抽取 | 约 5 credits | 约 40s | 约 9 |
| `agent` | `/v2/agent` + 轮询 | 24–39 credits | 约 100s | 约 15 |

在 **看板 → 设置 → 抓取模式** 里切换，选择会持久化到 `~/.dsh/data/dsh-github-trending/firecrawl-settings.json` 并立即生效；切换会清空缓存，因为两种模式产出的榜单不可复用。

`scrape` 模式下右侧洞察也由同一次抽取产出，**任何路径都不会调用 Agent**；`agent` 模式下榜单与洞察都由 Agent 任务产出，只有任务失败时才自动降级到 scrape 并在 `warning` 里说明。

## 缓存

- 默认 **3 小时**（`trendingCacheTtlMs`），按周期独立。
- 落盘到 `~/.dsh/data/dsh-github-trending/trending-cache/<period>.json`，权限 `0600`，`tmp → rename` 原子写，热重载和重启都不丢。
- 文件读取时重新走六字段校验；损坏、版本标记不符、以及时钟回拨造成的负缓存年龄，一律按「无缓存」处理并重新抓取。
- 只有看板上的「刷新」会穿透缓存，其余入口（挂载、切周期、工具、指令）都先过缓存。

## 配置

```yaml
- id: github-trending
  name: dsh-github-trending
  config:
    trendingSource: scrape        # scrape | agent
    trendingCacheTtlMs: 10800000  # 3 小时
    trendingTimeoutMs: 60000      # 单次 HTTP 请求超时
    trendingAgentTimeoutMs: 180000
    trendingAgentMaxCredits: 300
    firecrawlBaseUrl: https://api.firecrawl.dev
```

| 项 | 说明 |
| --- | --- |
| `trendingSource` | 仅在设置面板里没选过时生效 |
| `trendingCacheTtlMs` | 榜单缓存时长，`0` 表示每次重新抓取 |
| `trendingAgentMaxCredits` | 单次 Agent 任务的额度上限，防止卡死烧额度 |
| `firecrawlBaseUrl` | 自托管服务根地址（不带 `/v2/scrape`），也可用 `FIRECRAWL_BASE_URL` |

API Key 有两条来源：看板设置面板保存（推荐，存服务端、不回显），或进程环境变量 `FIRECRAWL_API_KEY`。自托管仅支持 Scrape 的部署请保持 `scrape` 模式。

## 开发

```bash
pnpm install
pnpm run build   # tsc → lib/
pnpm test        # node test/run.mjs
```

- 宿主半边 `src/**/*.ts` 由 `tsc` 编译到 `lib/`。
- 浏览器半边 `client.js` 是手写的零构建文件，通过 `window.__ModuleLoader__` 注册到 `main` 槽与侧边栏，不需要编译。
- 测试覆盖：抓取+洞察同响应、缓存命中与落盘复用、时钟回拨边界、路由同源守卫、`/trending` 指令。

## npm 自动发布

首次发布已经由维护者手动完成；后续版本使用 GitHub Actions + npm Trusted Publishing (OIDC)，无需在 GitHub Secrets 中保存 npm 发布令牌。

1. 登录 npm，进入 [dsh-github-trending 包页面](https://www.npmjs.com/package/dsh-github-trending) → **Settings** → **Trusted Publisher**，选择 **GitHub Actions**。
2. 填写 GitHub 用户 `AiurRefugee`、仓库 `dsh-github-trending`、工作流文件名 `publish.yml`（不要填写完整路径）；Environment 留空，允许 **npm publish**。
3. 修改并提交 `package.json` 版本号，同时执行 `pnpm run build && pnpm test`，将生成的 `lib/` 文件一起提交（CI 会检查产物与源码一致）。
4. 在 `main` 的发布提交上创建并推送同版本 Git 标签，例如 `v0.1.1`。

```bash
# 已发布过的版本 0.1.0 不可重复发布；下面以 0.1.1 为例。
npm version 0.1.1 --no-git-tag-version
pnpm run build
pnpm test
git add package.json lib/
git commit -m "chore: release v0.1.1"
git push origin main
git tag v0.1.1
git push origin v0.1.1
```

`.github/workflows/publish.yml` 将在推送标签时进行版本匹配、依赖安装、构建、测试、检查 `lib/`、检查 npm 打包内容，再通过 npm OIDC Trusted Publishing 发布公开包并生成 provenance。查看 [GitHub Actions](https://github.com/AiurRefugee/dsh-github-trending/actions)。

**注意：** npm 的 Trusted Publisher 授权必须先配置好；只创建工作流不会自动赋予 npm 发布权限。请不要为已经发布的 `0.1.0` 再推送发布标签；首个自动发布版本应使用新的版本号。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-github-trending
rm -rf ~/.dsh/data/dsh-github-trending   # 需要一并清掉 Key 与缓存时
```

## 链接

- 上游插件：[ItQianChen/dsh-github-flow](https://github.com/ItQianChen/dsh-github-flow)
- 问题反馈：[Issues](https://github.com/AiurRefugee/dsh-github-trending/issues)

## License

[MIT](LICENSE)
