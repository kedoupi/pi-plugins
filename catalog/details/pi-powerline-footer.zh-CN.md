# Pi Powerline Footer

[English](./pi-powerline-footer.md) | [简体中文](./pi-powerline-footer.zh-CN.md)

> Research basis: 0.16.0, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Pi Powerline Footer 是一个 Pi 界面扩展，会在默认 Pi TUI 上自动启用 powerline 风格状态栏、欢迎浮层，以及可选的 shell 与 vibe 辅助功能。

## Best For
适合想在 Pi 中获得更密集状态信息的用户，包括模型、thinking、路径、Git、上下文、token、成本分段，以及编辑器暂存、排队提示和托管 bash 模式。

## Capabilities
- 安装并重启后会自动启用；可用 `/powerline`、`/powerline <preset>`、`/powerline placement above|below|toggle` 切换预设和位置。
- 状态栏可显示模型、thinking 级别、当前路径、Git 状态、上下文占用、token 数和成本，也能展示其他扩展提供的自定义状态项。
- 提供编辑器暂存、通过 `/queue` 与 `/compact` 管理排队提示、欢迎浮层，以及通过 `/vibe` 生成 AI 主题工作提示语。
- 通过 `/bash-mode` 提供粘性 bash 模式，为当前 Pi 会话保留托管 shell，并把命令输出流式写入内嵌 transcript。
- 还包含 `/reply`、`/cd`、stash 历史和可选 Nerd Font 样式等上游文档中的附加能力。

## Installation
```bash
pi install npm:pi-powerline-footer
```

## Quick Start
1. 安装后重启 Pi，让状态栏自动激活。
2. 运行 `/powerline full` 或其他预设，再用 `/powerline placement above|below|toggle` 调整位置。
3. 按 `Alt+S` 暂存编辑器文本，或用 `/queue` 在 compact 期间保存后续提示。
4. 用 `/bash-mode` 打开持久 shell，或用 `/vibe star trek` 切换主题加载提示。

## Commands and Tools
- `/powerline`、`/powerline <preset>`、`/powerline placement above|below|toggle`
- `/powerline-perf` 与 `/powerline-perf reset`
- `/bash-mode on|off|toggle`、`/bash-reset`、`ctrl+shift+b`
- `/queue`、`/queue alias`、`/queue send`、`/queue retry`、`/queue clear`、`/queue target`
- `/compact <text>`：立即 compact，并把下一条提示加入队列
- `/vibe <theme>`、`/vibe off`、`/vibe model`、`/vibe mode generate|file`、`/vibe generate <theme> [count]`
- `/stash-history`、`Alt+S`、`/reply`、`/cd <path>`

## Configuration
- 上游文档指向的 Pi 设置位置包括 `~/.pi/agent/settings.json`、`PI_CODING_AGENT_DIR` 指向的目录，或项目内 `.pi/settings.json`。
- `powerline.preset`、`powerline.placement`、`powerline.welcome`、`powerline.separator`、`powerline.layout` 控制布局与位置。
- `powerline.customItems[]` 与 `powerline.disabledSegments` 用于自定义或隐藏状态项。
- `powerline.path.mode`、`powerline.model.display`、`powerline.context.format`、`powerline.cost.currency` 控制核心分段的显示方式。
- `bashMode.*`、`workingVibe*`、`powerlineShortcuts.*`、`powerline.git.*`、`POWERLINE_NERD_FONTS` 可调节 shell 模式、working vibes、快捷键、Git 轮询和字体处理。

## Permissions and Security
- 上游文档说明该扩展会在 Pi agent 目录下写入队列与界面状态文件，包括 `powerline-footer/inbox.jsonl`、`projects.json`、`stash-history.json`、`vibes/{theme}.txt` 以及 session 文件。
- Bash 模式会在当前 Pi 会话中通过持久托管 shell 执行本地命令，因此风险与用户输入的本地命令一致。
- `generate` 模式的 working vibes 会调用所配置模型，并带来额外的提供方成本与延迟；`file` 模式可避免这些模型调用。
- 非 USD 成本显示可能会执行后台汇率查询，并将结果在 agent 目录下缓存 24 小时。
- 根据上游文档，Git 状态轮询会用 `GIT_OPTIONAL_LOCKS=0` 启动本地 Git 子进程；0.16.0 还提到在 Windows 上隐藏 Git 子进程控制台窗口。
- 这些行为来自上游 README 与 changelog 审阅，而不是本地安全审计。

## Compatibility
- 本页调研的 npm 版本是 `0.16.0`。
- 上游包元数据声明其 Pi peer 依赖范围为 `>=0.81.0 <0.85.0`，覆盖 `@earendil-works/pi-ai`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`。
- 该包以 ESM 形式发布，面向 Pi coding agent，并在上游文档中记录了 Windows 注意事项和 Nerd Font 自动检测。
- 这里仅基于公开资料调研，不表示已在本仓库本地测试。

## Limitations
- 上游文档指出，如果同时安装独立的 `pi-quote-reply`，会出现重复命令冲突；Pi 可能把两者后缀成 `/reply:1` 与 `/reply:2`。
- `generate` 模式的 working vibes 依赖所选模型，并增加网络成本与延迟；`file` 模式更快，但上下文相关性较弱。
- Stash 历史会持久化，但当前活动 stash 仅在会话内有效，切换或停用会重置。
- 本次调研中的 MIT 许可证证据仅来自包元数据；审阅时访问的仓库 LICENSE 接口返回 404，没有找到独立许可证文件。
- 上述说明来自公开文档和发布说明，而不是在本仓库中实际执行该包得出的结论。

## Upstream and License
- Repository: https://github.com/nicobailon/pi-powerline-footer
- README: https://github.com/nicobailon/pi-powerline-footer/blob/main/README.md
- Package metadata: https://www.npmjs.com/package/pi-powerline-footer
- Latest release notes: https://github.com/nicobailon/pi-powerline-footer/releases and https://github.com/nicobailon/pi-powerline-footer/blob/main/CHANGELOG.md
- License: MIT。本次审阅使用的公开证据是 npm 包页面和研究中引用的上游包元数据，而不是已核对的仓库许可证文件。
- Repository LICENSE check used in research: https://api.github.com/repos/nicobailon/pi-powerline-footer/contents/LICENSE
