# Kedoupi Pi Plugins

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/kedoupi/pi-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/kedoupi/pi-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >=22](https://img.shields.io/badge/Node.js-%3E%3D22-339933.svg)](https://nodejs.org/)

## About

Kedoupi Pi Plugins 是 `@kedoupi` 的 [Pi](https://github.com/badlogic/pi-mono) 第一方 Package 开发中心、共享开发规范入口和人工精选社区目录。

> 这是独立的非官方 Pi 生态项目。第三方条目保留原作者、许可证和上游链接；被收录不代表绝对安全。

仓库根目录是私有开发工作区，不是可安装的 Pi Package。

## Features

- 第一方 `@kedoupi/pi-*` Package 独立存放在 `packages/`。
- 对 Package manifest、tarball、Catalog 和 README 结构执行确定性校验。
- 维护者人工审核有价值的第三方 Pi Package 目录。
- 记录本地开发、测试、发布与安全规则。
- 使用 Node.js 22 CI，不配置发布凭据。

目前尚未发布第一方 Package；本仓库不会用空示例冒充可安装产品。

## Curated Catalog

在 [CATALOG.md](./CATALOG.md) 中查看社区 Package 的双语人工调研使用说明、安全信息、上游仓库、许可证和推荐理由。

社区可通过 Pull Request 推荐条目。`tested` 与 `reviewed` 状态必须有维护者证据；贡献者只能提交 `community` 状态。人工调研不等于每个 Package 都已实际执行，也不等于完成全面安全审计。详见 [Catalog 政策](./docs/catalog-policy.md)。

## Repository Structure

```text
packages/              独立的第一方 Pi Package
catalog/plugins.json   精选目录数据源
CATALOG.md              自动生成的目录页面
scripts/                仓库校验与渲染脚本
.pi/settings.json       项目级 Pi 开发配置
docs/                   规范与工作流文档
```

根 `package.json` 保持 private，并且不包含 `pi` manifest。

## Development

需要 Node.js 22 或更高版本以及 npm。

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
```

添加 Package 前请阅读：

- [项目总纲](./docs/project-charter.zh-CN.md)
- [Package 规范](./docs/package-standard.md)
- [开发流程](./docs/development.md)
- [测试](./docs/testing.md)
- [发布](./docs/publishing.md)
- [Catalog 政策](./docs/catalog-policy.md)

## Contributing

欢迎提交 Issue 与 Pull Request。变更应保持聚焦；可执行行为需要测试；修改第三方元数据时必须完成 Catalog 检查清单。

第一方 Package 必须遵循 [Package 规范](./docs/package-standard.md)。本仓库不会复制第三方源码。

## Security

Pi Extension 以当前用户权限运行。安装任何 Package 前，应检查源码、发布 tarball 内容、所需凭据、网络行为和子进程调用。

禁止提交密钥、`.env` 文件、私有插件清单或本机路径。安全问题应私下报告给仓库维护者，不要公开发布可利用细节。

## Roadmap

下一阶段只在选定一个具有真实用户价值和明确名称的第一方 Package 后启动，并从已验证的 Package 流程继续验证项目级加载、全局 dogfood、可信发布、安装生命周期和第一方套件集成。

不创建推测性的演示 Package。

## License

仓库原创内容采用 [MIT License](./LICENSE)。Catalog 中每个第三方 Package 仍遵循其上游许可证。
