# Testing Policy

## Type and unit checks

默认最低门禁：

- `tsc --noEmit` 严格类型检查。
- 使用 Node 内置测试框架和 `tsx` 执行 TypeScript 测试，推荐命令：`node --import tsx --test`。
- 对非平凡配置、状态、分支、取消和错误路径编写小而直接的测试。
- 使用最小 mock 调用 Extension 默认导出，验证注册过程。
- 不建立覆盖整个 Pi API 的通用假框架。

Pi 可直接加载 TypeScript，因此没有实际构建产物需求的 Package 不增加 build 步骤。

## Extension registration

使用最小 mock 调用 Extension 默认导出，验证工具、命令等注册过程，不 mock 整个 Pi API。

## Package contents

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

根门禁：

```bash
npm ci
npm run check
npm test
npm run pack:check
```

`check` 聚合 workspace 类型检查、Package manifest 检查、Catalog 检查和 Suite 检查。`test` 聚合 Package 测试。`pack:check` 检查真实 npm tarball 文件列表。

## Manual lifecycle checks

按插件能力选择适用检查：

- 主要工具、命令和配置。
- `/reload`、退出和重新启动。
- `/new`、`/resume`、`/fork`。
- TUI 宽度变化和 Escape 取消。
- Print/JSON 模式安全降级。
- 后台进程、定时器、文件监听和连接的清理。
- 文件并发修改和失败时的数据完整性。

## CI gates

所有 PR 在 GitHub Actions 中运行完整根门禁。初期只测试最低支持的 Node.js 22，出现真实跨版本问题后再扩充矩阵。

CI 不持有模型 API Key，不调用收费模型。外部服务使用本地 stub；需要真实服务的验证属于受控手工测试。
