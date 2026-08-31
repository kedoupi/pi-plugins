# Kedoupi Pi Plugins 设计规范

- 日期：2026-08-31
- 状态：待用户复核
- GitHub 品牌：[`@kedoupi`](https://github.com/kedoupi)
- 候选仓库：`kedoupi/pi-plugins`
- 候选 npm scope：`@kedoupi`

## 1. 目标

建设一个品牌化的 Pi Package 开发主仓库，同时承担四项职责：

1. 开发和维护 `@kedoupi` 第一方 Pi Package。
2. 提供统一的开发、测试、发布和安全规范。
3. 提供经过人工筛选的第三方 Pi Package 目录。
4. 作为 `@kedoupi` Pi 生态项目的品牌入口。

该项目不是 Pi 官方市场的镜像，也不追求收录所有 Package。其差异化是中文友好、真实使用验证、明确推荐理由、兼容性记录和人工审核。

## 2. 已确认决策

- 使用一个 GitHub monorepo 管理第一方 Package、规范和精选目录。
- 使用 npm workspaces，不引入额外包管理器要求。
- 根仓库不可安装、不可发布，只作为开发和品牌入口。
- 第一方 Package 位于 `packages/`，独立版本、独立测试、独立发布。
- 提供独立的 `@kedoupi/pi-suite`，用于一键安装全部第一方插件。
- Suite 不包含未经修改的第三方 Package。
- 第三方推荐只保存元数据、评价和上游链接，不复制源码。
- 本地开发采用“项目隔离测试 → 全局本地源码 dogfood → npm 正式版”两层模式。
- 精选目录接受社区 PR，但必须经过维护者人工审核。
- 后续实现采用多 Agent 编排，但每个工作区同一时间只允许一个写入者。

## 3. 非目标

第一阶段不建设：

- 全量 npm/GitHub 爬虫。
- 数据库或后端服务。
- 自定义 Package 安装器。
- 独立插件市场协议。
- 复杂搜索网站。
- 自动安全认证或“绝对安全”承诺。
- 在规范未经真实插件验证前生成大量脚手架和 Skill。

Pi 已有官方 Package Catalog 和第三方 Awesome 目录。本项目只做品牌第一方产品和人工精选，不重复建设全量索引。

## 4. 仓库边界

```text
pi-plugins/
├── README.md
├── LICENSE
├── AGENTS.md
├── package.json
├── package-lock.json
├── tsconfig.json
│
├── .pi/
│   ├── settings.json
│   └── skills/
│       └── pi-package-development/
│           └── SKILL.md
│
├── packages/
│   ├── pi-example/
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── CHANGELOG.md
│   │   ├── extensions/
│   │   │   └── index.ts
│   │   └── test/
│   │       └── index.test.ts
│   └── pi-suite/
│       ├── package.json
│       └── README.md
│
├── catalog/
│   └── plugins.json
│
├── docs/
│   ├── package-standard.md
│   ├── development.md
│   ├── testing.md
│   ├── publishing.md
│   └── catalog-policy.md
│
├── scripts/
│   ├── validate-packages.mjs
│   └── validate-catalog.mjs
│
└── .github/
    ├── workflows/
    │   ├── ci.yml
    │   └── publish.yml
    └── PULL_REQUEST_TEMPLATE.md
```

`pi-example` 表示未来第一个真实 Package 的结构，不要求提交无业务价值的示例包。`pi-suite` 在至少有一个可发布第一方 Package 后创建。模板在首个真实 Package 验证规范后再抽取，避免让未经实践的脚手架成为标准。

### 4.1 根项目

根 `package.json` 必须：

- 设置 `"private": true`。
- 设置 `"workspaces": ["packages/*"]`。
- 只提供统一检查命令和开发依赖。
- 不声明 `pi` manifest。
- 不发布到 npm。

因此不支持把整个仓库作为 Package 执行 `pi install git:...`。正式用户只能安装独立 npm Package 或 Suite。

### 4.2 第一方 Package

每个 `packages/pi-*` 必须是完整独立的 npm 与 Pi Package：

- 名称使用 `@kedoupi/pi-*`。
- 包含 `pi-package` keyword。
- 使用显式 `pi.extensions`、`pi.skills`、`pi.prompts` 或 `pi.themes` manifest。
- 包含独立 README、CHANGELOG、版本和测试。
- 默认使用 MIT License；需要其他许可证的 Package 必须在自身 README 中说明。
- Pi 核心包按官方建议声明为 `peerDependencies: "*"`，不打包 Pi 核心实现。
- Runtime 依赖放入 `dependencies`，测试和类型依赖放入 `devDependencies`。
- 不使用 npm lifecycle 安装脚本。

### 4.3 Suite

`@kedoupi/pi-suite`：

- 不包含业务逻辑。
- 只聚合第一方 Package。
- 使用成员 Package 的精确版本。
- 使用 `dependencies`、`bundledDependencies` 和 `node_modules/...` Pi manifest 路径暴露成员资源。
- 源码仍只在成员 workspace 维护；Suite tarball 按 npm 规则携带依赖副本。
- 任一成员版本、成员集合或资源路径变化时独立发布新版 Suite。

用户不得同时安装 Suite 与其中的独立成员包，以免重复注册工具或命令。

## 5. 本地开发生命周期

### 5.1 初始化

```bash
git clone https://github.com/kedoupi/pi-plugins.git
cd pi-plugins
npm install
pi
```

首次启动时，用户必须显式信任项目。CI 或一次性运行可使用 `pi --approve`，不得把全局默认信任改成 `always` 作为项目要求。

### 5.2 项目隔离加载

`.pi/settings.json` 通过相对路径引用本地 workspace：

```json
{
  "packages": [
    "../packages/pi-example"
  ]
}
```

相对路径以 `.pi/settings.json` 所在目录为基准。该配置可提交，但不得包含 API Key、令牌或私人路径。

开发循环：

```text
修改源码 → 类型检查/单测 → /reload → 手动触发功能 → 观察结果
```

### 5.3 单 Package 调试

```bash
pi --no-extensions -e ./packages/pi-example
```

必要时直接加载入口：

```bash
pi --no-extensions -e ./packages/pi-example/extensions/index.ts
```

包含 Skill、Prompt 或 Theme 时优先加载整个 Package 目录。

### 5.4 全局 dogfood

候选版本通过隔离测试后，以绝对路径加入全局 Pi：

```bash
pi install /absolute/path/pi-plugins/packages/pi-example
```

至少完成一个真实工作任务，并验证重启、`/reload`、Session 生命周期、无 UI 模式和资源清理。发布后移除本地路径，再安装 npm 正式版：

```bash
pi remove /absolute/path/pi-plugins/packages/pi-example
pi install npm:@kedoupi/pi-example
```

不得同时加载本地版和 npm 版。

## 6. 测试策略

### 6.1 Package 级检查

默认最低门禁：

- `tsc --noEmit` 严格类型检查。
- 使用 Node 内置测试框架和 `tsx` 执行 TypeScript 测试。
- 对非平凡配置、状态、分支、取消和错误路径编写小而直接的测试。
- 使用最小 mock 调用 Extension 默认导出，验证注册过程。
- 不建立覆盖整个 Pi API 的通用假框架。

推荐命令：

```bash
node --import tsx --test
```

Pi 可直接加载 TypeScript，因此没有实际构建产物需求的 Package 不增加 build 步骤。

### 6.2 Manifest 与发布内容检查

`scripts/validate-packages.mjs` 检查：

- 命名、keyword 和 manifest。
- manifest 路径存在。
- Runtime 与 peer dependency 位置正确。
- README、CHANGELOG 和版本存在。
- Suite 成员和路径有效。
- 发布文件中不包含密钥、`.env` 或临时文件。

发布内容通过 npm 原生命令验证：

```bash
npm pack --workspaces --dry-run
```

### 6.3 根门禁

```bash
npm ci
npm run check
npm test
npm run pack:check
```

`check` 聚合 workspace 类型检查、Package manifest 检查、Catalog 检查和 Suite 检查。`test` 聚合 Package 测试。`pack:check` 检查真实 npm tarball 文件列表。

### 6.4 CI

所有 PR 在 GitHub Actions 中运行完整根门禁。初期只测试最低支持的 Node.js 22，出现真实跨版本问题后再扩充矩阵。

CI 不持有模型 API Key，不调用收费模型。外部服务使用本地 stub；需要真实服务的验证属于受控手工测试。

### 6.5 人工生命周期检查

按插件能力选择适用检查：

- 主要工具、命令和配置。
- `/reload`、退出和重新启动。
- `/new`、`/resume`、`/fork`。
- TUI 宽度变化和 Escape 取消。
- Print/JSON 模式安全降级。
- 后台进程、定时器、文件监听和连接的清理。
- 文件并发修改和失败时的数据完整性。

## 7. 发布与回滚

### 7.1 独立版本

每个 Package 使用独立 SemVer 和 Tag：

```text
@kedoupi/pi-example 1.3.0 → pi-example-v1.3.0
@kedoupi/pi-suite   1.1.0 → pi-suite-v1.1.0
```

初期不引入 Changesets。使用 npm workspaces、独立版本、独立 CHANGELOG 和 Tag 驱动的 GitHub Actions。Package 数量或并行发布频率使手工版本管理成为可测量问题后，再评估 Changesets。

### 7.2 发布流程

```text
更新源码和测试
→ 更新目标 Package CHANGELOG 与版本
→ 更新 package-lock.json
→ PR 门禁
→ 合并
→ 创建目标 Package Tag
→ CI 再次执行完整门禁
→ 校验 Tag 与 package.json 版本
→ npm publish 指定 workspace
→ 创建 GitHub Release
```

优先使用 npm Trusted Publishing 和 GitHub Actions OIDC，不保存长期 `NPM_TOKEN`。公开 scoped Package 使用 `--access public`，并启用 `--provenance`。

发布仍需维护者明确触发 Tag，不允许 Skill 静默发布。

### 7.3 正式安装

按需安装：

```bash
pi install npm:@kedoupi/pi-example
```

整套安装：

```bash
pi install npm:@kedoupi/pi-suite
```

管理命令：

```bash
pi list
pi config
pi update npm:@kedoupi/pi-example
pi update --extensions
pi remove npm:@kedoupi/pi-example
```

项目级安装使用 `-l`，写入项目 `.pi/settings.json`。

### 7.4 固定与回滚

```bash
pi install npm:@kedoupi/pi-example@1.2.3
pi install npm:@kedoupi/pi-example@1.2.2
```

固定版本不会被普通 Package 更新自动推进。每个 README 必须说明升级、卸载和回滚。

## 8. Package 文档规范

第一方 Package README 必须包含：

1. 功能与适用场景。
2. 安装命令。
3. 第一次使用方法。
4. 工具、命令和快捷键。
5. 配置位置与默认值。
6. 环境变量。
7. 权限与安全影响。
8. 已知冲突。
9. 更新、卸载与回滚。
10. 已验证的 Pi 与 Node.js 版本。

Suite README 必须列出成员版本、快速入门、与独立安装相互切换的方法。

## 9. 第三方精选目录

### 9.1 数据边界

`catalog/plugins.json` 只保存元数据，不保存第三方源码。初始字段：

```json
{
  "id": "example",
  "name": "Example",
  "package": "example-pi-package",
  "repository": "https://github.com/example/project",
  "install": "pi install npm:example-pi-package",
  "categories": ["workflow"],
  "summary": "解决什么问题",
  "recommendation": "为什么值得推荐",
  "license": "MIT",
  "status": "tested",
  "testedVersion": "1.2.3",
  "testedPiVersion": "0.84.4",
  "testedAt": "2026-08-31",
  "conflicts": [],
  "notes": []
}
```

不手工保存 Stars 和下载量等易过期数据。

### 9.2 状态

- `community`：社区提交，元数据和基本要求通过。
- `tested`：`@kedoupi` 实际验证主要功能。
- `reviewed`：额外阅读入口、依赖和敏感操作。
- `deprecated`：上游停止维护或不再推荐。

`reviewed` 不是安全保证，目录必须展示审核范围和日期。贡献者不能自行授予 `tested` 或 `reviewed`。

### 9.3 审核流程

```text
提交一个 Catalog 条目
→ CI 检查格式、重复项、URL 和安装来源
→ 维护者检查许可证、来源、用途和权限
→ 确定状态
→ 合并
```

第一阶段不运行自动收录爬虫。目录显著增长并产生真实浏览问题后，再考虑 GitHub Pages 和搜索。

### 9.4 本机已安装 Package 盘点

首批目录来源于用户当前安装的 Pi Package：

1. 读取 `pi list` 和 Package 来源。
2. 区分 npm、Git、本地路径和修改版。
3. 获取 manifest、仓库、许可证和 npm tarball。
4. 检查 lifecycle scripts、入口、敏感操作和依赖。
5. 验证主要功能并记录版本。
6. 排除无来源、无许可证、内部私有或不适合公开推荐的项目。

测试未知 Package 时使用临时 Pi 配置目录：

```bash
PI_CODING_AGENT_DIR=/tmp/kedoupi-pi-review pi install npm:some-package
```

先静态检查，再执行拥有完整系统权限的 Extension。临时环境不复制用户全局凭据。

## 10. 仓库规则与 Skill

### 10.1 信息层级

- `AGENTS.md`：始终生效的边界、约束和验证命令。
- `docs/*.md`：面向维护者的完整规范。
- `scripts/*.mjs`：确定性校验，是自动门禁的事实来源。
- `.pi/skills/pi-package-development/SKILL.md`：创建、迁移、测试和准备发布时按需加载。

Skill 不复制所有文档，也不代替脚本。它引用文档和脚本，编排可重复步骤。真正执行 npm 发布前必须请求明确确认。

先让首个真实 Package 验证开发流程，再固化 Skill。只有通用流程经过实践后，才考虑把与本仓库无关的部分抽取到现有 `kedoupi/skills` 仓库。

## 11. 多 Agent 实施原则

后续实施计划可并行拆分为：

- 根 workspace、规则和确定性校验。
- Catalog 数据模型、验证和 PR 流程。
- CI 与发布工作流。
- 本机 Package 盘点和首批目录。
- 首个真实第一方 Package 迁入或创建。
- Suite 与最终端到端验证。

并行写入任务必须使用独立 Git worktree；同一 cwd 不允许多个 Agent 同时修改。主 Agent 负责依赖顺序、集成、门禁和最终审查。

## 12. 完成标准

第一阶段完成需同时满足：

- 根仓库为不可发布的 npm workspace。
- 至少一个真实第一方 Package 可在项目级本地加载并通过测试。
- 该 Package 完成一次全局本地源码 dogfood。
- Package tarball 校验通过，并具备独立发布流程。
- Suite 可安装已发布的第一方成员，且不存在重复注册。
- 本机插件完成盘点，精选目录包含经过审核的首批条目。
- CI、Package 校验、Catalog 校验全部通过。
- README、开发规范、发布规范和 Catalog 政策一致。
- 项目级 Skill 能调用事实来源脚本完成开发检查，但不能未经确认发布。

## 13. 实施前置条件

实施和发布前必须完成以下外部检查：

- 确认 GitHub 新仓库名称采用 `kedoupi/pi-plugins`。
- 确认 npm 账号拥有或可创建 `@kedoupi` scope。
- 为 npm Trusted Publishing 配置 GitHub 仓库与 workflow 绑定。
- 选择首个真实第一方 Package；没有真实 Package 时不创建空 Suite 或虚假示例。
