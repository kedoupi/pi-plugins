# First-party Package Standard

每个 `packages/pi-*` 必须是完整独立的 npm 与 Pi Package。本标准是人工规则；确定性检查由 `scripts/validate-packages.mjs` 执行。

## Naming and ownership

- 名称使用 `@kedoupi/pi-*`，代码只放在 `packages/` 下。
- 默认使用 MIT License；需要其他许可证的 Package 必须在自身 README 中说明。
- 独立版本、独立测试、独立发布；不使用全仓锁步版本。

## Required manifest fields

- 包含 `pi-package` keyword。
- 使用显式 `pi.extensions`、`pi.skills`、`pi.prompts` 或 `pi.themes` manifest，且 manifest 引用的路径必须存在。
- 包含独立 README、CHANGELOG、版本和测试。
- 不使用 npm lifecycle 安装脚本。

## Dependencies

- Pi 核心包按官方建议声明为 `peerDependencies: "*"`，不打包 Pi 核心实现。
- Runtime 依赖放入 `dependencies`，测试和类型依赖放入 `devDependencies`。
- Node.js 标准库足够时不新增依赖。

## Documentation

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

## Security

- 发布文件中不包含密钥、`.env` 或临时文件。
- Pi Extensions 以当前用户权限执行；README 必须如实说明权限与安全影响。

## Definition of done

- `tsc --noEmit` 严格类型检查通过。
- `node --import tsx --test` 测试通过。
- `npm run check`、`npm test`、`npm run pack:check` 全部通过。
- 发布内容经 `npm pack --workspaces --dry-run` 验证。
