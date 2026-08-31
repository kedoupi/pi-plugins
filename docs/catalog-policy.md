# Catalog Policy

## Scope

`catalog/plugins.json` 只保存元数据，不保存第三方源码。本项目只做品牌第一方产品和人工精选，不重复建设全量索引；第一阶段不运行自动收录爬虫，不手工保存 Stars 和下载量等易过期数据。

## Required metadata

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

## Status definitions

- `community`：社区提交，元数据和基本要求通过。
- `tested`：`@kedoupi` 实际验证主要功能。
- `reviewed`：额外阅读入口、依赖和敏感操作。
- `deprecated`：上游停止维护或不再推荐。

贡献者不能自行授予 `tested` 或 `reviewed`。

## Manual review

```text
提交一个 Catalog 条目
→ CI 检查格式、重复项、URL 和安装来源
→ 维护者检查许可证、来源、用途和权限
→ 确定状态
→ 合并
```

测试未知 Package 时使用临时 Pi 配置目录：

```bash
PI_CODING_AGENT_DIR=/tmp/kedoupi-pi-review pi install npm:some-package
```

先静态检查，再执行拥有完整系统权限的 Extension。临时环境不复制用户全局凭据。

## Security language

`reviewed` 不是安全保证，目录必须展示审核范围和日期。收录不构成绝对安全保证；第三方条目保留原作者、许可证和上游链接。

## Removal and deprecation

上游停止维护或不再推荐时，将条目标记为 `deprecated`；排除无来源、无许可证、内部私有或不适合公开推荐的项目。
