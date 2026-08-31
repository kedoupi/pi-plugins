# Superpowers

[English](./superpowers.md) | [简体中文](./superpowers.zh-CN.md)

> Research basis: 6.3.0, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Superpowers 是一个面向 coding agent 的工作流包：它由一组可组合 skill 和运行时 bootstrap 指令构成，推动 agent 在编码前后遵循设计、规划、TDD、调试、worktree 隔离、评审和收尾流程。

## Best For
适合希望在 Pi 之上叠加一套强约束软件开发流程的用户，包括显式 brainstorming、plan、red/green TDD、worktree、review loop、verification 和分支收尾清理。

## Capabilities
- 上游 skills 覆盖 brainstorming、writing plans、test-driven development、systematic debugging、code review、verification before completion、finishing a development branch。
- 文档还描述了 `using-git-worktrees`、`executing-plans`、`subagent-driven-development`、以及并行 agent 调度。
- 在 Pi 中，安装后会同时带来 skills 和一个小型 extension；后者会在 session start 与 compaction 后自动注入 `using-superpowers` bootstrap。
- 文档化流程可能生成 spec、plan、branch、worktree、commit 和 review artifact，而不是只在当前对话里直接改代码。
- 上游 v6.3.0 release notes 还提到 SDD 冲突处理、批量执行以及更多 harness 支持。

## Installation
```bash
pi install git:github.com/obra/superpowers
```

## Quick Start
1. 使用上面的 Git 仓库来源安装。
2. 启动 Pi 会话；上游文档说明包内扩展会自动注入 `using-superpowers` bootstrap。
3. 按需使用文档化 workflow skill，例如设计前先 brainstorming、实现前先 writing-plans、编码时走 TDD 或 systematic-debugging。
4. 如果只是临时用本地 checkout，上游文档还给出 `pi -e /path/to/superpowers`。

## Commands and Tools
- `pi install git:github.com/obra/superpowers`
- `pi -e /path/to/superpowers`
- `brainstorming`、`writing-plans`、`test-driven-development`、`systematic-debugging`
- `using-git-worktrees`、`subagent-driven-development`、`requesting-code-review`、`receiving-code-review`
- `verification-before-completion`、`finishing-a-development-branch`、`executing-plans`、`dispatching-parallel-agents`
- `bump-version.sh`、`package-codex-plugin.sh` 等维护脚本在上游仓库中有文档，但正常 Pi 使用并不需要它们

## Configuration
- 公开包元数据声明了 Pi skills，以及位于 `./.pi/extensions/superpowers.ts` 的 Pi 扩展。
- 上游文档说明 Pi 扩展会在 `session_start` 和 `session_compact` 时注入 bootstrap，并在 `agent_end` 停止。
- 仓库还携带了 Claude Code、Cursor、Codex、Devin、Gemini、Grok、Hermes、Kimi 等环境的 plugin manifest。
- visual companion 的可选 telemetry 可以通过 `SUPERPOWERS_DISABLE_TELEMETRY` 或对应 harness 的禁用参数关闭。
- 这是一个 workflow layer，因此它的主要配置表面并不是业务参数，而是 coding agent 会遵循哪些技能与流程步骤。

## Permissions and Security
- Superpowers 影响的是 agent 行为，不会给你的项目直接增加新的应用运行时功能。
- 文档化流程会在实现、破坏性动作或分支清理前加入 approval gate 和额外步骤。
- 某些 workflow 会使用 subagent 或额外 model，因此它可能比无约束的单 agent 会话带来更高 token 消耗和更多仓库产物。
- worktree、branch、commit、review 流程按设计就可能修改仓库；上游文档特别说明 branch-finishing 不应销毁未跟踪或未提交的工作。
- 本次审阅的公开文档没有描述该包自身处理凭据的逻辑，但 workflow 仍会接触宿主 agent 已被允许访问的仓库文件和本地工具。

## Compatibility
- 本页调研的上游发布版本是 `6.3.0`。
- Pi 的官方安装来源是 Git：`git:github.com/obra/superpowers`。
- 公开元数据和文档说明它采用 MIT 许可，并显式支持 Pi 以及多种其他 coding harness。
- Pi 相关文档还说明，Pi 自带 native skills，因此该包依赖 Pi 自身的技能系统，而不是额外的 Skill 工具。
- 本条目仅依据公开资料调研，不表示已经在本地运行测试。

## Limitations
- 这个包本质上是 instruction 和 workflow framework，因此效果取决于具体 coding harness 与 model 是否真的遵循这些提示。
- 对 Pi 来说它不是从 npm 分发；`superpowers@0.0.2` 这个 npm 包与本项目无关，不能作为这里的安装来源。
- 部分 harness 的 hook 支持较弱，上游文档提到在某些环境里，超长会话在 compaction 之后可能丢失 bootstrap。
- subagent 和 task-list 工具被描述为可选 companion，而不是每个 harness 都保证内置的能力。
- 这里总结的 workflow 结论来自上游 README 和 release notes，并非在本次审阅中完整跑过整套方法后得出的测试结果。

## Upstream and License
- Repository: https://github.com/obra/superpowers
- README: https://github.com/obra/superpowers/blob/main/README.md
- Pi extension bootstrap: https://github.com/obra/superpowers/blob/main/.pi/extensions/superpowers.ts
- Release notes: https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md
- License: MIT。公开证据包括仓库 LICENSE 文件 https://github.com/obra/superpowers/blob/main/LICENSE
- Name collision note: https://www.npmjs.com/package/superpowers 是一个无关的 npm 包，不是本条目的 Pi 安装来源。
