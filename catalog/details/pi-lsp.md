# Pi LSP

[English](./pi-lsp.md) | [简体中文](./pi-lsp.zh-CN.md)

> Research basis: 0.49.6, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Pi LSP is a Pi extension from the `narumiruna/pi-extensions` monorepo that exposes language-agnostic LSP diagnostics and source/code-action fixes through shared `lsp_diagnostics` and `lsp_fix` tools plus a `/lsp` command.

## Best For
Use it when Pi needs targeted language-server diagnostics or source actions on a few files without turning the whole project workflow into one language-specific lint or typecheck path.

## Capabilities
- Adds `lsp_diagnostics` for exact-range diagnostics and `lsp_fix` for server-provided source actions such as `source.fixAll` or `source.organizeImports`.
- Routes files to servers by configured extensions instead of hard-coding one language family.
- Reads config from trusted project `.pi/pi-lsp.json`, then `~/.pi/agent/pi-lsp.json`, then the built-in default server catalog.
- Upstream docs describe built-in coverage for extension patterns across JavaScript/TypeScript/JSON/CSS/GraphQL/HTML/Vue/Astro/Svelte, Python, Rust, Go, Ruby, C/C++, Java, and more.
- `/lsp` reports each configured server command and whether it is available on `PATH`.

## Installation
```bash
pi install npm:@narumitw/pi-lsp
```

## Quick Start
1. Install the package and make sure the language server command you want is already available on `PATH`.
2. Create the shortest custom config only if the default catalog is not enough:
   ```json
   {
     "demo": {
       "command": ["ruff", "server"],
       "extensions": [".py"]
     }
   }
   ```
3. Save that JSON as trusted project `.pi/pi-lsp.json` or user `~/.pi/agent/pi-lsp.json`.
4. Run `/lsp` to check command availability, then let Pi call `lsp_diagnostics` or `lsp_fix` on matching files.

## Commands and Tools
- `/lsp` to list configured servers and whether their commands are available
- `lsp_diagnostics` to collect diagnostics for supported files or directories
- `lsp_fix` to preview or write a server-provided source fix for one file
- Built-in examples documented upstream include `biome lsp-proxy`, `ty server`, `ruff server`, `rust-analyzer`, `gopls`, `rubocop --lsp`, `clangd`, and `jdtls`

## Configuration
- Canonical config name is `pi-lsp.json`; legacy `lsp.json` remains readable with a warning.
- Each server maps to `command`, `extensions`, and optional `env`, `initialization`, `skipDirectories`, and diagnostics timing keys.
- A wrapper shape with `{ "servers": { ... }, "timeout": 30000 }` is also supported.
- Custom config replaces the default server map rather than merging with it.
- pi-lsp infers `languageId` from common extensions and otherwise falls back to the extension text itself.

## Permissions and Security
- Public source review says pi-lsp starts a language-server subprocess only for a tool call, exchanges JSON-RPC over stdio pipes, then shuts the child down afterward.
- The tools read supported files under the selected workspace root; reviewed source says paths outside that root are rejected.
- `lsp_fix` only writes back to disk when the `write` flag is true; otherwise it returns the proposed text.
- Project-level config is only read from trusted projects, so passing a workspace root alone does not grant an untrusted repo authority to provide LSP settings.
- Server commands come from local configuration and `PATH`, so the trust model includes whichever language-server binaries you choose to install and run.

## Compatibility
- npm package version researched here: `0.49.6`.
- Public metadata places the package in `packages/pi-lsp` inside the `https://github.com/narumiruna/pi-extensions` monorepo.
- Upstream package metadata declares an MIT-licensed ESM Pi extension with peer dependencies on `@earendil-works/pi-coding-agent` and `typebox`.
- Public notes also describe Windows-specific spawn handling for `.bat` and `.cmd` commands.
- This entry is researched from public sources only and is not claimed as locally tested.

## Limitations
- pi-lsp does not continuously stream editor-style diagnostics into the conversation; Pi has to call `lsp_diagnostics`.
- The package only exposes diagnostics and source/code-action fixes, not broader LSP features such as rename or symbol navigation.
- Language servers are not bundled or auto-downloaded.
- If a configured server command is unavailable, upstream docs point users to `/lsp` for availability checks and do not describe an automatic fallback.
- A clean LSP result does not replace the project's formatter, linter, type checker, build, or tests.

## Upstream and License
- Repository: https://github.com/narumiruna/pi-extensions
- Monorepo package: https://github.com/narumiruna/pi-extensions/tree/main/packages/pi-lsp
- README: https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-lsp/README.md
- package metadata: https://www.npmjs.com/package/@narumitw/pi-lsp
- Latest researched release evidence: https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-lsp/CHANGELOG.md and https://registry.npmjs.org/@narumitw/pi-lsp/-/pi-lsp-0.49.6.tgz
- License: MIT. Public evidence includes `packages/pi-lsp/LICENSE` at https://github.com/narumiruna/pi-extensions/blob/main/packages/pi-lsp/LICENSE plus the npm package metadata.
