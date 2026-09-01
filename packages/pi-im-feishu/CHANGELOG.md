# Changelog

## 0.1.0

- Machine-level Feishu bind: QR or manual, one bot per computer.
- Resident assistant: online only after the long connection is ready.
- Inbound chats join the list; groups require @; no folder means no work.
- TUI remote: setup, start, stop, status, folder, attach explanation.
- Login autostart is injectable; stop disables it. macOS writes a LaunchAgent and calls launchctl bootstrap/load.
- Bound chats run the local coding agent (injectable). Same chat is serial; `/stop` aborts.
- Destructive bash/write/delete asks for 确认 in Feishu; the reply is consumed before the next prompt.
- Feishu commands: 新对话, 换文件夹, 以前的, 帮助.
- Inbound files require a real download into the chat folder; outbound absolute files upload through Feishu APIs.
- Attach pauses assistant writes when folders match.
- WebSocket is online only after onReady; handshake timeout fails closed.
- Nested Pi sessions reuse one AgentSession per chat and do not load this TUI extension.
