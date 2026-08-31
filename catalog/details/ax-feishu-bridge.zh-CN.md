# AX Feishu Bridge

[English](./ax-feishu-bridge.md) | [简体中文](./ax-feishu-bridge.zh-CN.md)

> Research basis: 0.4.9, checked 2026-08-31.
> 仅审阅公开文档；不构成安全保证。

## About
AX Feishu Bridge 是一个 Pi 插件，可把 Pi 对话桥接到 Feishu 或 Lark 机器人中，让你通过私聊、群聊和话题与本地 coding agent 对话。

## Best For
适合希望从 Feishu 或 Lark 远程访问对话，同时愿意先审阅机器人配置、凭据存储和监听暴露方式的用户。

## Capabilities
- 上游文档描述了私聊、群聊和话题桥接，并为每个聊天或话题保留独立会话。
- 首次配置通过 `/feishu setup` 完成，可扫码自动创建机器人，也可手动填写已创建应用的 App ID 和 App Secret。
- Pi 侧管理命令包括 `/feishu start`、`/feishu stop`、`/feishu restart`、`/feishu status`、`/feishu autostart`、`/feishu debug`、`/feishu reset`。
- 上游文档中的聊天内命令包括 `/new`、`/resume`、`/model`、`/thinking`、`/stop`、`/workspace`、`/status`、`/config`、`/commands`。
- 公开资料还描述了附件输入、交互卡片解析、流式回复卡片、运行时配置更新，以及保持桥接在线的后台守护进程。

## Installation
```bash
pi install npm:ax-feishu-bridge
```

## Quick Start
1. 在 Pi 中安装该包。
2. 运行 `/feishu setup`，扫码自动创建 Feishu 助手，或手动输入现有 App ID 和 App Secret。
3. 如果没有启用自动启动，再运行 `/feishu start`。
4. 在 Feishu 或 Lark 中打开机器人开始对话；群聊中的触发行为取决于所配置的群策略。

## Commands and Tools
- `/feishu setup`、`/feishu start`、`/feishu stop`、`/feishu restart`、`/feishu status`、`/feishu autostart`、`/feishu debug`、`/feishu reset [confirm]`
- `/new`、`/resume`、`/model`、`/thinking`、`/stop`、`/workspace`、`/status`、`/config`、`/commands`
- 群策略 `open` 与 `mention`
- `@larksuiteoapi/node-sdk` 是上游文档中说明的 Feishu/Lark 传输依赖

## Configuration
- 上游文档把 Pi 侧配置文件指向 `~/.pi/agent/feishu/config.pi.json`，并保留 `config.json` 作为旧别名。
- 环境变量配置使用 `FEISHU_` 前缀，包括 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_DOMAIN`、`FEISHU_GROUP_POLICY`、`FEISHU_LANGUAGE`。
- 卡片动作处理可通过 `FEISHU_CARD_ACTION_MODE`、`FEISHU_CARD_ACTION_WEBHOOK_HOST`、`FEISHU_CARD_ACTION_WEBHOOK_PORT`、`FEISHU_CARD_ACTION_WEBHOOK_PATH` 配置。
- 其他文档化选项还包括群关键词、忽略机器人消息、处理中提醒和任务硬超时。

## Permissions and Security
- 机器人凭据会保存在本地 Feishu 配置文件中，或通过 `FEISHU_` 环境变量提供。
- 消息内容、引用内容和受支持附件会通过桥接从本地 Pi 进程发送到 Feishu 或 Lark；上游文档也说明图片理解仍取决于所选模型。
- 公开资料描述了一个可选的本地 HTTP 卡片回调 webhook，Pi 侧默认监听 `0.0.0.0:3001/webhook/card`；如果不想暴露该路径，可改用 `ws` 模式。
- 上游安全说明指出，运行时 `/config` 更新受白名单限制，调试日志中的敏感值会被打码。
- 该桥接会在 Feishu 目录下保留本地持久状态，并文档化了一个后台守护进程，使连接在前台 Pi 会话关闭后仍可继续。
- 本次审阅的公开资料没有明确说明独立的媒体转换子进程；除 Pi/DSH 运行时本身外，更深层的子进程行为应视为未知。
- 上游文档明确要求 `open` 群策略额外开通 Feishu 群消息权限，但没有公开完整权限矩阵；其他应用 scope 与审批要求在你自行核对控制台前都应视为未知。

## Compatibility
- 本页调研的 npm 版本是 `0.4.9`。
- 上游包元数据列出 Node.js `^22.19.0 || >=24.0.0`、ESM 打包、Pi 扩展导出以及 DeepSeek Harness 支持。
- 公开资料说明 Pi 与 DSH 可使用独立配置目录和不同默认 webhook 端口并存。
- 传输层依赖 `@larksuiteoapi/node-sdk`，并使用发布包元数据中声明的相关 Pi/DSH peer 依赖。
- 本条目完全基于公开资料，不表示已在本地执行测试。

## Limitations
- 公开仓库中没有 LICENSE 文件；MIT 证据仅来自 npm 和 `package.json` 元数据。
- `open` 群策略需要手动开启 Feishu 的 “get all group messages” 权限。
- 文档中的状态目录被硬编码为 `~/.pi/agent/feishu`，并已被上游列为 open issue。
- 公开 issue 还提到了 Pi `0.81.1` 兼容问题，以及 Windows PowerShell 下 `/feishu start` 的问题。
- 除了已文档化的群消息权限要求外，其他不明确或未支持的权限在这里都保持 unknown，而不做推断。
- 以上说明来自 README、包元数据、发布说明和 issue 摘要，而不是在本仓库中实际运行桥接得出的结论。

## Upstream and License
- Repository: https://github.com/AX1202/ax-feishu-bridge
- README: https://github.com/AX1202/ax-feishu-bridge/blob/main/README_EN.md and https://github.com/AX1202/ax-feishu-bridge/blob/main/README.md
- package.json: https://github.com/AX1202/ax-feishu-bridge/blob/main/package.json
- Latest release notes: https://github.com/AX1202/ax-feishu-bridge/releases/tag/v0.4.9
- License: MIT。公开证据来自 npm registry 元数据 https://registry.npmjs.org/ax-feishu-bridge 和上游 `package.json` 的 license 字段。
- Repository license caveat from research: https://api.github.com/repos/AX1202/ax-feishu-bridge/licenses and https://github.com/AX1202/ax-feishu-bridge/issues
