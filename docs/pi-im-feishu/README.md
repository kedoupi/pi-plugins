# @kedoupi/pi-im-feishu 产研文档

选定的第一个第一方 Package。产品范围已批准，P0–P3 实现与自动化证据已完成；尚未使用真实凭据证明 Feishu/Lark 连通，也未发布。

当前证据边界：

- [x] 严格 TypeScript 入口检查、全部 `.mjs` 语法检查、单元/进程测试
- [x] 本地 tarball + 本机已解析 Pi peer 的离线 installed smoke
- [x] print/JSON 无副作用、断线离线、start/stop、状态保留与回滚自动化
- [ ] 一次性真实 Feishu/Lark 应用验收
- [ ] 全局本地源码 dogfood
- [ ] 维护者明确批准发布

自动化 transport、开放平台、launchctl 与确认边界均为注入实现；不能据此宣称真实租户、真实 LaunchAgent 或付费模型已验证。

| 文档 | 受众 | 回答什么 |
| --- | --- | --- |
| [调研](./research.md) | 产研 | 为什么做、对手是谁、Pi 和 dsh-im 差在哪 |
| [产品需求](./prd.md) | 产品 / 用户 | 做给谁、怎么用、做什么、不做什么 |
| [技术方案](./technical.md) | 工程 | 进程、状态、确认、所有权、文件和测试边界 |
| [实施计划](./plan.md) | 工程排期 | 已完成证据与剩余真实验收顺序 |
| [待确认](./open-questions.md) | 决策 | 已拍板结论与尚待外部验证项 |

本地验证顺序固定为：

```text
项目级本地源码加载
→ 临时状态目录自动化 smoke
→ 一次性真实飞书/Lark 应用测试
→ 全局本地源码 dogfood
→ 证据齐全后才提发布建议
```

用户安装与安全说明见 [`packages/pi-im-feishu/README.md`](../../packages/pi-im-feishu/README.md)。仓库规范仍以根目录为准：[Package 标准](../package-standard.md) · [开发流程](../development.md) · [测试](../testing.md) · [发布](../publishing.md) · [AGENTS.md](../../AGENTS.md)。
