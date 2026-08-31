# Ponytail

[English](./ponytail.md) | [简体中文](./ponytail.zh-CN.md)

> Research basis: 4.9.0, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Ponytail is a behavioral Pi package that pushes coding agents toward lazy-senior-developer minimalism: question whether the work needs to exist, prefer reuse and the standard library, fix root causes once, and avoid speculative abstraction.

## Best For
Use it when you want Pi and other supported coding harnesses to bias toward YAGNI, deletion, and the smallest correct change instead of building more framework than the task needs.

## Capabilities
- Enforces the documented solution ladder: skip speculative work, reuse repo code, prefer stdlib and native features, use existing dependencies, then write the minimum code that works.
- Keeps the minimalism mode always on by default until explicitly disabled.
- Upstream skills also cover focused review, audit, debt, gain, help, and review-only workflows.
- The rules explicitly push root-cause fixes over patching only the visible symptom.
- Pi integration adds `/ponytail`, status-bar state, and automatic skill loading through the package's extension and skills directory.

## Installation
```bash
pi install npm:@dietrichgebert/ponytail
```

## Quick Start
1. Install the package.
2. Use `/ponytail` to see the active mode.
3. Switch intensity with `/ponytail lite`, `/ponytail full`, or `/ponytail ultra`.
4. Turn it off with `stop ponytail` or `normal mode`, or persist a default with `/ponytail default <mode>`.

## Commands and Tools
- `/ponytail` for current status
- `/ponytail lite|full|ultra` to change intensity
- `/ponytail default <mode>` to persist a restart-surviving default
- `/ponytail status` and `/ponytail review`
- Named skills: `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review`
- Pi extension integration in `pi-extension/index.js` and cross-agent hooks documented in `hooks/`

## Configuration
- Public package metadata declares a Pi extension plus a skills directory.
- Upstream docs describe the mode set `lite`, `full`, `ultra`, `off`, and a session-only `review` level.
- `/ponytail default <mode>` stores a durable default according to the release notes.
- Documented options also include `PONYTAIL_SUBAGENT_MATCHER`, status-indicator visibility controls, and `quietStartup`.
- Multi-harness support comes from repository hooks and install docs for Pi, Claude Code, Codex, Copilot, Grok, Cursor, JetBrains, and other listed tools.

## Permissions and Security
- Ponytail changes agent decisions and prompting behavior; it does not add project runtime features or ship an application service for your codebase.
- Pi activates it through the package extension and bundled skills, while other harnesses use their documented hook or plugin paths.
- The upstream rules explicitly say not to simplify away input validation at trust boundaries, security measures, accessibility basics, or error handling that prevents data loss.
- Public docs also say a user-requested full solution should still be built rather than argued away.
- Any effect on your repository comes indirectly through the agent choices Ponytail influences, not through a standalone runtime daemon.

## Compatibility
- npm package version researched here: `4.9.0`.
- Official source for Pi is `npm:@dietrichgebert/ponytail`.
- Public metadata and repository docs show MIT licensing, a Pi extension, a bundled skills directory, and cross-harness scope rather than Pi-only usage.
- Public materials also mention an optional `ponytail-mcp` companion.
- This entry is researched from public sources only and is not claimed as locally tested.

## Limitations
- Ponytail is primarily a prompt-and-skill discipline, so results still depend on the coding harness and model following those instructions.
- Benchmark and safety claims in the upstream repo are documentation claims, not independent test evidence here.
- The README notes at least one terse reasoning model can become slower or more expensive while deliberating the ladder.
- It governs what the agent builds, not how the project runs after the code is written.
- Disabling it is explicit; otherwise the mode persists until changed.

## Upstream and License
- Repository: https://github.com/DietrichGebert/ponytail
- README: https://github.com/DietrichGebert/ponytail#readme
- package metadata: https://www.npmjs.com/package/@dietrichgebert/ponytail
- Latest researched release evidence: https://github.com/DietrichGebert/ponytail/releases/tag/v4.9.0
- Pi integration evidence: https://github.com/DietrichGebert/ponytail/blob/main/package.json and https://github.com/DietrichGebert/ponytail/blob/main/pi-extension/index.js
- License: MIT. Public evidence includes the repository LICENSE file https://github.com/DietrichGebert/ponytail/blob/main/LICENSE and the npm package metadata.
