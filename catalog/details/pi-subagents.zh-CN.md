# Pi Subagents

[English](./pi-subagents.md) | [简体中文](./pi-subagents.zh-CN.md)

> Research basis: 0.61.0, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Pi Subagents 是一个 Pi 扩展，用来把聚焦任务委派给子 Pi 会话，覆盖单 agent 交接、并行或脚本化工作流、后台运行、managed worktree、评审以及 fleet 式可观测性。

## Best For
适合让一个 Pi 会话负责任务拆分、隔离写作者、异步评审或更长时间的后台工作，而不是把所有步骤都塞进同一个前台对话里。

## Capabilities
- 同时支持自然语言的单 agent 委派，以及使用 `workflowScript`、`runs.run`、`runs.all`、`runs.lanes`、`runs.steer` 的脚本化工作流。
- 内置 `scout`、`researcher`、`worker`、`reviewer`、`oracle`、`delegate` 等 agent。
- 上游文档描述了 forked、pruned、fresh 三种上下文模式，并给出了 64 KiB 的继承上下文预算。
- 通过 managed git worktree，让写作者子会话隔离工作，同时仍可使用 `/parallel-review`、`/review-loop`、`/parallel-cleanup` 等评审流程。
- fleet 可观测性覆盖后台运行、`bg_wait`、`/subagents-fleet`，以及 `status.json`、run 文件、session 文件等机器可读生命周期产物。

## Installation
```bash
pi install npm:pi-subagents
```

## Quick Start
1. 安装该包。
2. 先用自然语言开始，例如 `Use reviewer to review this diff.` 或 `Ask oracle for a second opinion on my current plan.`。
3. 当你需要更结构化的流程时，再转向 `workflowScript`、`/parallel-review`、`/subagents-fleet` 等文档化工具与快捷命令。
4. 在允许子会话运行高成本、会修改文件、或会长期后台运行的工作流之前，先审查 model、authority 和 worktree 设置。

## Commands and Tools
- `subagent` 工具：执行委派、管理、状态和控制动作
- `workflowScript`：编排 fanout、lanes、steering、retry、aggregation
- `bg_wait`：阻塞或非阻塞地等待后台运行结果
- `/subagents-fleet`：查看实时 fleet 状态
- `/subagents-doctor`、`/subagents-guide`、`/subagents-models`、`/subagents-watchdog`
- `/parallel-review`、`/review-loop`、`/parallel-cleanup`、`/council`

## Configuration
- 上游文档描述了 `subagents.defaultModel`、`subagents.defaultProvider` 以及按 agent 维度的 override 设置。
- `fallbackModels`、thinking level、`subagents.maxThinking` 会影响 model 选择和思考深度。
- `timeoutMs`、`toolTimeoutMs`、`maxSubagentSpawnsPerSession`、`maxSubagentSpawnsPerRun` 用于限制运行时间和成本暴露。
- `authorityPolicy`、capability ceiling、preflight、worktree 基础目录设置、mission 设置共同决定子会话可做什么，以及持久记录写到哪里。
- 文档还描述了 async run 保留策略、worktree setup hook，以及 durable mission 和 schedule。

## Permissions and Security
- 公开文档说明子会话可以调用额外 model，因此委派通常会比单 agent 运行消耗更多 token 和 provider 成本。
- 文档没有把子会话描述为自动继承完整编排权；上游提供的控制包括 spawn budget、`authorityPolicy`、capability ceiling、preflight 校验和 `maxSubagentDepth`。
- 写作者隔离很重要：文档建议保持 one-writer discipline，并使用 managed worktree，避免多个会修改文件的子会话同时操作同一 checkout。
- 后台运行会在前台步骤返回后继续执行，并把 run 状态、session 与结果产物记录到磁盘。
- review 与 watchdog 流程可以在高权限动作继续之前，对子会话工具使用进行额外把关或审查。

## Compatibility
- 本页调研的 npm 版本是 `0.61.0`。
- 公开元数据说明它是一个 MIT 许可的 TypeScript Pi 扩展，peer 依赖包括可选的 `@earendil-works/pi-agent-core`、`@earendil-works/pi-ai`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`。
- 上游列出的运行时依赖包括 `acorn`、`jiti`、`typebox`、`yaml`。
- 公开仓库和 npm 元数据都表明这是为 Pi 打包的扩展，而不是独立托管服务。
- 本条目仅依据公开资料调研，不表示已经在本地运行测试。

## Limitations
- 公开文档说明旧的 chain 风格 API 和持久 `.chain.md` 执行已经属于 legacy，应改写为 `workflowScript`。
- fast mode 只适用于 allowlisted 的原生 OpenAI-Codex 子运行。
- 文档中的 `fallbackModels` 只处理 provider 或 model 失败，不处理运行级超时后的终止状态。
- 该包没有单独的官网；主要操作文档都放在 GitHub 仓库里。
- 这里描述的行为都来自上游文档和元数据，而不是在本次审阅中实际执行子代理工作流得出的结论。

## Upstream and License
- Repository: https://github.com/nicobailon/pi-subagents
- README: https://github.com/nicobailon/pi-subagents/blob/main/README.md
- Configuration docs: https://github.com/nicobailon/pi-subagents/blob/main/docs/configuration.md
- Workflow docs: https://github.com/nicobailon/pi-subagents/blob/main/docs/workflows.md
- Observability docs: https://github.com/nicobailon/pi-subagents/blob/main/docs/observability.md
- package metadata: https://www.npmjs.com/package/pi-subagents
- Latest researched release evidence: https://github.com/nicobailon/pi-subagents/releases and https://raw.githubusercontent.com/nicobailon/pi-subagents/main/CHANGELOG.md
- License: MIT。公开证据包括仓库 LICENSE 文件 https://raw.githubusercontent.com/nicobailon/pi-subagents/main/LICENSE 和 npm 包元数据。
