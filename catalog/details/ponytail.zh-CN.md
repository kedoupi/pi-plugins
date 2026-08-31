# Ponytail

[English](./ponytail.md) | [简体中文](./ponytail.zh-CN.md)

> Research basis: 4.9.0, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
Ponytail 是一个偏行为层的 Pi Package，会把 coding agent 推向 lazy-senior-developer 式的极简主义：先质疑这项工作是否有必要存在，优先复用和标准库，一次性修根因，避免投机式抽象。

## Best For
适合希望 Pi 和其他受支持的 coding harness 更稳定地偏向 YAGNI、删除优先、以及最小正确改动，而不是为了一个任务搭出过度框架的用户。

## Capabilities
- 执行其文档化 solution ladder：先跳过投机需求，再复用仓库现有代码，优先 stdlib 和原生能力，再考虑现有依赖，最后才写最少能工作的代码。
- 默认保持 always-on minimalism，直到被显式关闭。
- 上游还提供围绕 review、audit、debt、gain、help、review-only 的聚焦技能。
- 规则明确要求优先做 root-cause fix，而不是只补表面症状。
- Pi 集成通过扩展和 skills 目录自动加载，并提供 `/ponytail` 命令和状态栏状态显示。

## Installation
```bash
pi install npm:@dietrichgebert/ponytail
```

## Quick Start
1. 安装该包。
2. 先用 `/ponytail` 查看当前模式。
3. 用 `/ponytail lite`、`/ponytail full`、`/ponytail ultra` 切换强度。
4. 需要关闭时使用 `stop ponytail` 或 `normal mode`，需要持久默认值时使用 `/ponytail default <mode>`。

## Commands and Tools
- `/ponytail`：查看当前状态
- `/ponytail lite|full|ultra`：切换强度
- `/ponytail default <mode>`：保存跨重启保留的默认模式
- `/ponytail status` 与 `/ponytail review`
- 命名技能：`ponytail`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain`、`ponytail-help`、`ponytail-review`
- Pi 扩展入口在 `pi-extension/index.js`，跨 agent 的 hook 配置记录在 `hooks/`

## Configuration
- 公开包元数据声明了一个 Pi extension 和一个 skills 目录。
- 上游文档描述的模式包括 `lite`、`full`、`ultra`、`off`，以及仅限当前会话的 `review` 级别。
- release notes 说明 `/ponytail default <mode>` 会保存 durable default。
- 文档化选项还包括 `PONYTAIL_SUBAGENT_MATCHER`、状态指示器隐藏控制，以及 `quietStartup`。
- 多 harness 支持来自仓库中的 hook 与安装文档，覆盖 Pi、Claude Code、Codex、Copilot、Grok、Cursor、JetBrains 等列出的环境。

## Permissions and Security
- Ponytail 影响的是 agent 的决策和提示词行为；它不会给你的项目增加新的运行时功能，也不是一个单独运行的服务。
- 在 Pi 中，它通过包内扩展和 bundled skills 生效；在其他 harness 中，则走各自文档化的 hook 或 plugin 路径。
- 上游规则明确说，不能为了省事而删掉信任边界输入校验、安全措施、无障碍基础，或防止数据丢失的错误处理。
- 公开文档还说明，如果用户明确要求完整方案，就应该实现，而不是继续争辩省略它。
- 因此它对仓库的影响是间接的：影响 agent 的选择，而不是通过某个独立 daemon 直接修改项目运行行为。

## Compatibility
- 本页调研的 npm 版本是 `4.9.0`。
- Pi 的官方安装来源是 `npm:@dietrichgebert/ponytail`。
- 公开元数据和仓库文档显示它采用 MIT 许可，提供 Pi extension、bundled skills，并覆盖多种 harness，而不是只限 Pi。
- 公开资料还提到一个可选的 `ponytail-mcp` companion。
- 本条目仅依据公开资料调研，不表示已经在本地运行测试。

## Limitations
- Ponytail 主要是 prompt 与 skill 层面的纪律，因此效果仍取决于具体 coding harness 和 model 是否遵循这些指令。
- 上游仓库里的 benchmark 和 safety 结论都只是文档声称，不是这里的独立测试证据。
- README 还提到，至少有一种偏简洁的推理模型会因为反复思考 ladder 而变慢或更贵。
- 它约束的是 agent 如何构建，而不是代码写完后项目如何运行。
- 若不显式关闭，该模式会持续保留。

## Upstream and License
- Repository: https://github.com/DietrichGebert/ponytail
- README: https://github.com/DietrichGebert/ponytail#readme
- package metadata: https://www.npmjs.com/package/@dietrichgebert/ponytail
- Latest researched release evidence: https://github.com/DietrichGebert/ponytail/releases/tag/v4.9.0
- Pi integration evidence: https://github.com/DietrichGebert/ponytail/blob/main/package.json and https://github.com/DietrichGebert/ponytail/blob/main/pi-extension/index.js
- License: MIT。公开证据包括仓库 LICENSE 文件 https://github.com/DietrichGebert/ponytail/blob/main/LICENSE 和 npm 包元数据。
