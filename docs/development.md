# Development Workflow

第一方 Package 使用下面这条证据链，不跳级：

```text
项目级本地源码加载
→ 临时状态目录自动化 smoke
→ 一次性真实飞书/Lark 应用测试
→ 全局本地源码 dogfood
→ 证据齐全后才提发布建议
```

`@kedoupi/pi-im-feishu` 已完成源码、子进程与本地 tarball 自动化；自动化使用注入的飞书边界，不证明真实飞书连通，也不使用真实凭据。

## Project trust

```bash
git clone https://github.com/kedoupi/pi-plugins.git
cd pi-plugins
npm ci --ignore-scripts
pi
```

首次启动时，用户必须显式信任项目。CI 或一次性运行可使用 `pi --approve`，不得把全局默认信任改成 `always` 作为项目要求。

## Project-local loading

提交的 `.pi/settings.json` 使用仓库内相对路径加载 Package；不得包含 API Key、令牌或私人路径。隔离加载入口：

```bash
pi --no-extensions -e ./packages/pi-im-feishu/extensions/index.ts
```

开发循环：

```text
修改源码 → npm run check → npm test → npm run pack:check → /reload → 手动触发
```

`/feishu setup`、`start`、`stop`、`folder`、`attach` 只在 TUI 执行；print/JSON 模式必须无提示框、无 spawn、无 socket 副作用。

## Temporary-home automated smoke

```bash
npm run check
node --test packages/pi-im-feishu/test/{assistant-process,installed-package}.test.mjs
npm test
npm run pack:check
```

测试为每次运行创建临时 `PI_IM_FEISHU_HOME`。installed smoke 只打包一次，解压到临时 `node_modules/@kedoupi/pi-im-feishu`，并链接本机已经解析的 Pi peer；它不执行 `npm install`，不访问网络。测试还证明 print/JSON 无副作用、start/stop、断线离线、替换/卸载/回滚不删除机器状态。

## Disposable real-app test

自动化全绿后，使用没有生产数据的一次性 Feishu/Lark 应用。真实验证 QR/手填绑定、私聊、群 @、完整 topic key、原请求者确认、话题回复、断线、重启、stop/rebind、跨进程 attach、入站 inbox、`send_feishu_file`，以及本机 macOS launchd（如适用）。

不要提交 App ID、Secret、状态目录、日志、session 或本机路径。真实模型调用可能收费；先设置可接受的模型和额度。测试结束后撤销应用凭据。

## Global dogfood

候选通过一次性应用测试后，以绝对路径加入全局 Pi：

```bash
pi install /absolute/path/pi-plugins/packages/pi-im-feishu
```

至少完成一个真实工作任务，并验证重启、`/reload`、Session 生命周期、print/JSON 安全降级、连接与定时器清理。不要同时加载项目级、本地全局与 npm 三个副本。

## Switching to an npm release

仅在未来明确发布后移除本地路径，再安装固定 npm 版本：

```bash
pi remove /absolute/path/pi-plugins/packages/pi-im-feishu
pi install npm:@kedoupi/pi-im-feishu@<version>
```

机器状态默认位于 `~/.pi/agent/pi-im-feishu/`，Package 替换或卸载不会自动删除。更新和回滚前先 `/feishu stop`，必要时备份状态；不要用卸载命令当作状态清理命令。
