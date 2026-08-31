# Pi Web Access

[English](./pi-web-access.md) | [简体中文](./pi-web-access.zh-CN.md)

> Research basis: 0.27.0, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Pi Web Access is a Pi extension for web search, page fetching, claim checking, and content extraction across web pages, GitHub URLs, PDFs, and supported video inputs.

## Best For
Use it when you need zero-config web search first, then optional multi-provider routing, local GitHub cloning, PDF extraction, or YouTube and local video understanding from one Pi package.

## Capabilities
- Adds four tools: `web_search`, `fetch_content`, `source_check`, and `get_search_content`.
- `web_search` and `fetch_content` can route across configured providers with fallback chains; upstream docs say the zero-config path works immediately through Exa MCP.
- `fetch_content` can fetch regular URLs as markdown, raw content, or answers; GitHub repositories are cloned locally instead of scraped.
- Upstream docs also cover GitHub PR and issue rendering through `gh`, PDF-to-markdown conversion, and YouTube or local-video analysis with frame extraction at timestamps.
- `source_check` returns a machine-readable claim-verification artifact with citations, while the curator workflow and activity monitor help review search results before reuse.

## Installation
```bash
pi install npm:pi-web-access
```

## Quick Start
1. Install the package and try `web_search({ query: "TypeScript best practices 2025" })` with no extra config.
2. Fetch a page with `fetch_content({ url: "https://docs.example.com/guide" })` or clone a repo with `fetch_content({ url: "https://github.com/owner/repo" })`.
3. If you need more providers, add keys to the upstream example config path `~/.pi/web-search.json`.
4. Optionally install `ffmpeg` and `yt-dlp` if you want timestamp frame extraction from video sources.

## Commands and Tools
- `/websearch` to open the search curator
- `/curator` to toggle or configure the curator workflow
- `/search` to browse stored search results
- `/google-account` to show the active Google account for Gemini Web
- `Ctrl+Shift+W` to toggle the activity monitor
- `web_search`, `fetch_content`, `get_search_content`, `source_check`

## Configuration
- Upstream docs describe `~/.pi/web-search.json` as the default config path example, with `PI_CODING_AGENT_DIR` and `XDG_CONFIG_HOME` precedence.
- Provider keys such as `openaiApiKey`, `braveApiKey`, `exaApiKey`, `perplexityApiKey`, and `geminiApiKey` can come from config or environment variables.
- `searchRouting.providers` and `fetchRouting.providers` define provider order and fallback behavior.
- `fetchRouting.allowRemoteHostedProviders` controls whether hosted extraction providers may fetch remote HTTP(S) targets.
- `allowBrowserCookies`, `browserCookies.*`, `authFetch`, `fetchContent.domainPolicy`, `ssrf.allowRanges`, `workflow`, and `curatorRemote` control browser-cookie access, local auth fetches, hostname policy, SSRF exceptions, summary generation, and remote curator exposure.

## Permissions and Security
- Queries, URLs, fetched page content, and optional summarization prompts can leave the local Pi process for whichever search, extraction, or model provider you enable, so provider choice affects both privacy and API cost.
- Browser Cookie access is disabled by default; upstream docs require explicit opt-in through `allowBrowserCookies` or `PI_ALLOW_BROWSER_COOKIES=1`.
- Hosted remote fetch providers are also opt-in for remote HTTP(S) targets through `fetchRouting.allowRemoteHostedProviders`.
- GitHub repository fetches clone source locally and keep cache files under a private web-search cache directory, rather than returning rendered HTML alone.
- Upstream security notes describe subprocess usage for `ffmpeg`/`ffprobe`, `yt-dlp`, `gh`, and cookie-reader fallbacks such as `sqlite3` or Python, plus credential sources from `$env` or `!command`.
- Public sources describe SSRF controls including DNS preflight, private-range blocking, redirect revalidation, hostname policies, and narrow optional `allowRanges` overrides.
- Remote curator access is opt-in; upstream docs say it defaults to `127.0.0.1`, uses a session token over plain HTTP, and does not provide TLS by itself.

## Compatibility
- npm package version researched here: `0.27.0`.
- Upstream README states a Pi requirement of `v0.37.3+`.
- Public metadata and docs describe MIT licensing, TypeScript/ESM packaging, and support for macOS, Linux, and partial Windows usage.
- Optional binaries documented upstream include `ffmpeg`, `ffprobe`, `yt-dlp`, `gh`, and sometimes `sqlite3` or Python for cookie access helpers.
- This entry is based on upstream public sources and is not claimed as locally tested.

## Limitations
- Private, age-restricted, or otherwise restricted YouTube videos may fail on all documented extraction paths.
- Upstream docs say PDF handling is text extraction only; scanned-document OCR is not part of the documented flow.
- Search providers, hosted extractors, and model-backed steps can hit provider quotas, latency, or paid-credit limits.
- Remote curator mode is deliberately opt-in, but when enabled it still relies on token-only plain HTTP access without built-in TLS.
- Public research notes partial Windows cookie support and other platform-specific differences; review the upstream README if browser-cookie access matters.

## Upstream and License
- Repository: https://github.com/nicobailon/pi-web-access
- README: https://github.com/nicobailon/pi-web-access#readme
- package metadata: https://www.npmjs.com/package/pi-web-access
- Latest release notes: https://github.com/nicobailon/pi-web-access/releases/tag/v0.27.0 and https://github.com/nicobailon/pi-web-access/blob/main/CHANGELOG.md
- License: MIT. Public evidence includes the repository LICENSE file https://github.com/nicobailon/pi-web-access/blob/main/LICENSE and the npm package metadata.
- Security policy: https://github.com/nicobailon/pi-web-access/blob/main/SECURITY.md
