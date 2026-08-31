# Pi Powerline Footer

[English](./pi-powerline-footer.md) | [简体中文](./pi-powerline-footer.zh-CN.md)

> Research basis: 0.16.0, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Pi Powerline Footer is a Pi interface extension that auto-activates a powerline-style footer, welcome overlay, and optional shell and vibe helpers around the default Pi TUI.

## Best For
Use it when you want denser status visibility in Pi, including model, thinking, path, Git, context, token, and cost segments, plus editor stash, queued prompts, and a managed bash mode.

## Capabilities
- Activates after install and restart; use `/powerline`, `/powerline <preset>`, and `/powerline placement above|below|toggle` to switch presets or placement.
- Shows footer segments for model, thinking level, current path, Git state, context usage, token counts, and cost, and can surface extension-defined custom status items.
- Adds editor stash support, queued prompts via `/queue` and `/compact`, a welcome overlay, and AI-themed working vibes via `/vibe`.
- Adds sticky bash mode through `/bash-mode`, keeping a managed shell session alive for the current Pi session and streaming command output into an embedded transcript.
- Includes extra helpers such as `/reply`, `/cd`, stash history, and optional Nerd Font styling from upstream docs.

## Installation
```bash
pi install npm:pi-powerline-footer
```

## Quick Start
1. Install the package, restart Pi, and let the footer activate automatically.
2. Run `/powerline full` or another preset, then move it with `/powerline placement above|below|toggle`.
3. Press `Alt+S` to stash editor text, or use `/queue` to hold prompts during compaction.
4. Toggle `/bash-mode` for a persistent shell or `/vibe star trek` for themed loading messages.

## Commands and Tools
- `/powerline`, `/powerline <preset>`, `/powerline placement above|below|toggle`
- `/powerline-perf` and `/powerline-perf reset`
- `/bash-mode on|off|toggle`, `/bash-reset`, `ctrl+shift+b`
- `/queue`, `/queue alias`, `/queue send`, `/queue retry`, `/queue clear`, `/queue target`
- `/compact <text>` to compact now and queue the next prompt
- `/vibe <theme>`, `/vibe off`, `/vibe model`, `/vibe mode generate|file`, `/vibe generate <theme> [count]`
- `/stash-history`, `Alt+S`, `/reply`, `/cd <path>`

## Configuration
- Upstream docs point to Pi agent settings such as `~/.pi/agent/settings.json`, the directory named by `PI_CODING_AGENT_DIR`, or project-local `.pi/settings.json`.
- `powerline.preset`, `powerline.placement`, `powerline.welcome`, `powerline.separator`, and `powerline.layout` control layout and placement.
- `powerline.customItems[]` and `powerline.disabledSegments` customize or hide footer items.
- `powerline.path.mode`, `powerline.model.display`, `powerline.context.format`, and `powerline.cost.currency` adjust how core segments render.
- `bashMode.*`, `workingVibe*`, `powerlineShortcuts.*`, `powerline.git.*`, and `POWERLINE_NERD_FONTS` tune shell mode, working vibes, shortcuts, Git polling, and font handling.

## Permissions and Security
- Upstream docs say the extension writes queue and UI state under the Pi agent directory, including `powerline-footer/inbox.jsonl`, `projects.json`, `stash-history.json`, `vibes/{theme}.txt`, and session files.
- Bash mode executes local shell commands in a persistent managed shell for the active Pi session, so it has the same local command risk as the commands you type.
- Generated working vibes call the configured model and can add provider cost and latency; file mode avoids those model calls.
- Non-USD cost displays may do a background FX lookup and cache the result for 24 hours under the agent directory.
- Git status polling uses local Git subprocesses with `GIT_OPTIONAL_LOCKS=0` according to upstream docs; 0.16.0 also notes hidden Git child-process consoles on Windows.
- These behaviors come from upstream README and changelog review, not from a local security audit.

## Compatibility
- npm package version researched here: `0.16.0`.
- Upstream package metadata declares Pi peer dependencies `>=0.81.0 <0.85.0` for `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui`.
- The package is published as ESM and documented for the Pi coding agent, with Windows notes and Nerd Font auto-detection in upstream docs.
- This catalog entry is researched from public sources only and is not claimed as locally tested.

## Limitations
- Upstream docs note a duplicate-command conflict if you also install standalone `pi-quote-reply`; Pi may suffix both commands as `/reply:1` and `/reply:2`.
- Working-vibe `generate` mode depends on the selected model and adds network cost and latency; `file` mode is faster but less contextual.
- Stash history persists, but the active stash itself is session-local and resets on session switch or disable.
- The researched license evidence is MIT package metadata only; the reviewed repository LICENSE endpoint returned 404 instead of a standalone license file.
- The notes above come from public documentation and release notes, not from executing the package in this repository.

## Upstream and License
- Repository: https://github.com/nicobailon/pi-powerline-footer
- README: https://github.com/nicobailon/pi-powerline-footer/blob/main/README.md
- Package metadata: https://www.npmjs.com/package/pi-powerline-footer
- Latest release notes: https://github.com/nicobailon/pi-powerline-footer/releases and https://github.com/nicobailon/pi-powerline-footer/blob/main/CHANGELOG.md
- License: MIT. The public evidence reviewed here is the npm package metadata and the upstream package metadata described in research, not a checked repository license file.
- Repository LICENSE check used in research: https://api.github.com/repos/nicobailon/pi-powerline-footer/contents/LICENSE
