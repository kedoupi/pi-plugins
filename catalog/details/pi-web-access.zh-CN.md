# Pi Web Access

[English](./pi-web-access.md) | [简体中文](./pi-web-access.zh-CN.md)

> Research basis: 0.27.0, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Pi Web Access 是一个 Pi 扩展，用于网页搜索、页面抓取、论断核查，以及针对网页、GitHub 链接、PDF 和受支持视频输入的内容提取。

## Best For
适合先用零配置搜索，再按需启用多提供方路由、本地 GitHub 克隆、PDF 提取，或从 YouTube 和本地视频理解内容的 Pi 用户。

## Capabilities
- 提供四个工具：`web_search`、`fetch_content`、`source_check`、`get_search_content`。
- `web_search` 与 `fetch_content` 可按配置的提供方顺序和回退链路执行；上游文档称零配置路径可直接通过 Exa MCP 使用。
- `fetch_content` 可以把普通 URL 取回为 Markdown、原始内容或回答；GitHub 仓库会被本地克隆，而不是只抓取渲染后的网页。
- 上游文档还覆盖了通过 `gh` 渲染 GitHub PR/Issue、PDF 转 Markdown，以及针对 YouTube 或本地视频的分析与按时间点抽帧。
- `source_check` 会返回带引用的机器可读核查结果，curator 工作流和活动监视器则帮助你在复用搜索结果前做人工审阅。

## Installation
```bash
pi install npm:pi-web-access
```

## Quick Start
1. 安装后直接尝试 `web_search({ query: "TypeScript best practices 2025" })`，无需额外配置。
2. 用 `fetch_content({ url: "https://docs.example.com/guide" })` 抓取页面，或用 `fetch_content({ url: "https://github.com/owner/repo" })` 克隆仓库。
3. 如果需要更多提供方，可在上游示例配置路径 `~/.pi/web-search.json` 中添加 API key。
4. 如需从视频源按时间点抽帧，可选安装 `ffmpeg` 和 `yt-dlp`。

## Commands and Tools
- `/websearch`：打开搜索 curator
- `/curator`：切换或配置 curator 工作流
- `/search`：浏览已保存的搜索结果
- `/google-account`：查看 Gemini Web 当前使用的 Google 账号
- `Ctrl+Shift+W`：切换活动监视器
- `web_search`、`fetch_content`、`get_search_content`、`source_check`

## Configuration
- 上游文档把 `~/.pi/web-search.json` 作为默认配置路径示例，并说明还会考虑 `PI_CODING_AGENT_DIR` 与 `XDG_CONFIG_HOME`。
- `openaiApiKey`、`braveApiKey`、`exaApiKey`、`perplexityApiKey`、`geminiApiKey` 等提供方凭据可来自配置文件或环境变量。
- `searchRouting.providers` 与 `fetchRouting.providers` 定义提供方顺序和回退行为。
- `fetchRouting.allowRemoteHostedProviders` 控制是否允许托管型提取服务去抓取远程 HTTP(S) 目标。
- `allowBrowserCookies`、`browserCookies.*`、`authFetch`、`fetchContent.domainPolicy`、`ssrf.allowRanges`、`workflow`、`curatorRemote` 用于控制浏览器 Cookie 访问、本地认证抓取、主机名策略、SSRF 例外、摘要生成和远程 curator 暴露。

## Permissions and Security
- 你启用的搜索、抓取或模型提供方会收到查询词、URL、抓取到的页面内容，以及可选的摘要提示，因此提供方选择同时影响隐私与 API 成本。
- 浏览器 Cookie 访问默认关闭；上游文档要求通过 `allowBrowserCookies` 或 `PI_ALLOW_BROWSER_COOKIES=1` 显式开启。
- 面向远程 HTTP(S) 目标的托管型抓取提供方也默认关闭，只有 `fetchRouting.allowRemoteHostedProviders` 开启后才会使用。
- GitHub 仓库抓取会在本地克隆源码，并在私有 web-search cache 目录中保留缓存文件，而不是只返回渲染后的 HTML。
- 上游安全说明提到了 `ffmpeg`/`ffprobe`、`yt-dlp`、`gh` 以及 `sqlite3` 或 Python 等 Cookie 读取后备路径的子进程使用，还支持来自 `$env` 或 `!command` 的凭据来源。
- 公开资料描述了 SSRF 防护：DNS 预检、私有网段阻断、重定向重新校验、主机名策略，以及可选但应谨慎使用的 `allowRanges` 覆盖。
- 远程 curator 需要显式开启；上游文档说明其默认绑定 `127.0.0.1`，通过 plain HTTP + session token 访问，本身不提供 TLS。

## Compatibility
- 本页调研的 npm 版本是 `0.27.0`。
- 上游 README 声明需要 Pi `v0.37.3+`。
- 公开元数据与文档说明其采用 MIT 许可证、TypeScript/ESM 打包，并支持 macOS、Linux 与部分 Windows 用法。
- 上游文档列出的可选二进制包括 `ffmpeg`、`ffprobe`、`yt-dlp`、`gh`，以及某些 Cookie 访问场景下的 `sqlite3` 或 Python。
- 本条目完全基于上游公开资料，不表示已在本地执行测试。

## Limitations
- 私有、年龄受限或其他受限制的 YouTube 视频，可能在所有文档化提取路径上都失败。
- 上游文档说明 PDF 处理仅做文本提取；扫描文档 OCR 不在当前文档化流程内。
- 搜索提供方、托管提取服务和模型步骤都可能受到配额、延迟或付费额度限制。
- 远程 curator 模式虽然默认关闭，但一旦启用，仍然依赖仅凭 token 的 plain HTTP 访问，没有内建 TLS。
- 公开调研记录了部分 Windows Cookie 支持限制和其他平台差异；如果你依赖浏览器 Cookie 访问，需要先核对上游 README。

## Upstream and License
- Repository: https://github.com/nicobailon/pi-web-access
- README: https://github.com/nicobailon/pi-web-access#readme
- package metadata: https://www.npmjs.com/package/pi-web-access
- Latest release notes: https://github.com/nicobailon/pi-web-access/releases/tag/v0.27.0 and https://github.com/nicobailon/pi-web-access/blob/main/CHANGELOG.md
- License: MIT。公开证据包括仓库 LICENSE 文件 https://github.com/nicobailon/pi-web-access/blob/main/LICENSE 和 npm 包元数据。
- Security policy: https://github.com/nicobailon/pi-web-access/blob/main/SECURITY.md
