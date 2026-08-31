# Development Workflow

本地开发采用“项目隔离测试 → 全局本地源码 dogfood → npm 正式版”两层模式。

## Project trust

```bash
git clone https://github.com/kedoupi/pi-plugins.git
cd pi-plugins
npm install
pi
```

首次启动时，用户必须显式信任项目。CI 或一次性运行可使用 `pi --approve`，不得把全局默认信任改成 `always` 作为项目要求。

## Project-local loading

`.pi/settings.json` 通过相对路径引用本地 workspace：

```json
{
  "packages": [
    "../packages/pi-example"
  ]
}
```

相对路径以 `.pi/settings.json` 所在目录为基准。该配置可提交，但不得包含 API Key、令牌或私人路径。

开发循环：

```text
修改源码 → 类型检查/单测 → /reload → 手动触发功能 → 观察结果
```

## Single-Package isolation

```bash
pi --no-extensions -e ./packages/pi-example
```

必要时直接加载入口：

```bash
pi --no-extensions -e ./packages/pi-example/extensions/index.ts
```

包含 Skill、Prompt 或 Theme 时优先加载整个 Package 目录。

## Global dogfood

候选版本通过隔离测试后，以绝对路径加入全局 Pi：

```bash
pi install /absolute/path/pi-plugins/packages/pi-example
```

至少完成一个真实工作任务，并验证重启、`/reload`、Session 生命周期、无 UI 模式和资源清理。

## Switching to the npm release

发布后移除本地路径，再安装 npm 正式版：

```bash
pi remove /absolute/path/pi-plugins/packages/pi-example
pi install npm:@kedoupi/pi-example
```

不得同时加载本地版和 npm 版。
