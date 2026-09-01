# Publishing Policy

## Independent versions and tags

每个真实第一方 Package 使用独立 SemVer 和 Tag：

```text
@kedoupi/<real-package-name> 1.3.0 → <real-package-tag>-v1.3.0
```

future Suite 只在至少有一个可发布第一方 Package 后创建，并从那时开始使用自己的独立版本和 Tag。初期不引入 Changesets。使用 npm workspaces、独立版本、独立 CHANGELOG 和 Tag 驱动的 GitHub Actions。Package 数量或并行发布频率使手工版本管理成为可测量问题后，再评估 Changesets。

发布流程：

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

发布仍需维护者明确触发 Tag，不允许 Skill 静默发布。`@kedoupi/pi-im-feishu` 当前没有 publish workflow，也未发布；“自动化通过”只表示可进入真实应用测试，不等于可发布。

## Trusted Publishing

优先使用 npm Trusted Publishing 和 GitHub Actions OIDC，不保存长期 `NPM_TOKEN`。公开 scoped Package 使用 `--access public`，并启用 `--provenance`。

## Rollback

运行中的常驻 Package 先在 TUI 执行 `/feishu stop`（适用时），再切换版本：

```bash
pi install npm:@kedoupi/<real-package-name>@1.2.3
pi install npm:@kedoupi/<real-package-name>@1.2.2
```

固定版本不会被普通 Package 更新自动推进。Package 替换与 `pi remove` 不应删除 `~/.pi/agent/<package>/` 机器状态；回滚前备份状态，卸载后是否永久删除状态由维护者另行决定。每个 README 必须说明更新、卸载和回滚。

## First-package prerequisites

发布工作流（GitHub Actions publish workflow）与首个真实 Package 一同创建，不在 foundation 阶段创建。实施和发布前必须完成以下外部检查：

- 确认 GitHub 新仓库名称采用 `kedoupi/pi-plugins`。
- 确认 npm 账号拥有或可创建 `@kedoupi` scope。
- 为 npm Trusted Publishing 配置 GitHub 仓库与 workflow 绑定。
- 首个真实第一方 Package 是 `@kedoupi/pi-im-feishu`，见 [产研文档](./pi-im-feishu/README.md)。发布前证据顺序固定为：项目级源码 → 临时目录自动化 → 一次性真实应用 → 全局本地源码 dogfood → 维护者发布确认。
- 自动化通过后仍须记录真实 Feishu/Lark 长连接、macOS launchd（适用时）、模型成本边界、更新和回滚结果；注入边界测试不能替代这些证据。
- 文档未批准、真实应用与 dogfood 未完成、维护者未确认前，不创建空 Suite、虚假示例或 publish workflow。
