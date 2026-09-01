# @kedoupi/pi-im-feishu

Keep one Feishu or Lark bot online on this computer. Chat remotely; open Pi only to configure it or attach a conversation.

Approved product and technical documents: [docs/pi-im-feishu](../../docs/pi-im-feishu/README.md).

## About

The Package runs a resident assistant after the Pi window closes. **Online** means the Feishu long connection is ready and the assistant process owns the machine lock. Each private chat, group, or topic has its own bound folder and Pi session.

Automated tests inject the Feishu transport and API boundaries. They prove local routing and lifecycle behavior, not connectivity to a real Feishu tenant. The Package is ready for a disposable-app local test; it is not published or production-tested.

## Installation

Project-local source loading is the first step:

```bash
pi --no-extensions -e ./packages/pi-im-feishu/extensions/index.ts
```

After automated smoke passes, install the local source for dogfood:

```bash
pi install /absolute/path/pi-plugins/packages/pi-im-feishu
```

Do not install a local source and an npm version together. No npm release exists yet; publishing requires maintainer confirmation.

## Quick Start

1. In Pi TUI, run `/feishu setup qr`, or run `/feishu setup manual cli_xxx feishu` and enter the App Secret in the masked prompt. Use `lark` for Lark.
2. Check `/feishu status`. Online is shown only after the long connection is ready.
3. Bind an absolute folder with `/feishu folder <full-chat-key> /absolute/path`.
4. Test with a disposable Feishu/Lark app before global dogfood. Closing Pi does not stop the assistant; the computer still needs power, network, and an awake user session.

## Commands, Tools, and Shortcuts

Pi TUI:

- `/feishu setup qr`
- `/feishu setup manual <appId> [feishu|lark]` — secret is requested separately and masked
- `/feishu start`, `/feishu stop`, `/feishu status`, `/feishu chats`
- `/feishu folder <full-chat-key> <absolute-path>`
- `/feishu attach <full-chat-key>` — transfers the existing session from the assistant to this Pi window; closing the matching window releases it

Full keys are `p2p:<chat-id>`, `group:<chat-id>`, or `topic:<chat-id>:<thread-id>`. Print and JSON modes refuse setup, start, stop, folder, and attach without prompting, spawning, or opening a socket.

In Feishu: `/stop`, `新对话`, `换文件夹 /绝对路径`, `以前的`, `以前的 1`, and `帮助`. Group/topic work requires a real mention of the configured bot. Important operations are confirmed only by the original requester in the same chat; group/topic confirmation also requires a bot mention.

Inbound attachments are staged collision-safely at `<bound-folder>/.pi-im-feishu/inbox/<message-id>/<safe-name>`. The controlled `send_feishu_file` tool can queue one regular file inside the bound folder, asks the requester for confirmation, and sends only to the originating chat/topic.

## Configuration

Default machine state is `~/.pi/agent/pi-im-feishu/`; tests may override it with `PI_IM_FEISHU_HOME`.

- `config.json` — bot metadata, chats, delivery/confirmation state, and ownership leases; no App Secret
- `secrets.json` — App Secret, created as `0600`
- `assistant.lock` — process presence and readiness heartbeat
- `assistant.log` — resident-process output
- `config.lock` and lock guards — short-lived cross-process mutation locks

State directories are private (`0700`). Session files remain Pi-native JSONL files. Package replacement or removal does not delete machine state.

## Environment Variables

- `PI_IM_FEISHU_HOME` — override the machine-state directory
- `PI_IM_FEISHU_ASSISTANT=1` — internal child-process guard set by the Package

Credentials are not accepted through `FEISHU_*` environment variables.

## Permissions and Security

This is a remote coding agent, not an OS sandbox. Anyone who can DM the bot can request work in v1; groups/topics require @mention. Read-only work and new in-workspace files may run automatically. Existing-file edits, destructive or non-read-only shell work, installation/service/deployment changes, outside-workspace access, network operations, and file sending require requester confirmation. Shell commands still run with the current user's OS permissions after confirmation.

Review model/provider configuration and cost before leaving the assistant online. Prompts can consume paid model tokens. Keep the App Secret private and use a disposable app for first testing. No public webhook is opened.

## Known Conflicts

Do not run `ax-feishu-bridge` or another long-connection client on the same app. This Package uses its own lock and cannot coordinate with another client's lock. A conflicting or disconnected socket is reported offline.

Login autostart is implemented only for macOS launchd. Automated tests inject launchctl; they do not prove a real LaunchAgent on this machine. Unsupported platforms report autostart as unsupported. Stop still terminates the assistant if autostart removal fails. During rebind, a recovered disable error is cleared after the new start successfully enables autostart; unrecovered errors remain visible.

## Update and Rollback

Stop before changing code:

```text
/feishu stop
```

For a local-source update, replace the Package checkout and start again. Remove with `pi remove /absolute/path/pi-plugins/packages/pi-im-feishu`; machine state remains under the path above. After a future release, pin or roll back explicitly:

```bash
pi install npm:@kedoupi/pi-im-feishu@<version>
```

Back up machine state before destructive manual cleanup. Never delete it as part of a Package rollback.

## Compatibility

- Node.js 22 or newer
- Pi coding agent is a required peer (`peerDependencies: "*"`)
- Installed-tarball smoke currently resolves the local Pi peer `0.84.4`
- Feishu SDK boundary tests use injected clients; real Feishu/Lark connectivity remains a disposable-app acceptance step

## License

MIT. Copyright (c) 2026 KeDouPi.
