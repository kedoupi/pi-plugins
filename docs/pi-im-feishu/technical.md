# 技术方案：@kedoupi/pi-im-feishu

- 日期：2026-09-01
- 状态：P0–P3 实现与自动化完成；真实应用验收待办
- 产品合同：[prd.md](./prd.md)
- 实施与证据：[plan.md](./plan.md)

## 1. 进程与在线

Pi extension 只注册 `/feishu`、读写共享状态、启停助手和处理 attach；factory 不开 socket。`bin/assistant.mjs` 是第二个 Node 进程，拥有 Feishu 长连接、路由、每聊天一个 Pi `AgentSession` 与所有权协调。

助手启动顺序是：读取 stopped/凭据 → 原子抢锁 → 解析真实 Pi SDK peer → 创建 runner → 创建 transport → 等 transport ready → 标记 online。runner 创建失败保持 offline 并释放锁；transport disconnect 立即把 presence 改为 offline。信号或失败路径清理 worker、session、transport、定时器和锁。

print/JSON 或无 UI 上下文中的 setup/start/stop/folder/attach 在 extension handler 入口拒绝，不弹 TUI、不 spawn、不连 socket。

## 2. 依赖与安装形态

- `@earendil-works/pi-coding-agent` 是 required peer `"*"`，不打包。
- `@larksuiteoapi/node-sdk` 是精确 runtime dependency。
- `typescript@5.9.3` 与 `@types/node@24.13.3` 是 workspace-root 精确 dev dependencies。
- extension 入口使用 Pi 导出的 `ExtensionAPI`，`strict` + `noEmit` + NodeNext 检查。

installed smoke 对 Package 执行一次 `npm pack --ignore-scripts --json`，用系统 tar 解压到临时 `node_modules/@kedoupi/pi-im-feishu`，只链接本机已经解析的 Pi peer。测试不调用 `npm install`，不访问网络。

## 3. 状态与并发

默认状态目录 `~/.pi/agent/pi-im-feishu/`，测试由 `PI_IM_FEISHU_HOME` 覆盖：

| 路径 | 内容 |
| --- | --- |
| `config.json` | bot 元数据、chat、delivery/confirmation、ownership；无 Secret |
| `secrets.json` | App Secret，创建即 `0600` |
| `assistant.lock` | pid、appId、starting/online/offline 与心跳 |
| `assistant.log` | resident process 输出 |
| `config.lock` / guards | 短生命周期跨进程锁 |

目录为 `0700`。所有共享 mutation 在 file lock 内 read-modify-write，临时文件带最终 mode 后原子 rename。死 pid 且超时才可恢复 stale owner；活 pid 不能仅按时间接管。Package 替换、卸载和 tarball 回滚都不触碰外部机器状态。

chat key 固定为 `p2p:<chatId>`、`group:<chatId>`、`topic:<chatId>:<threadId>`；folder 必须是绝对路径。sessionFile 指向 Pi 原生 JSONL。

## 4. 绑定、路由与确认

QR 与手填都先验证真实 bot open id，再写同一 binding。Secret 由 masked TUI 输入，错误持久化前会按已知 secret 脱敏。rebind 顺序为 verify → stop old → write new → start new；stop 即使 launchd disable 失败也继续杀助手。若后续 start 成功 enable autostart，则清除已恢复的旧 disable error；否则错误继续可见。

私聊接受非 bot sender。群/话题必须 mention 配置 bot 的真实 open id；identity 缺失时拒绝。topic 回复使用 thread reply。message delivery claim 持久化为 in-progress/complete，发送失败释放 claim 以便重试。

确认记录绑定完整 chat key、原 sender open id、来源 message id、脱敏摘要和过期时间。只有原请求者在同一聊天的精确确认/拒绝可消费；群/话题还要求 mention bot。控制命令在确认前处理。

## 5. AgentSession 与工具边界

`DefaultResourceLoader` 禁用全局 extensions、prompt templates 与 themes。runner 只开放 read/grep/find/ls/edit/write/bash 和受控 `send_feishu_file`。同一 chat 串行；stop abort 当前工作并取消队列。新对话、换文件夹、以前的均先排空 worker、释放 cached session，再更新持久化 session 引用。

只读工具、工作区内新文件和保守只读 shell 命令可自动。覆盖/编辑/删除、非只读 shell、安装/服务/部署、越界、网络与发送文件要求确认。文件工具使用 realpath/现有祖先检查工作区边界。shell 仍以用户 OS 权限执行：这是远程 coding agent，不是 OS sandbox；模型调用也可能产生费用。

## 6. Attach 所有权

每 chat 的 lease 持久化 owner、pid、sessionFile、requestId、heartbeat 与 requested/releasing/owned 状态。attach 必须有匹配 cwd 和现有 session 文件。窗口发 request 后，助手 abort/排队清理、保存 session、dispose runner，再 grant；extension 只在 grant 后 `switchSession`。

窗口 lease 存活时飞书侧返回暂停说明，不写该 JSONL。`session_start` 确认并 heartbeat；`session_shutdown` 只释放 pid、requestId、sessionFile 全部匹配的 owned lease。超时会 CAS 回收本次 request，包括迟到 grant；不会释放其他窗口或允许双写。

## 7. 文件

入站下载到 `<folder>/.pi-im-feishu/inbox/<message-id>/<safe-name>`。message id 和 basename 被清洗，排他创建与 `-2` 后缀防碰撞；空/失败下载终止处理，不创建假文件。

`send_feishu_file` 只接受当前 bound folder 内现存 regular file，使用当前 run 的原始 requester 做确认，确认后仅排队。prompt 完成后，router 把 image/file 上传并只回复来源 chat/topic；失败会让 delivery 可重试。真实 Feishu 上传/下载仍待一次性应用证据。

## 8. Autostart 与限制

macOS 使用 LaunchAgent + checked `launchctl` bootstrap/bootout，失败时 fallback 的非零状态也抛错。stop 持久化 stopped 并 disable autostart；不支持的平台返回 explicit unsupported。自动化注入 launchctl，不证明本机真实登录启动。睡眠、断网、关机均不保证在线。

## 9. 验证

```bash
npm run check
node --test packages/pi-im-feishu/test/{assistant-process,installed-package}.test.mjs
npm test
npm run pack:check
git diff --check
```

自动化使用假 transport、假开放平台、假 launchctl、临时状态目录与假凭据。它证明 SDK 安装图、offline/disconnect、无 UI、状态/并发/ownership/文件逻辑；不调用真实 Feishu、付费模型或网络安装。真实证据顺序见 [development workflow](../development.md)。
