# dsh-github-trending

GitHub 热点看板插件：一次 Firecrawl 请求同时拿到榜单、中文译文与总结，并提供 Agent 工具 `github_trending` 与 `/trending` 指令。

## 安装

```bash
dsh plugin --profile desktop add dsh-github-trending
```

或本地源码：

```bash
git clone <repo> && cd dsh-github-trending
pnpm install && pnpm run build
dsh plugin --profile desktop add link:$PWD
```

装完重启一次 DeepSeek Harness；之后的源码改动由 `dsh-live-reload` 热更新（若已安装）。

> 本插件与 `dsh-github-flow` 的「热点看板」功能重叠，**不要同时加载两者**：它们都会注册 `github_trending` 工具并争夺同一批槽位。

## 功能

- **六字段榜单**：`name / url / description / language / stars / starsToday`，日 / 周 / 月三档。
- **中英双语简介**：表格中的简介可在原文与中文译文间切换，缺译文时回退原文。
- **右侧趋势洞察**：总结 + 3–5 条观察，与榜单同一次响应返回。
- **Agent 工具**：`github_trending({ period: 'daily' | 'weekly' | 'monthly' | 'all' })`。
- **Slash 指令**：`/trending [daily|weekly|monthly|all]`，默认 `daily`。

## 抓取模式

| 模式 | 接口 | 单周期消耗 | 耗时 | 条数 |
| --- | --- | --- | --- | --- |
| `scrape`（默认） | `/v2/scrape` 的 JSON 抽取 | 约 5 credits | 约 40s | 约 9 |
| `agent` | `/v2/agent` + 轮询 | 24–39 credits | 约 100s | 约 15 |

在插件页面「设置 → 抓取模式」切换，保存到 `~/.dsh/data/dsh-github-trending/firecrawl-settings.json`。未在界面选过时回落到 plugin config 的 `trendingSource`。

## 缓存

- 默认 3 小时（`trendingCacheTtlMs`），按周期独立。
- 落盘到 `~/.dsh/data/dsh-github-trending/trending-cache/<period>.json`（0600，tmp+rename 原子写），热重载与重启都不丢。
- 唯一穿透缓存的是点「刷新」；其余入口（挂载、切周期、工具、指令）先过缓存。
- 读取落盘文件时重新走六字段校验；损坏、版本不符或时钟回拨导致的负 age 都按「无缓存」处理。

## 配置

```yaml
- id: github-trending
  name: dsh-github-trending
  config:
    trendingSource: scrape        # scrape | agent
    trendingCacheTtlMs: 10800000  # 3 小时
    trendingTimeoutMs: 60000
    trendingAgentTimeoutMs: 180000
    trendingAgentMaxCredits: 300
    firecrawlBaseUrl: https://api.firecrawl.dev
```

`firecrawlBaseUrl` 也可用 `FIRECRAWL_BASE_URL`；API Key 用 `FIRECRAWL_API_KEY` 或在插件设置里保存。自托管仅支持 Scrape 时请保持 `scrape` 模式。

## 开发

```bash
pnpm install
pnpm run build   # tsc → lib/
pnpm test        # node test/run.mjs
```

浏览器半边 `client.js` 是手写零构建文件，不需要编译；宿主半边由 `tsc` 编译到 `lib/`。

## 许可

MIT
