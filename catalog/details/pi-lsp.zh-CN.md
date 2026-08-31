# Pi LSP

[English](./pi-lsp.md) | [简体中文](./pi-lsp.zh-CN.md)

> Research basis: 0.49.6, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Pi LSP 是 `narumiruna/pi-extensions` monorepo 中的一个 Pi 扩展，通过共享的 `lsp_diagnostics`、`lsp_fix` 工具和 `/lsp` 命令，向 Pi 暴露语言无关的 LSP 诊断与 source/code-action 修复能力。

## Best For
适合让 Pi 只针对少量文件执行 language server 诊断或 source action，而不是把整个项目流程绑定到某一种语言专用的 lint 或 typecheck。

## Capabilities
- 提供 `lsp_diagnostics` 用于返回精确范围的诊断结果，提供 `lsp_fix` 用于执行 `source.fixAll`、`source.organizeImports` 等 server 提供的 source action。
- 通过配置的文件扩展名把文件路由到不同 server，而不是把能力写死在单一语言族上。
- 按顺序从受信任项目的 `.pi/pi-lsp.json`、用户级 `~/.pi/agent/pi-lsp.json`、以及内置默认 server catalog 读取配置。
- 上游文档描述的内置扩展名覆盖包括 JavaScript/TypeScript/JSON/CSS/GraphQL/HTML/Vue/Astro/Svelte、Python、Rust、Go、Ruby、C/C++、Java 等。
- `/lsp` 会显示每个已配置 server command，以及它当前是否在 `PATH` 上可用。

## Installation
```bash
pi install npm:@narumitw/pi-lsp
```

## Quick Start
1. 安装包，并先确认你要使用的 language server 命令已经在 `PATH` 上可用。
2. 只有默认 catalog 不够时，再写最短的自定义配置：
   ```json
   {
     "demo": {
       "command": ["ruff", "server"],
       "extensions": [".py"]
     }
   }
   ```
3. 把这段 JSON 保存到受信任项目的 `.pi/pi-lsp.json`，或保存到用户级 `~/.pi/agent/pi-lsp.json`。
4. 先运行 `/lsp` 检查命令可用性，再让 Pi 调用 `lsp_diagnostics` 或 `lsp_fix` 处理匹配文件。

## Commands and Tools
- `/lsp`：列出已配置 server 以及它们的命令是否可用
- `lsp_diagnostics`：为受支持文件或目录收集诊断结果
- `lsp_fix`：为单个文件预览或写回 server 提供的 source fix
- 上游文档列出的内置示例包括 `biome lsp-proxy`、`ty server`、`ruff server`、`rust-analyzer`、`gopls`、`rubocop --lsp`、`clangd`、`jdtls`

## Configuration
- 规范配置文件名是 `pi-lsp.json`；旧的 `lsp.json` 仍可读取，但会给出 warning。
- 每个 server 可设置 `command`、`extensions`，以及可选的 `env`、`initialization`、`skipDirectories`、诊断等待时间参数。
- 也支持 `{ "servers": { ... }, "timeout": 30000 }` 这种 wrapper 结构。
- 自定义配置会整体替换默认 server map，而不是与默认值合并。
- pi-lsp 会从常见扩展名推断 `languageId`；推断不到时会退回到扩展名文本本身。

## Permissions and Security
- 公开源码审阅显示，pi-lsp 只在工具调用期间启动 language-server 子进程，通过 stdio pipe 交换 JSON-RPC，结束后再关闭该子进程。
- 这些工具会读取所选 workspace root 下的受支持文件；被审阅的源码说明，超出该根目录的路径会被拒绝。
- `lsp_fix` 只有在 `write` 为 true 时才会把结果写回磁盘；否则只返回提议的新文本。
- 项目级配置只会从受信任项目读取，因此单纯传入 workspace root 并不会让不受信任仓库自动提供 LSP 设置。
- server command 来自本地配置和 `PATH`，因此信任边界也包括你选择安装并运行的 language server 二进制。

## Compatibility
- 本页调研的 npm 版本是 `0.49.6`。
- 公开元数据表明该包位于 `https://github.com/narumiruna/pi-extensions` 中的 `packages/pi-lsp`。
- 上游包元数据声明它是一个 MIT 许可的 ESM Pi 扩展，peer 依赖为 `@earendil-works/pi-coding-agent` 和 `typebox`。
- 公开资料还描述了 Windows 下对 `.bat`、`.cmd` 命令的特殊启动处理。
- 本条目仅依据公开资料调研，不表示已经在本地运行测试。

## Limitations
- pi-lsp 不会像编辑器那样持续把诊断结果流式注入对话；Pi 需要主动调用 `lsp_diagnostics`。
- 该包当前只暴露诊断与 source/code-action 修复，不覆盖 rename、symbol navigation 等更广泛的 LSP 功能。
- language server 二进制不会随包一起提供，也不会自动下载。
- 如果某个已配置 server command 不可用，上游文档只建议用 `/lsp` 先检查可用性，没有描述自动回退机制。
- 即使 LSP 结果干净，也不能替代项目自己的 formatter、linter、type checker、build 或 tests。

## Upstream and License
- Repository: https://github.com/narumiruna/pi-extensions
- Monorepo package: https://github.com/narumiruna/pi-extensions/tree/main/packages/pi-lsp
- README: https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-lsp/README.md
- package metadata: https://www.npmjs.com/package/@narumitw/pi-lsp
- Latest researched release evidence: https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-lsp/CHANGELOG.md and https://registry.npmjs.org/@narumitw/pi-lsp/-/pi-lsp-0.49.6.tgz
- License: MIT。公开证据包括 `packages/pi-lsp/LICENSE`：https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-lsp/LICENSE，以及 npm 包元数据。
