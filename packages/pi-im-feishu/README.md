# @kedoupi/pi-im-feishu

Keep one Feishu bot online on this computer. Chat in Feishu; open Pi only to look or attach.

Approved docs: [docs/pi-im-feishu](../../docs/pi-im-feishu/README.md).

## About

This package binds **one Feishu bot to the computer**. A resident assistant keeps Feishu online after the Pi window closes. **Online** means Feishu can deliver messages here **and** the assistant process is running.

Each Feishu chat is its own line of work. After a folder is bound, Feishu text runs the local coding agent in that folder (serial per chat). `/stop` in Feishu aborts the current run. Destructive tools ask for 确认 in Feishu. The Pi window is a remote.

## Installation

```bash
pi install /absolute/path/pi-plugins/packages/pi-im-feishu
```

After a release:

```bash
pi install npm:@kedoupi/pi-im-feishu
```

`@larksuiteoapi/node-sdk` is a runtime dependency and installs with the package. You should not install it yourself. Do not load a local path and the npm package at the same time.

## Quick Start

1. Install and start Pi.
2. Bind Feishu (same bot either way):

   ```text
   /feishu setup manual cli_xxx <app-secret>
   ```

   or `/feishu setup qr`.

3. Status must say 在线 only after Feishu can receive. Close Pi; Feishu should still be received.
4. `/feishu stop` takes it offline. After stop, login must not start it again.

## Commands, Tools, and Shortcuts

- `/feishu setup qr` — scan to create/authorize
- `/feishu setup manual <appId> <appSecret> [feishu|lark]` — existing app
- `/feishu start` / `/feishu stop`
- `/feishu status` / `/feishu chats`
- `/feishu folder <p2p|group> <chatId> <absolute-path>`
- `/feishu attach <chat-key>` — if the folder matches, pauses assistant writes for that chat

In Feishu: `/stop`，新对话，换文件夹 /绝对路径，以前的，帮助。 Chat files are copied into the bound folder. Result files can be sent back when the agent returns them.

## Configuration

`~/.pi/agent/pi-im-feishu/` or `PI_IM_FEISHU_HOME`:

- `config.json` — bot metadata and chat list (no secret)
- `secrets.json` — App Secret, `0600`
- `assistant.lock` — who owns the assistant
- `assistant.log` — assistant output

Groups: mention only. Folders must be absolute.

## Environment Variables

- `PI_IM_FEISHU_HOME` — state directory
- `PI_IM_FEISHU_ASSISTANT=1` — set on the spawned assistant

No `FEISHU_*` credentials.

## Permissions and Security

Anyone who can DM this bot can talk to it (no allowlist in v1). Groups require @. Ordinary tools run automatically; destructive actions confirm in Feishu with 确认.

- Secret never appears in status.
- Closing the Pi window does not stop the assistant; `/feishu stop` does.
- No public HTTP webhook. Long connection only.
- Login autostart: if last action was stop, reboot must not come online.
- Attach never silently changes directory.

## Known Conflicts

Do not run `ax-feishu-bridge` on the same Feishu app. This package uses its own lock, not `~/.pi/agent/locks.json`. If the WebSocket fails, status is offline and may say another client holds the app.

## Update and Rollback

`/feishu stop` before replacing a running checkout. `pi remove` to uninstall. After publish, pin with `pi install npm:@kedoupi/pi-im-feishu@<version>`.

## Compatibility

- Node.js 22 or newer
- Pi coding agent `peerDependencies: "*"`
- Project-local; not yet verified against a published Pi release

## License

MIT. Copyright (c) 2026 KeDouPi.
