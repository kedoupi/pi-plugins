# 实施计划：@kedoupi/pi-im-feishu

- 日期：2026-09-01
- 状态：P0–P3 实现与自动化完成；真实应用与 dogfood 待办
- 产品：[prd.md](./prd.md)
- 技术：[technical.md](./technical.md)

## 约束

- 遵守 `AGENTS.md` 和 Package 标准；不提交 secret、状态、日志、session 或本机路径。
- 不创建 Suite、publish workflow、空 `pi-im` 内核或通用多渠道抽象。
- 每个聊天同一时间只有一个 session 写入者。
- 自动化不得连真实 Feishu、调用付费模型或执行网络安装。
- 发布必须维护者明确确认。

## P0–P3 状态

- [x] **P0 真在线与本地控制**：QR/手填统一验证；SDK/runner/transport ready 后才 online；stop/stopped、脱敏错误、macOS autostart 边界
- [x] **P1 远程工作与安全策略**：真实 bot mention、topic key、持久 dedupe、每 chat 串行 AgentSession、原请求者确认、隔离 resource loader
- [x] **P2 对话生命周期**：`/stop`、新对话、换文件夹、以前的、帮助；排队/abort/release 次序有回归测试
- [x] **P3 attach 与文件**：跨进程 lease/heartbeat/CAS、无双写；collision-safe inbox；`send_feishu_file` requester-bound queue

`[x]` 代表源码、单元与进程自动化通过，不代表真实 Feishu/Lark、真实 launchd 或付费模型已验证。

## Task 状态

1. [x] 安全原子 store、权限、锁与跨进程并发
2. [x] required Pi peer、隔离 runner、真实工具 schema 与工作区策略
3. [x] bot identity、requester confirmation、topic reply 与 delivery retry
4. [x] worker queue、stop race、session lifecycle
5. [x] assistant/window 跨进程 ownership 与 attach
6. [x] collision-safe 入站与受控出站文件
7. [x] no-UI、masked secret、truthful start/stop/rebind/autostart/status
8. [x] 本地 tarball installed smoke、assistant 子进程、严格 TypeScript/语法门禁、真实文档
9. [ ] 独立全分支复核与维护者真实本地验收

Task 8 installed smoke 只 pack 一次，解压 tarball，链接本机已解析 Pi peer；不调用 `npm install` 或网络。覆盖 manifest/privacy、真实 SDK 解析、no-UI extension、print/JSON no-op、start/stop、disconnect offline、Package 替换/卸载/回滚保留机器状态。

## 剩余真实证据

按顺序执行，不跳过：

1. [ ] 项目级本地源码加载后复跑全部门禁
2. [ ] 一次性 Feishu/Lark 应用：QR 与手填、私聊、群 @、topic reply、原请求者确认
3. [ ] 真实入站文件与 `send_feishu_file`，确认只回来源 chat/topic
4. [ ] 真实 stop/rebind/restart、macOS login LaunchAgent（适用时）、断网/恢复
5. [ ] 两进程 attach、窗口退出后助手接回，同一 JSONL 无同时写入
6. [ ] 记录模型/provider 与可接受费用，不使用生产数据
7. [ ] 全局本地源码 dogfood 至少一个真实任务
8. [ ] 独立 review 无 blocker 后，由维护者决定是否提发布

机器状态默认 `~/.pi/agent/pi-im-feishu/`。更新/卸载/回滚前先 `/feishu stop`，Package 操作不得删除状态；需要永久清理时由维护者单独备份并执行。
