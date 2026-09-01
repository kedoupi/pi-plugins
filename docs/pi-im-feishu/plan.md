# 实施计划：@kedoupi/pi-im-feishu

- 日期：2026-09-01
- 状态：已批准
- 产品：[prd.md](./prd.md)
- 技术：[technical.md](./technical.md)
- 待确认：[open-questions.md](./open-questions.md)

**已批准。从 Task 1 起可创建 `packages/pi-im-feishu`。**

## 约束

- `AGENTS.md`、Package 标准、不拷第三方源码、不提交 secret。
- 不创建 Suite、publish workflow、空 `pi-im` 内核。
- 每个工作区同一时间一个写入者。
- 有代码后的完成门禁：`npm run check`、`npm test`、`npm run pack:check`。
- 发布必须维护者确认。

## 任务顺序

### Task 0 — 批准

1. 读调研、PRD、技术方案、待确认。
2. 拍板 [open-questions.md](./open-questions.md) 全部问题。
3. 三份主文档改为「已批准」，或退回修改。
4. 未完成前不开 Task 1。

### Task 1 — 建包骨架（已完成）

创建符合校验的空实现骨架：manifest、README 11 节、CHANGELOG、extension 只注册命令、无飞书网络。  
`.pi/settings.json` 加上相对路径。根测试脚本纳入 `packages/*/test`。  
对应 FR-01：手动填写的配置读写可在本任务；扫码开通的假开通器接口一并定好。助手进程与真连接放到 Task 2。

### Task 2 — P0 真在线（已完成）

锁、spawn 助手、**飞书 SDK 为依赖**、WS 接通后才显示在线、关窗口仍能收到消息、stop 放锁、status 用产品词、secret `0600`、相对路径拒绝。  
无 SDK 或 WS 失败：不得 online。P0 入站：进清单；无文件夹回说明；有文件夹可只确认收到。  
绑定：手动填写与扫码开通都写入同一份整机绑定。扫码走可注入的 `registerApp`（官方 SDK 语义：出码、过期、domain_switched、client_id/secret）；手填后可注入 `verifyApp`。CI 不连真飞书。  
自启：可注入的安装/卸载；停止后开机不得上线。CI 不写用户 launchd。

### Task 3 — P1 入站策略收口（已完成）

mention 与话题 key 的完整测试、无公网 webhook。v1 无 all。若 Task 2 已含入站，本任务只补缺口，不改「在线」定义。

### Task 4 — P1 干活（已完成）

AgentSession、cwd=folder、排除自身 extension、串行、sessionFile 回写、飞书停止命令。  
普通工具自动；FR-15 重要操作走飞书确认（可注入假确认）。`/new` 若未进 P2，本任务只做停止，不开新对话产品。

### Task 5 — P2（已完成）

飞书新对话、换文件夹、以前的、欢迎与帮助。

### Task 6 — P3（已完成）

贴上所有权；文件进出。未做完不写进用户 README 能力列表。

### Task 7 — Dogfood（人工安装验收）

真凭据不入库。关 TUI 私聊仍通；stop 后不通。再谈发布流水线。

## 完成

已批准的最高分期与文档一致；根门禁绿；用户文档用在线/离线/对话。
