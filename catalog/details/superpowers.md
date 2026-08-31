# Superpowers

[English](./superpowers.md) | [简体中文](./superpowers.zh-CN.md)

> Research basis: 6.3.0, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Superpowers is a workflow package for coding agents: a set of composable skills plus runtime bootstrap instructions that push agents toward design, planning, TDD, debugging, review, worktree isolation, and branch-finishing discipline.

## Best For
Use it when you want an opinionated software-development process on top of Pi, with explicit brainstorming, plans, red/green TDD, worktrees, review loops, verification, and end-of-branch cleanup.

## Capabilities
- Upstream skills cover brainstorming, writing plans, test-driven development, systematic debugging, code review, verification before completion, and finishing a development branch.
- The docs also describe `using-git-worktrees`, `executing-plans`, `subagent-driven-development`, and dispatching parallel agents.
- In Pi, installation adds skills plus a small extension that injects the `using-superpowers` bootstrap at session start and after compaction.
- The documented process can create specs, plans, branches, worktrees, commits, and review artifacts rather than only changing code inline.
- Upstream v6.3.0 release notes also mention SDD conflict handling, batching, and broader harness support.

## Installation
```bash
pi install git:github.com/obra/superpowers
```

## Quick Start
1. Install from the Git repository source above.
2. Start a Pi session; upstream docs say the package extension injects the `using-superpowers` bootstrap automatically.
3. Use the documented workflow skills as needed, such as brainstorming before design, writing-plans before implementation, and TDD or systematic-debugging when coding starts.
4. If you only want a temporary local checkout, upstream docs also show `pi -e /path/to/superpowers`.

## Commands and Tools
- `pi install git:github.com/obra/superpowers`
- `pi -e /path/to/superpowers`
- `brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`
- `using-git-worktrees`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`
- `verification-before-completion`, `finishing-a-development-branch`, `executing-plans`, `dispatching-parallel-agents`
- Repository maintainer scripts such as `bump-version.sh` and `package-codex-plugin.sh` are documented upstream but are not needed for normal Pi use

## Configuration
- Public package metadata declares Pi skills plus a Pi extension at `./.pi/extensions/superpowers.ts`.
- Upstream docs say the Pi extension injects bootstrap content on `session_start` and `session_compact`, then stops at `agent_end`.
- The repository also carries harness-specific plugin manifests for Claude Code, Cursor, Codex, Devin, Gemini, Grok, Hermes, Kimi, and others.
- Optional telemetry for the visual companion can be disabled with `SUPERPOWERS_DISABLE_TELEMETRY` or the documented harness-specific disable flags.
- This is a workflow layer, so its main configuration surface is which skills and process steps the coding agent follows.

## Permissions and Security
- Superpowers influences agent behavior rather than adding application runtime features to your project.
- The documented process adds approval gates and extra steps before implementation, destructive actions, or branch cleanup.
- Some workflows can use subagents or additional models, so the package can increase token usage and create more repository artifacts than an unstructured single-agent session.
- Worktree, branch, commit, and review flows can mutate the repository by design; upstream docs specifically say branch-finishing should avoid destroying untracked or uncommitted work.
- Public docs reviewed here do not describe credential handling in the package itself, but the workflow can still touch whatever repo files and local tools the host agent is allowed to use.

## Compatibility
- Upstream release researched here: `6.3.0`.
- Official Pi installation source is Git: `git:github.com/obra/superpowers`.
- Public metadata and docs describe MIT licensing and explicit support for Pi plus many other coding harnesses.
- Pi-specific docs note that Pi has native skills, so the package relies on Pi's normal skill system rather than a separate Skill tool.
- This entry is researched from public sources only and is not claimed as locally tested.

## Limitations
- This package is mainly an instruction and workflow framework, so effectiveness depends on the coding harness and model actually following the prompts.
- It is not distributed from npm for Pi use; the npm package `superpowers@0.0.2` is unrelated and should not be used as the installation source here.
- Some harnesses have weaker hook support, and upstream docs note that very long sessions may lose bootstrap after compaction in certain environments.
- Subagent and task-list tooling are documented as optional companions rather than guaranteed bundled capabilities in every harness.
- The workflow claims summarized here come from upstream README and release notes, not from independently running the full method in this review.

## Upstream and License
- Repository: https://github.com/obra/superpowers
- README: https://github.com/obra/superpowers/blob/main/README.md
- Pi extension bootstrap: https://github.com/obra/superpowers/blob/main/.pi/extensions/superpowers.ts
- Release notes: https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md
- License: MIT. Public evidence includes the repository LICENSE file https://github.com/obra/superpowers/blob/main/LICENSE
- Name collision note: https://www.npmjs.com/package/superpowers is an unrelated npm package and is not the Pi installation source for this entry.
