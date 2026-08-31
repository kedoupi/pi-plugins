# AX Feishu Bridge

[English](./ax-feishu-bridge.md) | [简体中文](./ax-feishu-bridge.zh-CN.md)

> Research basis: 0.4.9, checked 2026-08-31.
> Documentation review only; not a security guarantee.

## About
AX Feishu Bridge is a Pi package that bridges Pi conversations into Feishu or Lark bots so you can chat with a local coding agent from direct messages, group chats, and topics.

## Best For
Use it when you want remote conversation access from Feishu or Lark and are comfortable reviewing the bot setup, credential storage, and listener exposure on the machine running Pi.

## Capabilities
- Upstream docs describe private-chat, group-chat, and topic bridging, with independent sessions per chat or topic.
- First-run setup happens through `/feishu setup`, which can auto-create a bot by QR scan or accept a manually created App ID and App Secret.
- Pi management commands include `/feishu start`, `/feishu stop`, `/feishu restart`, `/feishu status`, `/feishu autostart`, `/feishu debug`, and `/feishu reset`.
- In-chat commands documented upstream include `/new`, `/resume`, `/model`, `/thinking`, `/stop`, `/workspace`, `/status`, `/config`, and `/commands`.
- Public sources also describe attachment input, interactive-card parsing, streaming reply cards, runtime config updates, and a background daemon that keeps the bridge alive.

## Installation
```bash
pi install npm:ax-feishu-bridge
```

## Quick Start
1. Install the package inside Pi.
2. Run `/feishu setup` and either scan the QR code to auto-create the Feishu assistant or enter an existing App ID and App Secret manually.
3. Run `/feishu start` unless auto-start is already enabled.
4. Open the bot in Feishu or Lark and start chatting; group behavior depends on the configured group policy.

## Commands and Tools
- `/feishu setup`, `/feishu start`, `/feishu stop`, `/feishu restart`, `/feishu status`, `/feishu autostart`, `/feishu debug`, `/feishu reset [confirm]`
- `/new`, `/resume`, `/model`, `/thinking`, `/stop`, `/workspace`, `/status`, `/config`, `/commands`
- Group policies `open` and `mention`
- `@larksuiteoapi/node-sdk` is the documented transport dependency behind the Feishu/Lark connection

## Configuration
- Upstream docs point Pi users to `~/.pi/agent/feishu/config.pi.json`, with `config.json` as a legacy alias.
- Environment-variable configuration uses the `FEISHU_` prefix, including `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_DOMAIN`, `FEISHU_GROUP_POLICY`, and `FEISHU_LANGUAGE`.
- Card-action handling is configurable through `FEISHU_CARD_ACTION_MODE`, `FEISHU_CARD_ACTION_WEBHOOK_HOST`, `FEISHU_CARD_ACTION_WEBHOOK_PORT`, and `FEISHU_CARD_ACTION_WEBHOOK_PATH`.
- Other documented options include group keywords, ignore-bot behavior, prompt notifications, and hard task timeout values.

## Permissions and Security
- Bot credentials are stored locally in the Feishu config file or provided through `FEISHU_` environment variables.
- Messages, quoted content, and supported attachments leave the local Pi process for Feishu or Lark through the bridge transport; upstream docs note that image understanding still depends on the selected model.
- Public sources describe an optional local HTTP card-callback webhook that defaults to `0.0.0.0:3001/webhook/card` on Pi; a `ws` mode exists if you do not want that webhook path.
- Upstream security notes say runtime `/config` updates are limited to a whitelist and secret values are redacted in debug logs.
- The bridge keeps local persistent state under the Feishu directory and documents a background daemon so the connection can survive after the foreground Pi session closes.
- The reviewed public sources do not clearly document any separate media-conversion subprocesses beyond the Pi/DSH runtime itself, so deeper subprocess behavior should be treated as unknown.
- Upstream docs explicitly require extra Feishu permission for group-policy `open` message capture, but they do not publish a full permission matrix; other app scopes and approvals should be treated as unknown until you verify the Feishu console yourself.

## Compatibility
- npm package version researched here: `0.4.9`.
- Upstream package metadata lists Node.js `^22.19.0 || >=24.0.0`, ESM packaging, Pi extension exports, and DeepSeek Harness support.
- Public sources say Pi and DSH can coexist with separate config directories and different default webhook ports.
- The transport depends on `@larksuiteoapi/node-sdk` and related Pi/DSH peer dependencies from the published package metadata.
- This entry is based on public sources only and is not claimed as locally tested.

## Limitations
- The public repository does not include a LICENSE file; MIT evidence comes from npm and `package.json` metadata only.
- Group-policy `open` requires manually enabling Feishu's "get all group messages" permission.
- The documented state directory is hardcoded to `~/.pi/agent/feishu` and is listed upstream as an open issue.
- Public issue references mention a Pi `0.81.1` compatibility problem and a Windows PowerShell `/feishu start` problem.
- Unsupported or unclear permissions beyond the documented group-message requirement remain unknown here rather than inferred.
- The notes above come from README, package metadata, release notes, and issue summaries, not from running the bridge in this repository.

## Upstream and License
- Repository: https://github.com/AX1202/ax-feishu-bridge
- README: https://github.com/AX1202/ax-feishu-bridge/blob/main/README_EN.md and https://github.com/AX1202/ax-feishu-bridge/blob/main/README.md
- package.json: https://github.com/AX1202/ax-feishu-bridge/blob/main/package.json
- Latest release notes: https://github.com/AX1202/ax-feishu-bridge/releases/tag/v0.4.9
- License: MIT. Public evidence is the npm registry metadata https://registry.npmjs.org/ax-feishu-bridge and the upstream `package.json` license field.
- Repository license caveat from research: https://api.github.com/repos/AX1202/ax-feishu-bridge/licenses and https://github.com/AX1202/ax-feishu-bridge/issues
