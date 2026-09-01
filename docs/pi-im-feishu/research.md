# 调研：本机 Pi 的飞书助手

- 日期：2026-09-01
- 状态：已批准
- 结论：做 `@kedoupi/pi-im-feishu`，按已批准计划实现

## 1. 问题

用户希望离开电脑屏幕后，仍能用飞书使唤本机 Pi：改代码、看结果、换一件工作。人回到电脑时，能看见刚才那些飞书对话，必要时在终端里接着看。

这不是「再做一个飞书 Bot SDK」，而是 **本机 coding agent 的远程入口**。

约束：

- 机器要开着、要有网。合盖睡觉、关机，飞书也叫不动。和 dsh-im 相同，不是云端客服。
- Pi Extension 以当前用户权限运行。能跟机器人说话 ≈ 远程控制这台电脑。

## 2. 用户已经有的手感：dsh-im

DeepSeek Harness 插件 `dsh-im`（kedoupi / xiaotaozi，渠道来自 xmanrui/dsh-im MIT）：

- 侧栏接入飞书，扫码或填 App ID + Secret（本包 v1 两条路都要，绑同一只机器人）
- 关 Web 页面，飞书还能聊（Harness 进程还在）
- 每个飞书聊天自己一条工作
- 回到网页可以 follow 某条会话
- 群默认 mention；文件能进能出；命令是真命令

小桃子的中心是 **项目**：一个项目可以挂一只机器人，换项目像换一条 IM 分支。

Pi 没有 Host 项目柜子、没有 Web Hub、没有 credential store。不能 1:1 搬家。能学的是产品手感，不是 Cordis 代码。本仓库禁止 vendoring 未修改的第三方源码。

## 3. Pi 上已有的飞书桥

[ax-feishu-bridge](https://github.com/AX1202/ax-feishu-bridge)（本仓 Catalog `community`，未实测）与 dsh-im 飞书渠道，**接入向导值得对齐，常驻形态不值得照搬**：

| 对齐 | 不照搬 |
|---|---|
| 先选「扫码自动创建」或「手动填写已有应用」 | 配置目录写死 `~/.pi/agent/feishu` |
| 扫码走 `@larksuiteoapi/node-sdk` 的 `registerApp`（出码、过期、租户切飞书/Lark） | 关窗口后另起空 `pi --mode rpc` 守护进程 |
| 手动填 App ID、Secret、飞书或 Lark 域名 | 默认卡片 webhook 可 `0.0.0.0`；窗口贴不回对话 |
| 扫完得到 `client_id` / `client_secret`，再验 bot 身份 | 命令面 start/stop/restart/autostart/debug；尚无开机自启 |

结论：常驻这件事成立，ax 证明 Pi 窗口一关 socket 就没了，必须有第二个进程。**扫码不要自研开通协议**，用官方 SDK 的 `registerApp`，语义对照 ax / dsh-im，代码重写、不拷源码。常驻助手仍按本文做干活进程，不当空壳。

飞书/Lark 开放平台亦有[一键创建应用](https://open.larksuite.com/document/mcp_open_tools/integrating-agents-with-feishu/overview)说明；实现以 SDK 行为为准，不以网页教程为合同。

其他 Pi IM：QQ（`@xsqm/pi-qqbot`，独立 AgentSession + 跨 reload 宿主）、Telegram 多包。飞书不是空白市场，第一方必须靠 **整机一只机器人 + 关窗口仍在线 + 回来能贴上** 差异化，而不是再做一遍 setup 向导。

## 4. Pi 运行时事实（影响产品）

来源：[Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)、[Packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)、[SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)、[Session format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md)。

- factory 里禁止起 socket/timer；后台从 `session_start` 起，`session_shutdown` 拆。窗口进程退出 = 这个进程里的连接没了。
- 对话是磁盘 jsonl：`~/.pi/agent/sessions/--<cwd>--/<time>_<uuid>.jsonl`。
- 换对话：`createAgentSession` / `SessionManager.open` / `runtime.switchSession(path)`。
- 官方建议 Node 里嵌 Pi 用 `AgentSession`，不要为了常驻再套一层空 `pi --mode rpc`。
- print/JSON 模式没有 TUI；extension 必须降级。

飞书侧：`@larksuiteoapi/node-sdk` 的 `WSClient` + `EventDispatcher`。长连接模式下卡片动作走 `card.action.trigger`。默认不要 HTTP webhook。

## 5. 推荐产品形态

**电脑是中心，飞书绑一次。** 不是小桃子那种按项目各绑一只。

三个角色（给用户，不给术语）：

1. 飞书助手 — 常驻，连飞书、养对话  
2. Pi 窗口 — 可关，接入、看在线、贴到某条  
3. 对话 — 某个飞书聊天对应的工作记录  

两种切换：

- 飞书：换聊天 / 新对话 / 换文件夹 / 以前的  
- 电脑：在线离线、清单、贴上（文件夹必须一致）

## 6. 风险

- 远程控制本机；须写进 README，默认群要 @。v1 私聊无白名单。
- 「在线」必须是飞书收得到 + 本机进程在；禁止只亮进程。
- 普通工具全自动；重要操作在飞书确认，不堵 TUI。
- 同一飞书应用只能一条长连接；与 ax 同时装会抢。
- 微信/WhatsApp 非官方协议不进第一包。
- 窗口与助手双写同一 jsonl 会坏数据；助手须是唯一写手，贴上要交接所有权。
- 无开机自启时，开机后要手动亮一次（ax 同样未做）。须写进说明，不当缺陷隐瞒。

## 7. 建议

做 `@kedoupi/pi-im-feishu` 为第一个第一方包。先批文档，再按计划创建 `packages/pi-im-feishu`。不抽空的 `@kedoupi/pi-im`，不做 Suite，不并行九渠道。
