# Pi Subagents

[English](./pi-subagents.md) | [简体中文](./pi-subagents.zh-CN.md)

> Research basis: 0.61.0, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Pi Subagents is a Pi extension for delegating focused jobs to child Pi sessions, covering single-agent handoffs, parallel or scripted workflows, background runs, managed worktrees, reviews, and fleet-style observability.

## Best For
Use it when one Pi session should coordinate repeatable task fanout, isolated writers, async reviews, or longer-running background work instead of doing everything inline.

## Capabilities
- Supports plain-language single-agent delegation as well as scripted `workflowScript` runs with `runs.run`, `runs.all`, `runs.lanes`, and `runs.steer`.
- Ships builtin agents such as `scout`, `researcher`, `worker`, `reviewer`, `oracle`, and `delegate`.
- Upstream docs describe forked, pruned, and fresh context modes, including a 64 KiB inherited-context budget.
- Managed git worktrees let writer children work in isolation while review flows such as `/parallel-review`, `/review-loop`, and `/parallel-cleanup` stay available.
- Fleet observability covers background runs, `bg_wait`, `/subagents-fleet`, and machine-readable lifecycle artifacts such as `status.json` plus run and session files.

## Installation
```bash
pi install npm:pi-subagents
```

## Quick Start
1. Install the package.
2. Start with plain language such as `Use reviewer to review this diff.` or `Ask oracle for a second opinion on my current plan.`
3. When you need more structure, move to documented tools and shortcuts like `workflowScript`, `/parallel-review`, or `/subagents-fleet`.
4. Review model, authority, and worktree settings before letting child sessions run expensive, mutating, or background-heavy workflows.

## Commands and Tools
- `subagent` tool for delegation, management, status, and control actions
- `workflowScript` for scripted fanout, lanes, steering, retry, and aggregation
- `bg_wait` for blocking or non-blocking waiting on background runs
- `/subagents-fleet` for live fleet inspection
- `/subagents-doctor`, `/subagents-guide`, `/subagents-models`, `/subagents-watchdog`
- `/parallel-review`, `/review-loop`, `/parallel-cleanup`, and `/council`

## Configuration
- Upstream docs describe `subagents.defaultModel`, `subagents.defaultProvider`, and per-agent override settings.
- `fallbackModels`, thinking levels, and `subagents.maxThinking` shape model selection and depth.
- `timeoutMs`, `toolTimeoutMs`, `maxSubagentSpawnsPerSession`, and `maxSubagentSpawnsPerRun` limit runtime and cost exposure.
- `authorityPolicy`, capability ceilings, preflight checks, worktree base settings, and mission settings control what children may do and where durable records live.
- Docs also describe async run retention, worktree setup hooks, and durable missions or schedules.

## Permissions and Security
- Public docs say child sessions can invoke additional models, which means delegation can increase token usage and provider cost beyond a single-agent run.
- Child authority is not described as automatic full inheritance; upstream controls include spawn budgets, `authorityPolicy`, capability ceilings, preflight validation, and `maxSubagentDepth`.
- Writer isolation matters: docs recommend one-writer discipline and managed worktrees so multiple mutating children do not edit the same checkout unsafely.
- Background runs keep working after the foreground step returns, and observability artifacts record run state, sessions, and results on disk.
- Review and watchdog flows can gate or inspect child tool use before high-authority actions proceed.

## Compatibility
- npm package version researched here: `0.61.0`.
- Public metadata describes an MIT-licensed TypeScript Pi extension with optional peer dependencies on `@earendil-works/pi-agent-core`, `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, and `@earendil-works/pi-tui`.
- Runtime dependencies listed upstream include `acorn`, `jiti`, `typebox`, and `yaml`.
- Public repository and npm metadata both show current packaging for Pi rather than a standalone hosted service.
- This entry is researched from public sources only and is not claimed as locally tested.

## Limitations
- Public docs say older chain-style APIs and durable `.chain.md` execution are legacy and should be rewritten as `workflowScript`.
- Fast mode only applies to allowlisted native OpenAI-Codex child runs.
- Documented `fallbackModels` handle provider or model failures, not terminal run-level timeout expiry.
- The package has no separate standalone homepage; operational docs live in the GitHub repository.
- The behavior described here comes from upstream documentation and metadata, not from executing subagent workflows in this review.

## Upstream and License
- Repository: https://github.com/nicobailon/pi-subagents
- README: https://github.com/nicobailon/pi-subagents/blob/main/README.md
- Configuration docs: https://github.com/nicobailon/pi-subagents/blob/main/docs/configuration.md
- Workflow docs: https://github.com/nicobailon/pi-subagents/blob/main/docs/workflows.md
- Observability docs: https://github.com/nicobailon/pi-subagents/blob/main/docs/observability.md
- package metadata: https://www.npmjs.com/package/pi-subagents
- Latest researched release evidence: https://github.com/nicobailon/pi-subagents/releases and https://raw.githubusercontent.com/nicobailon/pi-subagents/main/CHANGELOG.md
- License: MIT. Public evidence includes the repository LICENSE file https://raw.githubusercontent.com/nicobailon/pi-subagents/main/LICENSE and the npm package metadata.
