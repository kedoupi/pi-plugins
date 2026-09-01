# 技术方案：@kedoupi/pi-im-feishu

- 日期：2026-09-01
- 状态：已批准
- 产品合同：[prd.md](./prd.md)
- 实施：[plan.md](./plan.md)

已批准。按 [plan.md](./plan.md) 创建 `packages/pi-im-feishu`。未写入计划的功能不要做。

## 1. 进程

Pi 窗口进程退出后，该进程内的飞书连接必然断。要满足「关窗口仍在线」，必须有 **第二个 Node 进程**。

```text
飞书 ──长连接──► 助手进程（常驻）
                    WS、路由表、AgentSession（P1 起）
                    对话的唯一写手
                    ▲
Pi 窗口（可关） ────┘  只 spawn/停/读状态；自己不开飞书连接
```

| 产品角色 | 技术落点 |
|---|---|
| 飞书助手 | `bin/assistant` 独立进程 |
| Pi 窗口 | Pi extension，注册 `/feishu` |
| 对话 | Pi 原生 jsonl（`SessionManager`） |

禁止：把长连接只活在 `session_start` 里当唯一载体。  
禁止：复刻 `tail -f /dev/null | pi --mode rpc --no-extensions -e …` 空壳。P1 在助手进程里直接 `createAgentSession`。

## 2. 建议包结构（落地时再创建）

```text
packages/pi-im-feishu/
  package.json          @kedoupi/pi-im-feishu，keyword pi-package
  README.md             规定的 11 个章节
  CHANGELOG.md
  extensions/index.ts   窗口入口；factory 不起 socket
  bin/assistant         助手入口
  src/                  store、lock、router、transport、runtime
  test/                 node --test
```

Pi 核心：`peerDependencies: "*"`，不打包。  
飞书 SDK：P0 起放入 `dependencies` 并钉版本，随 `pi install` 安装，用户不用另装。无 SDK 或长连接未接通 = 启动失败，不得显示在线。  
无 npm lifecycle 安装脚本。不拷贝 dsh-im / ax 源码。

## 3. 磁盘

默认 `~/.pi/agent/pi-im-feishu/`，测试用环境变量覆盖。

| 文件 | 内容 |
|---|---|
| `config.json` | bot 元数据、chats 路由，无 secret |
| `secrets.json` | App Secret，`0600` |
| `assistant.lock` | pid、appId、status、心跳 |
| `assistant.log` | 助手输出 |

chatKey：`p2p:<chatId>` / `group:<chatId>` / `topic:<chatId>:<threadId>`。  
`folder` 必须是绝对路径。`sessionFile` 指向 Pi 原生 jsonl。

锁不写 `~/.pi/agent/locks.json`（避免和 ax 抢）。心跳约 5s，pid 死或心跳超时约 30s 可接管。同一 appId 同时只一个助手。

## 4. 窗口

`registerCommand("feishu")`。print/JSON：不 spawn、不弹窗。  
`session_start` 刷新「飞书 在线/离线」。  
`session_shutdown` **不停**助手。

子命令对应产品：setup（扫码或手动填写）、start、stop、status/chats、folder、attach。  
P0 的 attach 只做检查和说明，不 `switchSession`。  
P0 的「在线」以助手锁为 `online` **且** 飞书 WS 已 ready 为准。

绑定（FR-01），对照开源、禁止拷贝源码：

- **选型**：ax-feishu-bridge 的 Pi `runSetup` 先 `select` 扫码或手动；dsh-im 用同一套 SDK 开通并 `verify` bot。本包 TUI 同样先选路，写入**同一份** store。
- **扫码**：调用 `@larksuiteoapi/node-sdk` 的 `registerApp`（ax 包了一层 `registerFeishuApp`）。监听 `onQRCodeReady({ url, expireIn })` 在 TUI 出码；`onStatusChange` 处理 `domain_switched` 等。成功结果取 `client_id` / `client_secret`，`user_info.tenant_brand === "lark"` 则域名为 lark，否则 feishu。Secret 只进 `onCredentials` / secrets 文件，不进 status。
- **手动**：收集 App ID、Secret、域名后，用开放平台 `tenant_access_token/internal` + `bot/v3/info` 验身份（dsh-im `verifyFeishuApp` 语义）。验失败不得 spawn 为 online。
- **可注入**：`registerApp` 与 `verifyApp` 必须可替换，CI 不出码、不打真飞书。
- print 模式：禁止交互扫码。

## 5. 助手

窗口 `spawn(node, [assistant], { detached: true, stdio: ignore+log })` 后 `unref`。  
助手：无凭据退出 → 抢锁（starting）→ 开 transport → **WS ready 后** 心跳改为 online（interval 不可 unref）→ 信号处理时停传输、放锁。WS 失败：锁不得进入 online。

飞书：`WSClient` + `EventDispatcher`。P0 即注册并连接。事件：`im.message.receive_v1` 与 `card.action.trigger`（即使暂无菜单）。默认无 HTTP webhook、不听 `0.0.0.0`。P0 收到消息：写入清单；无文件夹则回复如何绑文件夹；有文件夹可先只回「已收到」，P1 再跑模型。

群：v1 仅 mention，无 @ 本机器人则丢。无私聊白名单。忽略 bot 发送者。不做 all。

开机自启（FR-16）：已绑定且上次不是停止时，登录后拉起助手（macOS 优先 launchd / Login Item，具体实现批准后定）。停止须同时关掉自启，避免开机又上线。测试用可注入的「安装/卸载自启」接口，CI 不改用户真开机项。

语言：飞书出站中文；TUI 文案优先 Pi locale，否则中文。

无文件夹：写入清单，回复如何绑文件夹，**不**创建 AgentSession。  
有文件夹（P1）：该 chat 一个 session，cwd=folder；ResourceLoader 排除本包；同一 chat 串行；结束后把 sessionFile 写回。工具默认自动执行。删除、覆盖未点名的文件、破坏性命令、把文件发到飞书以外：先在该飞书聊天发确认卡或确认文本，用户同意后再执行；拒绝/超时则跳过。确认不经过 TUI。

窗口与助手不得同时写同一 jsonl。真跟随（P3）：先助手释放，再窗口 `switchSession`。

## 6. 测试（有包之后）

不建假 Pi 框架。覆盖：secret 不进 status、相对路径拒绝、锁冲突与过期、关窗口锁仍在、stop 后离线、inbound key、mention 过滤、无文件夹不干活、factory 无 socket、attach 四种拒绝。P1 再测串行 prompt、排除自身 extension。

不得在 CI 连真飞书、不得提交凭据。transport 必须可注入。P0 测试须覆盖：WS 未 ready 时 presence 不是 online；注入的入站事件能进清单；手动绑定与扫码绑定写入同一 store；扫码失败可走手动。扫码协议用假开通器，不打真实飞书。

## 7. 安全

飞书是远程控制面。不出公网端口。日志不打 secret。测试目录用临时文件夹。非官方即时通讯协议不进本包。

## 8. 包 README（有包之后才写进 packages/）

必须含标准 11 节。Permissions 写：远程控制、v1 无私聊白名单、群要 @、普通工具全自动、重要操作飞书确认、凭据位置、关窗口仍在线、登录自启、绝对路径、与 ax 文档互斥。
