# Catalog Policy

## Scope

`catalog/plugins.json` 只保存人工整理的公开元数据；`catalog/details/` 保存对应的英文与简体中文详情页；本仓库不复制第三方源码，也不保存大段 README 原文。

Catalog 只收录公开可访问的社区 Pi Package。当前规则覆盖 8 个公开条目，状态默认为 `community`，是否 `tested` / `reviewed` 只能由维护者补充证据后授予。

## Required metadata

```json
{
  "id": "example",
  "name": "Example",
  "source": "npm:example-pi-package",
  "repository": "https://github.com/example/project",
  "categories": ["workflow"],
  "summary": "解决什么问题",
  "recommendation": "为什么值得推荐",
  "license": "MIT",
  "status": "community",
  "researchedVersion": "1.2.3",
  "researchedAt": "2026-08-31",
  "testedVersion": null,
  "testedPiVersion": null,
  "testedAt": null,
  "conflicts": [],
  "notes": []
}
```

规则：

- 优先使用官方 npm 来源：`npm:<package>`。
- 只有 npm 不可用、上游明确只支持 Git、或 npm 包缺少必需内容时，才使用 Git 回退：`git:github.com/owner/repo`。
- `source` 必须是未锁版本的规范来源；不要写 `@version`、commit、tag 或私有路径。
- `researchedVersion` / `researchedAt` 记录人工调研依据，不代表实际执行或维护者验证。
- `testedVersion` / `testedPiVersion` / `testedAt` 只用于维护者实际测试证据；社区贡献者不能自行填写来获得 `tested` 或 `reviewed`。

## Status definitions

- `community`：元数据、双语详情和基础校验通过；仅代表人工调研。
- `tested`：维护者实际安装/使用过，并补充了测试证据。
- `reviewed`：在 `tested` 基础上，维护者额外检查入口、权限、网络、子进程、凭据或其他敏感行为。
- `deprecated`：上游停止维护、不再推荐或存在明确替代方案。

社区贡献者不能自授 `tested` 或 `reviewed`；如需升级状态，必须由维护者补证。

## Required detail pages

每个条目都必须同时存在：

- `catalog/details/<id>.md`
- `catalog/details/<id>.zh-CN.md`

两页都必须互相链接，并且保留完全一致的 11 个 H2 标题：

1. `## About`
2. `## Best For`
3. `## Capabilities`
4. `## Installation`
5. `## Quick Start`
6. `## Commands and Tools`
7. `## Configuration`
8. `## Permissions and Security`
9. `## Compatibility`
10. `## Limitations`
11. `## Upstream and License`

中文页保留英文标题，正文使用简体中文。详情页必须写明调研版本、调研日期，并使用精确免责声明：英文页 `Documentation review only; not a security guarantee.`；中文页 `仅审阅公开文档；不构成安全保证。`。

## Manual research checklist

提交或更新条目前，至少完成：

- 确认是否存在官方 npm 包；只有必要时才改用 Git。
- 核对仓库地址、许可证证据、安装命令和分类。
- 记录 `researchedVersion` 与 `researchedAt`，但不要把调研写成已测试。
- 为英文页与简体中文页分别补全 11 个必需章节。
- 说明文件访问、网络访问、凭据、子进程、付费服务和其他敏感行为。
- 链接当前 upstream README / release / license 等证据来源。
- 不复制第三方源码，不粘贴大段 README，不写入私有路径、真实配置值、Cookie、API Key 或其他凭据。

## Temporary review commands

测试未知 Package 时使用临时 Pi 配置目录，先静态检查，再决定是否实际执行：

```bash
PI_CODING_AGENT_DIR=/tmp/kedoupi-pi-review pi install npm:some-package
PI_CODING_AGENT_DIR=/tmp/kedoupi-pi-review pi install git:github.com/owner/repo
```

临时环境不复制用户全局凭据，也不应写入私有本机路径到仓库。

## Automation limits

CI 只做离线、可重复的 Node 标准库校验：结构、唯一性、双语成对、孤儿文件、标题、互链、安装命令、研究元数据和生成后的 `CATALOG.md` 新鲜度。

本项目不运行自动爬虫、站点抓取、数据库同步或 Markdown 解析器扩展；也不设置“调研日期过旧就失败”的 stale-date gate。是否需要重新调研由维护者人工判断。

## Security language

`tested` 与 `reviewed` 都不是绝对安全保证。Catalog 只能陈述公开证据、调研边界和已知风险；第三方条目继续受其上游许可证与维护实践约束。

## Removal and deprecation

以下情况应拒绝收录或转为 `deprecated`：

- 无法确认公开来源或许可证。
- 依赖私有仓库、私有凭据或不可公开复查的分发方式。
- 上游已归档、停止维护或不再适合公开推荐。
- 条目长期失真且无人维护更新。
