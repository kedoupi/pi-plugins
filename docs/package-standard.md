# First-party Package Standard

每个 `packages/pi-*` 必须是完整独立的 npm 与 Pi Package。本标准是人工规则；确定性检查由 `scripts/validate-packages.mjs` 与 `scripts/validate-readmes.mjs` 执行。

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

所有 README 使用英文二级标题，正文可按受众选择语言。`scripts/validate-readmes.mjs` 会拒绝缺失、重复或空的必需章节。

根 `README.md` 与 `README.zh-CN.md` 必须包含：

1. `About`
2. `Features`
3. `Curated Catalog`
4. `Repository Structure`
5. `Development`
6. `Contributing`
7. `Security`
8. `Roadmap`
9. `License`

每个第一方 Package README 必须包含：

1. `About`：功能与适用场景。
2. `Installation`：安装命令。
3. `Quick Start`：第一次使用方法。
4. `Commands, Tools, and Shortcuts`：用户入口。
5. `Configuration`：配置位置与默认值。
6. `Environment Variables`：变量名称与用途；没有时也要明确说明。
7. `Permissions and Security`：权限与安全影响。
8. `Known Conflicts`：已知冲突；没有时明确说明。
9. `Update and Rollback`：更新、卸载与回滚。
10. `Compatibility`：已验证的 Pi 与 Node.js 版本。
11. `License`

Suite README 还必须包含 `Suite Members` 与 `Switching Installation Modes`，列出成员版本以及与独立安装相互切换的方法。

## Security

- 发布文件中不包含密钥、`.env` 或临时文件。
- Pi Extensions 以当前用户权限执行；README 必须如实说明权限与安全影响。

## Definition of done

- `tsc --noEmit` 严格类型检查通过。
- `node --import tsx --test` 测试通过。
- `npm run check`、`npm test`、`npm run pack:check` 全部通过。
- 发布内容经 `npm pack --workspaces --dry-run` 验证。
