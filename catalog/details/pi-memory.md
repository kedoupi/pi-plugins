# Pi Memory

[English](./pi-memory.md) | [简体中文](./pi-memory.zh-CN.md)

> Research basis: 0.4.2, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
Pi Memory is a Pi extension that keeps durable session context in plain Markdown files, adding long-term memory, daily logs, a scratchpad, recoverable deletion, and optional search.

## Best For
Use it when Pi should remember durable facts, work logs, and short-term task lists across sessions, and plain local files are a better fit than a hosted memory service.

## Capabilities
- Stores long-term `MEMORY.md`, append-only daily logs, `SCRATCHPAD.md`, and recovery records under the Pi agent directory.
- Adds `memory_write`, `memory_read`, `memory_forget`, `memory_restore`, `memory_search`, `memory_status`, and `scratchpad` tools.
- Core read, write, forget, restore, scratchpad, and status workflows work without extra software.
- Optional qmd integration adds keyword, semantic, and deep search, collection creation, background re-indexing, and local embedding workflows.
- Upstream docs also describe cache-stable memory snapshots and automatic session handoff logging.

## Installation
```bash
pi install npm:pi-memory
```

## Quick Start
1. Install the package and start using `memory_write`, `memory_read`, `scratchpad`, and `memory_status` immediately.
2. Let the extension keep `MEMORY.md`, `SCRATCHPAD.md`, and `daily/YYYY-MM-DD.md` files under the Pi agent directory.
3. If you want semantic or deep search, install qmd and let the extension create or update its collection on first use.
4. Expect the first embedding run to download a model locally, which upstream docs say can take around a minute.

## Commands and Tools
- `memory_write` for long-term memory or daily-log entries
- `memory_read` for reading files or listing daily logs
- `scratchpad` for add, done, undo, clear, and list actions
- `memory_forget` to delete matching entries while creating a recovery record
- `memory_restore` to restore a deletion from its recovery ID
- `memory_search` for keyword, semantic, or deep search when qmd is installed
- `memory_status` to inspect storage, qmd, collection, and embedding status

## Configuration
- `PI_MEMORY_DIR` changes the storage directory; upstream docs default to `~/.pi/agent/memory`.
- `PI_MEMORY_SNAPSHOT` switches between `stable` snapshot mode and `per-turn` rebuilding.
- `PI_MEMORY_QMD_UPDATE` controls automatic qmd update and embed behavior.
- `PI_MEMORY_QMD_SEARCH_TIMEOUT_MS` sets the explicit search timeout.
- `PI_MEMORY_NO_SEARCH`, `PI_MEMORY_SUMMARIZE_TRANSITIONS`, `PI_MEMORY_EXIT_SUMMARY`, `PI_MEMORY_EXIT_SUMMARY_MODEL`, and `PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS` tune search injection and exit-summary behavior.

## Permissions and Security
- Upstream docs say the extension stores plain Markdown files locally under the Pi agent directory, so memory remains easy to inspect, edit, back up, or delete by hand.
- `memory_forget` writes the removed payload into `recovery/*.json` before editing memory files, so recovery data persists even after a forget action.
- qmd indexing and embeddings are optional; core tools keep working without qmd.
- When qmd is enabled, the extension may run qmd subprocesses, maintain local search indexes, and download an embedding model on first semantic-search use.
- That creates a privacy difference: plain local files stay readable text on disk, while optional embedding workflows add derived vector/index artifacts for search.
- Public sources describe no routine network traffic for the core tools beyond optional qmd model download and optional LLM-backed summaries.

## Compatibility
- npm package version researched here: `0.4.2`.
- Upstream package metadata lists Node.js `>=22.19.0` and peer dependencies `@earendil-works/pi-ai >=0.81.1` and `@earendil-works/pi-coding-agent >=0.81.1`.
- Public metadata describes an ESM package that Pi loads directly from `index.ts` without a separate build step.
- Core tools work without qmd; semantic and deep search require qmd on `PATH`.
- This entry is researched from public sources only and is not claimed as locally tested.

## Limitations
- `memory_search` and selective search injection require qmd; semantic and deep search are unavailable without it.
- The first semantic-search run may take extra time because qmd can download its embedding model locally.
- Stable snapshot mode updates memory at checkpoints rather than every turn, so the latest writes may need an explicit `memory_read` until the next refresh.
- qmd intentionally does not index `recovery/*.json`, so deleted content is recoverable through `memory_restore` but not expected to reappear in search results.
- The notes above come from upstream README, changelog, and source review, not from executing the extension here.

## Upstream and License
- Repository: https://github.com/jayzeng/pi-memory
- README: https://github.com/jayzeng/pi-memory/blob/main/README.md
- package metadata: https://www.npmjs.com/package/pi-memory
- Latest release evidence: https://github.com/jayzeng/pi-memory/blob/main/CHANGELOG.md and https://registry.npmjs.org/pi-memory/-/pi-memory-0.4.2.tgz
- License: MIT. Public evidence includes the repository LICENSE file https://github.com/jayzeng/pi-memory/blob/main/LICENSE and the npm package metadata.
- Provenance attestation: https://registry.npmjs.org/-/npm/v1/attestations/pi-memory@0.4.2
