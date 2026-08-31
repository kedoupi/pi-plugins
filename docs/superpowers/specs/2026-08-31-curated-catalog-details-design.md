# Kedoupi Curated Catalog 详情页设计规范

- 日期：2026-08-31
- 状态：已批准
- 仓库：[`kedoupi/pi-plugins`](https://github.com/kedoupi/pi-plugins)
- 基础规范：[`2026-08-31-kedoupi-pi-plugins-design.md`](./2026-08-31-kedoupi-pi-plugins-design.md)

## 1. 目标

将当前只有简短摘要的精选目录升级为两层人工精选文档系统：

1. `CATALOG.md` 保持精简，承担分类、发现和快速比较。
2. 每个插件提供英文与简体中文详情页，说明功能、适用场景、使用方法、配置、安全影响、兼容性和限制。
3. `catalog/plugins.json` 继续作为客观元数据的唯一来源。
4. Catalog 同时支持 Pi 官方的 npm 与 Git Package 来源。
5. 所有结构、链接和元数据一致性由本地 Node.js 标准库脚本与现有 CI 确定性校验。

该升级的核心价值是人工调研与解释，不是复制上游 README，也不是建设另一个全量插件市场。

## 2. 已确认范围

本阶段覆盖当前用户实际安装的 8 个公开 Package：

| ID | 推荐来源 | 上游仓库 |
|---|---|---|
| `ax-feishu-bridge` | `npm:ax-feishu-bridge` | `AX1202/ax-feishu-bridge` |
| `pi-lsp` | `npm:@narumitw/pi-lsp` | `narumiruna/pi-extensions` |
| `pi-memory` | `npm:pi-memory` | `jayzeng/pi-memory` |
| `pi-powerline-footer` | `npm:pi-powerline-footer` | `nicobailon/pi-powerline-footer` |
| `pi-subagents` | `npm:pi-subagents` | `nicobailon/pi-subagents` |
| `pi-web-access` | `npm:pi-web-access` | `nicobailon/pi-web-access` |
| `ponytail` | `npm:@dietrichgebert/ponytail` | `DietrichGebert/ponytail` |
| `superpowers` | `git:github.com/obra/superpowers` | `obra/superpowers` |

来源选择规则：官方项目同时提供 npm 与 Git 安装时优先 npm；只有 Git 是有效 Pi 来源时使用 Git。npm 上的 `superpowers@0.0.2` 与 `obra/superpowers` 无关，不得误收录。

每个条目新增一对详情页，共 16 个 Markdown 文件。现有 5 个条目迁移到新模型，并新增 Ponytail、Superpowers 和 pi-memory。

## 3. 非目标

本阶段不做：

- 复制或镜像第三方源码。
- 复制完整上游 README。
- 自动爬取或自动收录插件。
- 在 CI 中联网检查 npm、GitHub、Stars、下载量或最新版本。
- 因资料调研而把条目自动升级为 `tested` 或 `reviewed`。
- 对第三方插件作绝对安全承诺。
- 为详情页建设网站、数据库、全文搜索或 Markdown 生成器。
- 设置随时间自动失败的“资料过期”门禁。

## 4. 信息架构

```text
catalog/
├── plugins.json
└── details/
    ├── <id>.md
    └── <id>.zh-CN.md

CATALOG.md
```

职责边界：

- `catalog/plugins.json`：来源、状态、许可证、调研版本、日期、分类和摘要等结构化事实。
- `catalog/details/<id>.md`：英文人工调研详情。
- `catalog/details/<id>.zh-CN.md`：对应简体中文详情。
- `CATALOG.md`：由 JSON 生成的精简索引，链接英文详情、中文详情和上游仓库。

详情页文件名由 `id` 确定，不在 JSON 中重复保存路径。

## 5. Catalog 数据模型

条目采用以下模型：

```json
{
  "id": "superpowers",
  "name": "Superpowers",
  "source": "git:github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
  "categories": ["developer-tools", "workflow"],
  "summary": "解决什么问题",
  "recommendation": "适合谁以及为什么值得推荐",
  "license": "MIT",
  "status": "community",
  "researchedVersion": "6.3.0",
  "researchedAt": "2026-08-31",
  "testedVersion": null,
  "testedPiVersion": null,
  "testedAt": null,
  "conflicts": [],
  "notes": []
}
```

### 5.1 来源

`source` 直接使用 Pi 官方安装语法：

- npm：`npm:<package>`
- GitHub Git：`git:github.com/<owner>/<repo>`

目录保存未固定版本的推荐来源；安装命令由程序派生：

```text
pi install <source>
```

旧字段 `package` 和 `install` 被 `source` 替代，避免来源与安装命令重复并产生漂移。条目按 `id` 和 `source` 分别去重。

### 5.2 调研证据与测试证据

- `researchedVersion`：撰写详情页时核验的上游 npm 版本、Release 或 Git 版本。
- `researchedAt`：公开资料核验日期，格式 `YYYY-MM-DD`。
- `testedVersion`、`testedPiVersion`、`testedAt`：只记录实际功能验证。

“本机已经安装”和“阅读过上游资料”都不足以升级状态。本阶段 8 个条目保持 `community`，测试证据字段为 `null`。

不设置基于当前日期的自动过期失败。页面展示调研日期，由维护者在真实变更或定期维护时更新。

## 6. 详情页标准

英文与中文详情页使用相同英文二级标题，以便共享确定性校验：

```markdown
# Plugin Name

[English](./id.md) | [简体中文](./id.zh-CN.md)

> Research basis: vX.Y.Z, checked YYYY-MM-DD.
> Documentation review only; not a security guarantee.

## About
## Best For
## Capabilities
## Installation
## Quick Start
## Commands and Tools
## Configuration
## Permissions and Security
## Compatibility
## Limitations
## Upstream and License
```

中文页保留英文标题，正文使用简体中文。两页必须互相链接。

### 6.1 内容要求

- `About`：一句话定义和核心用途。
- `Best For`：适用用户、工作流和不适合的场景。
- `Capabilities`：实际能力清单，不写无法验证的营销描述。
- `Installation`：必须包含由 `source` 派生的精确安装命令。
- `Quick Start`：安装后最短可执行步骤。
- `Commands and Tools`：主要命令、工具、快捷键及其用途。
- `Configuration`：最常用配置和配置位置；完整选项链接上游。
- `Permissions and Security`：文件、网络、凭据、Cookie、子进程、模型调用和费用行为。
- `Compatibility`：上游声明的 Pi、Node、平台和 peer range；不得冒充本地验证。
- `Limitations`：已知限制、冲突和需要人工判断的边界。
- `Upstream and License`：GitHub、npm（如适用）、README、Release 和许可证来源。

详情页应重新组织公开事实，不大段复制上游文字。不得包含用户本机路径、私有插件、真实配置值、Cookie、API Key 或其他凭据。

### 6.2 调研基线

每个插件至少核验：

1. GitHub 仓库、默认分支、归档状态和 Release。
2. npm 元数据或官方 Git 安装方式。
3. Package manifest、许可证、依赖和 Pi 资源声明。
4. README 中的功能、安装、命令、配置和限制。
5. 网络、文件、凭据、Cookie、子进程和付费服务行为。
6. 上游声明的兼容范围和已知冲突。

详情页中的调研版本和日期必须与 JSON 一致。上游链接承担事实追溯，不在仓库保存抓取结果或完整 README 副本。

## 7. CATALOG.md 展示

`CATALOG.md` 继续由 `catalog/plugins.json` 生成。每项仅展示：

- 名称与一句摘要。
- 推荐理由。
- 状态。
- Source。
- 派生安装命令。
- 许可证。
- 调研版本与日期。
- 测试状态。
- `Details: English · 简体中文 · Upstream`。

标题链接英文详情页；Upstream 使用独立链接，避免详情页与源码入口混淆。

## 8. 确定性校验

现有 `npm run check` 必须在无网络、无凭据环境中完成全部检查。

### 8.1 JSON 校验

- `source` 只接受规范的未固定 `npm:` 或 `git:github.com/...` 来源。
- `id` 和 `source` 唯一。
- `repository` 必须为 GitHub HTTPS URL；Git 来源中的 owner/repo 必须与 repository 对应。
- 迁移后的条目如果残留旧 `package` 或 `install` 字段则失败。
- `researchedVersion` 为非空字符串。
- `researchedAt` 使用 `YYYY-MM-DD`。
- 现有状态和测试证据规则保持不变。
- 旧 `package`、`install` 字段不再进入新模型。

### 8.2 详情页校验

- 每个条目必须存在 `<id>.md` 和 `<id>.zh-CN.md`。
- `catalog/details/` 不允许没有对应条目的孤立 Markdown 文件。
- 必需二级标题存在、唯一且非空。
- 两种语言页面互相链接。
- 页面包含与 JSON 一致的调研版本和日期。
- `Installation` 包含精确的 `pi install <source>`。
- `Upstream and License` 包含对应仓库和许可证信息。

Markdown 结构校验复用现有标准库标题解析逻辑，不新增 Markdown 解析依赖。

### 8.3 生成结果校验

- Renderer 从 `source` 派生安装命令。
- Renderer 生成稳定排序的详情链接。
- `npm run catalog:check` 检测过期的 `CATALOG.md`。
- 缺失文件、孤立文件和元数据漂移以可定位路径的错误信息失败。

## 9. 测试策略

采用 TDD，最少覆盖：

1. npm 与 Git 来源均可通过。
2. 非规范来源、固定版本来源和重复来源被拒绝。
3. `researchedVersion`、`researchedAt` 缺失或格式错误被拒绝。
4. 缺失英文页或中文页被拒绝。
5. 孤立详情页被拒绝。
6. 缺失、重复或空章节被拒绝。
7. 双语链接缺失被拒绝。
8. 安装命令、调研版本或日期与 JSON 不一致时被拒绝。
9. Renderer 为 npm/Git 来源生成正确命令和双语详情链接。
10. 8 个真实条目通过完整校验，`CATALOG.md` 可重复生成。

完整门禁保持：

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
git diff --check
```

## 10. 贡献与维护流程

```text
发现候选 Package
→ 核验公开上游与安装来源
→ 更新 plugins.json
→ 编写英文与中文详情页
→ 运行 Catalog 渲染和完整门禁
→ 维护者检查事实、许可证和敏感行为
→ 合并
```

社区 PR 必须同时提交结构化元数据和双语详情页。贡献者只能使用 `community`；`tested` 与 `reviewed` 仍由维护者根据独立证据授予。

上游归档、许可证变化、安装来源失效或功能描述严重过期时，更新资料或标记 `deprecated`。CI 不主动联网，因此上游可用性不会让无关 PR 随机失败。

## 11. 实施编排

实施采用多 Agent 编排并保持一个工作区只有一个写入者：

1. 一个实现 Agent 迁移来源模型、校验器、Renderer 和测试。
2. 多个只读调研 Agent 并行核验 8 个公开项目，输出有来源的研究摘要。
3. 一个内容写入 Agent 统一更新 JSON、16 个详情页和政策文档。
4. 独立事实审查检查功能、安装、许可证、兼容性和安全描述。
5. 独立代码审查检查 schema、校验、生成和测试。
6. 主 Agent 运行完整门禁并负责集成。

研究 Agent 不直接写共享 Catalog 文件，避免并行内容冲突和元数据漂移。

## 12. 完成标准

- Catalog 使用统一 `source` 模型支持 npm 与 Git。
- 8 个当前公开 Package 全部进入 Catalog。
- 每个条目有英文和中文详情页，共 16 页。
- 详情页覆盖功能、用法、配置、安全、兼容性、限制和上游证据。
- 所有条目保持诚实的 `community` 状态，调研证据与测试证据明确分离。
- `CATALOG.md` 提供稳定的精简索引和三类链接。
- 缺页、孤立页、结构错误和元数据漂移均由 CI 阻止。
- 所有检查离线、确定性、无新增运行时依赖。
- README、Catalog Policy、PR 模板和测试文档与新流程一致。
- 完整门禁通过，工作区无未提交改动。
