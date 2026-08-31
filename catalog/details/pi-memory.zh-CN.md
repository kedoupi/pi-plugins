# Pi Memory

[English](./pi-memory.md) | [简体中文](./pi-memory.zh-CN.md)

> Research basis: 0.4.2, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Pi Memory 是一个 Pi 扩展，会把跨会话上下文保存在纯 Markdown 文件中，提供长期记忆、日报、scratchpad、可恢复删除和可选搜索能力。

## Best For
适合希望 Pi 跨会话记住长期事实、工作日志和短期任务列表，同时更偏好本地文件而不是托管记忆服务的用户。

## Capabilities
- 在 Pi agent 目录下保存长期 `MEMORY.md`、追加式 daily 日志、`SCRATCHPAD.md` 和恢复记录。
- 提供 `memory_write`、`memory_read`、`memory_forget`、`memory_restore`、`memory_search`、`memory_status`、`scratchpad` 工具。
- 核心的读、写、忘记、恢复、scratchpad 和状态功能不需要额外软件即可使用。
- 可选 qmd 集成会增加关键词、语义和 deep search，以及 collection 创建、后台重建索引和本地 embedding 工作流。
- 上游文档还描述了 cache-stable memory snapshot 和自动会话交接日志。

## Installation
```bash
pi install npm:pi-memory
```

## Quick Start
1. 安装后即可直接使用 `memory_write`、`memory_read`、`scratchpad`、`memory_status`。
2. 让扩展在 Pi agent 目录下维护 `MEMORY.md`、`SCRATCHPAD.md` 和 `daily/YYYY-MM-DD.md`。
3. 如果需要语义或 deep search，再安装 qmd，并让扩展在首次使用时创建或更新其 collection。
4. 首次 embedding 运行会在本地下载模型；上游文档说明这一步可能要接近一分钟。

## Commands and Tools
- `memory_write`：写入长期记忆或日报条目
- `memory_read`：读取记忆文件或列出 daily 日志
- `scratchpad`：执行 add、done、undo、clear、list
- `memory_forget`：删除匹配条目，并同时创建恢复记录
- `memory_restore`：通过 recovery ID 恢复删除内容
- `memory_search`：在安装 qmd 后执行关键词、语义或 deep search
- `memory_status`：查看存储目录、qmd、collection、embedding 状态

## Configuration
- `PI_MEMORY_DIR` 可更改存储目录；上游默认值是 `~/.pi/agent/memory`。
- `PI_MEMORY_SNAPSHOT` 可在 `stable` 快照模式和 `per-turn` 重建之间切换。
- `PI_MEMORY_QMD_UPDATE` 控制 qmd 自动更新与 embedding 行为。
- `PI_MEMORY_QMD_SEARCH_TIMEOUT_MS` 设置显式搜索超时。
- `PI_MEMORY_NO_SEARCH`、`PI_MEMORY_SUMMARIZE_TRANSITIONS`、`PI_MEMORY_EXIT_SUMMARY`、`PI_MEMORY_EXIT_SUMMARY_MODEL`、`PI_MEMORY_EXIT_SUMMARY_TIMEOUT_MS` 用于调节搜索注入和退出摘要行为。

## Permissions and Security
- 上游文档说明该扩展把纯 Markdown 文件保存在 Pi agent 目录下，因此记忆内容便于人工查看、编辑、备份或删除。
- `memory_forget` 会在修改记忆文件之前先把被删内容写入 `recovery/*.json`，因此恢复数据会在 forget 后继续存在。
- qmd 索引和 embedding 完全是可选的；没有 qmd 时核心工具仍可工作。
- 启用 qmd 后，扩展可能运行 qmd 子进程、维护本地搜索索引，并在首次语义搜索时下载 embedding 模型。
- 这带来一个隐私差异：纯本地文件只是可读文本，而可选 embedding 工作流会额外生成用于搜索的向量或索引衍生物。
- 公开资料没有描述核心工具的常规网络流量；额外网络行为主要来自可选 qmd 模型下载和可选的 LLM 摘要。

## Compatibility
- 本页调研的 npm 版本是 `0.4.2`。
- 上游包元数据列出 Node.js `>=22.19.0`，以及 peer 依赖 `@earendil-works/pi-ai >=0.81.1`、`@earendil-works/pi-coding-agent >=0.81.1`。
- 公开元数据说明这是一个 ESM 包，Pi 会直接从 `index.ts` 加载，而不要求单独构建步骤。
- 核心工具无需 qmd；语义和 deep search 需要 qmd 在 `PATH` 上可用。
- 本条目仅依据公开资料调研，不表示已经在本地运行测试。

## Limitations
- `memory_search` 和选择性搜索注入依赖 qmd；没有 qmd 时无法使用语义和 deep search。
- 首次语义搜索可能较慢，因为 qmd 可能需要在本地下载 embedding 模型。
- 稳定快照模式只在检查点刷新记忆，而不是每轮都更新，所以最新写入有时需要显式 `memory_read` 才能立刻看到。
- qmd 按设计不会索引 `recovery/*.json`，因此删除内容可以通过 `memory_restore` 恢复，但不应再从搜索结果中出现。
- 以上说明来自上游 README、changelog 和源码审阅，而不是在此环境中实际执行扩展得到的结论。

## Upstream and License
- Repository: https://github.com/jayzeng/pi-memory
- README: https://github.com/jayzeng/pi-memory/blob/main/README.md
- package metadata: https://www.npmjs.com/package/pi-memory
- Latest release evidence: https://github.com/jayzeng/pi-memory/blob/main/CHANGELOG.md and https://registry.npmjs.org/pi-memory/-/pi-memory-0.4.2.tgz
- License: MIT。公开证据包括仓库 LICENSE 文件 https://github.com/jayzeng/pi-memory/blob/main/LICENSE 和 npm 包元数据。
- Provenance attestation: https://registry.npmjs.org/-/npm/v1/attestations/pi-memory@0.4.2
