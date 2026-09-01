# Pi IM Feishu Production Hardening Design

**Date:** 2026-09-01
**Status:** Approved in conversation; written review pending
**Scope:** Complete P0-P3 local-dogfood candidate

## Summary

Harden the existing `@kedoupi/pi-im-feishu` architecture rather than replacing it. The Pi window remains the configuration and attach surface. A separate assistant process owns the Feishu long connection and one Pi `AgentSession` per bound chat. Shared machine state coordinates both processes.

The work fixes every blocking and important issue found in the first implementation review, completes real cross-process session handoff and bidirectional file transfer, and leaves the Package ready for the maintainer's real-credential local dogfood workflow. It does not publish the Package.

## Source of Truth and Compatibility

Implementation must continue to follow, in order:

1. `docs/pi-im-feishu/prd.md`
2. `docs/pi-im-feishu/technical.md`
3. this hardening design
4. `docs/pi-im-feishu/plan.md`

Where an older document claims behavior that the implementation never provided, this design supplies the missing production contract. The canonical product and technical documents must be updated in the implementation so that completed and deferred work is stated truthfully.

The approved v1 product decisions remain unchanged:

- macOS 15 and Pi TUI are the primary local environment;
- Feishu and Lark are supported through official long connections;
- no public webhook is introduced;
- private chats are accepted without a sender allowlist in v1;
- group and topic chats require a real mention of the configured bot;
- ordinary operations may proceed automatically, while important operations require requester confirmation;
- the repository remains private and unpublished until local dogfood passes.

## Chosen Approach

### Adopted: harden the current architecture

Keep the current module boundaries and replace weak production wiring in place. This minimizes migration risk, preserves the approved product flow, and keeps the diff reviewable.

### Rejected: rewrite around a Pi RPC child process

An RPC child would make SDK discovery easier but would add another protocol, lifecycle, and failure surface. It also moves away from the approved direct SDK `AgentSession` design.

### Rejected: extract a generic IM framework

Only Feishu/Lark is in scope. A channel abstraction, provider registry, or generic IM core would be speculative and is intentionally deferred.

## Runtime Components

### Pi extension

The extension:

- registers `/feishu` and related TUI behavior;
- never opens a Feishu socket during factory evaluation;
- refuses interactive setup and process-spawning operations in print or JSON mode;
- writes binding and folder configuration through the shared store;
- starts, stops, and observes the assistant process;
- requests and maintains window ownership when attaching a chat session;
- invokes `ctx.switchSession(sessionFile)` only after the assistant has released ownership;
- releases window ownership on `session_shutdown`.

### Resident assistant

The assistant:

- refuses to start when configuration says `stopped`;
- acquires one atomic process lock;
- resolves the real Pi SDK and constructs the Pi runner before reporting online;
- owns the Feishu long connection;
- routes accepted messages to one serialized worker per chat key;
- owns background `AgentSession` instances only when the window does not hold the chat lease;
- serves ownership handoff requests;
- updates lock state from real transport readiness;
- closes sessions, timers, transport, and lock on every exit path.

### Feishu transport

The transport:

- reports ready, disconnected, and error transitions;
- includes message id, root/thread id, sender open id, sender type, mentions, and attachments in normalized inbound events;
- sends topic replies through Feishu's reply API rather than posting to the group root;
- chunks oversized text;
- uploads images through `image.create` and other files through `file.create`;
- never silently downgrades a failed file send to success.

### Shared store and control plane

The store remains file-based and uses only Node.js standard-library primitives. It contains credentials separately from non-secret configuration.

Every mutation uses:

1. a cross-process lock acquired by atomic `mkdir` or exclusive file creation;
2. bounded retry with stale-owner recovery;
3. read-modify-write under the lock;
4. a temporary file created with the final mode;
5. atomic `rename` into place;
6. lock release in `finally`.

Permissions:

- state directory: `0700`;
- secret file: `0600` from creation;
- non-secret state and lock metadata: no broader than `0600` where practical.

State must not contain plaintext secrets outside the secret file.

## Dependency and SDK Resolution

`@earendil-works/pi-coding-agent` becomes a required peer dependency rather than an optional peer. The detached process must be able to resolve it from the Package's installation graph.

Assistant startup order is strict:

1. read `stopped` and binding state;
2. acquire the assistant lock;
3. import and validate the Pi SDK exports;
4. build the Pi runner;
5. create the Feishu transport;
6. wait for real transport readiness;
7. publish online state.

Any failure before step 7 leaves the assistant offline and releases all acquired resources. A missing SDK is a visible startup error, never a reduced-capability online mode.

## Message Identity and Routing

Binding verification records the configured bot's real open id. QR and manual binding must both run the same verification path and write the same normalized binding record.

An inbound event is accepted when:

- the sender is not a bot;
- the message id has not already completed successfully;
- a private chat is addressed directly to the bot; or
- a group/topic message contains a mention whose open id equals the configured bot open id.

If bot identity is unavailable, group/topic messages are rejected rather than matched against any mention.

Canonical keys remain:

- `p2p:<chat-id>`
- `group:<chat-id>`
- `topic:<chat-id>:<thread-id>`

Topic folder binding and ownership always use the full topic key.

Deduplication is bounded and persistent, with explicit `in-progress` and `complete` states so concurrent duplicate deliveries cannot execute twice. A message is marked complete only after its handling result has been sent successfully. A failed attempt clears or expires `in-progress`, allowing retry without permanently losing the message.

## Requester-Bound Confirmation

Pending confirmation records include:

- chat key;
- original sender open id;
- source message id;
- sanitized operation summary;
- expiry;
- one resolver identity.

A confirmation is consumed only when:

- it comes from the same chat key;
- it comes from the original sender;
- in a group/topic, it mentions the configured bot;
- the text is an exact supported confirmation or rejection phrase;
- it has not expired.

`/stop` and other local control commands are processed before confirmation consumption. Unrelated text and messages from other members leave the pending request unchanged.

## Agent Resource Boundary

The resident runner uses `DefaultResourceLoader` with extensions and prompt templates disabled. It does not load the user's globally installed Pi extensions, extension commands, or their lifecycle side effects.

The session receives only an explicit coding tool set plus the Package's controlled Feishu file tool. File-oriented tools validate that resolved paths remain inside the bound workspace. Symlink and traversal checks use real paths for existing ancestors.

The product is a remote coding agent, not an OS sandbox. Shell commands can intentionally operate beyond the workspace after requester confirmation. Documentation must retain the remote-control and model-cost warning.

## Important Operation Policy

The existing parameter-name heuristic is removed. Policy uses the real tool schemas and filesystem state.

Automatic operations include:

- read-only file tools inside the workspace;
- creation of a new file inside the workspace;
- a conservative allowlist of clearly read-only shell commands.

Requester confirmation is required for:

- editing or overwriting an existing file;
- deleting or moving existing content;
- shell commands not provably read-only;
- package installation or removal;
- permission, ownership, process, service, credential, Git history, or deployment changes;
- access outside the bound workspace;
- network or non-Feishu outbound operations;
- sending a local file to Feishu.

The policy may be stricter than the original PRD list. Confirmation summaries must redact configured secrets and common credential shapes.

## Session Lifecycle

Each chat has at most one cached background `AgentSession`.

### Normal message

1. acquire the chat's worker lane;
2. verify assistant ownership;
3. create or reuse the configured session;
4. set the active AbortController only when execution begins;
5. run the prompt;
6. persist the actual session file;
7. send text and queued files;
8. clear the active controller in `finally`.

### Stop

`/stop` aborts the currently executing prompt and rejects or clears queued work for that chat. It must never replace the active controller with a controller belonging to queued work.

### New conversation

`new` archives the old session reference, disposes the cached session, stores `sessionFile: null`, and guarantees that the next prompt creates a fresh session.

### Change folder

Changing the bound folder archives and disposes the old session before updating the folder. The next prompt creates a new session in the new cwd.

### Previous conversation

Restoring a previous session validates that the session belongs to the current bound folder before opening it.

## Cross-Process Ownership and Attach

Ownership is persisted per chat, not held in an in-memory `Map`.

A lease includes:

- owner: `assistant` or `window`;
- owning PID;
- session file;
- request id;
- heartbeat time;
- state: `requested`, `releasing`, or `owned`.

### Attach flow

Attach requires an existing remote session file; when the chat has no conversation yet, the extension returns an actionable message instead of creating an unrelated local session.

1. the extension validates that the current window cwd equals the chat's bound folder;
2. it writes a window ownership request with its PID;
3. the assistant control loop sees the request;
4. the assistant aborts active work for that chat, clears queued work, waits for settlement, persists the latest session file, and disposes its cached `AgentSession`;
5. the assistant grants the window lease;
6. the extension waits for the grant and calls `ctx.switchSession(sessionFile)`;
7. the newly loaded extension instance confirms and heartbeats the lease during `session_start`;
8. Feishu messages for the attached chat receive a clear paused response instead of being executed.

### Release and recovery

On `session_shutdown`, the extension releases the lease. The assistant can then reopen the same session for later Feishu messages.

If the window process dies or its heartbeat becomes stale, the assistant verifies that the PID is dead before reclaiming ownership. No timeout alone may authorize two writers while the PID remains alive.

## Bidirectional Files

### Inbound

Inbound files are staged below the bound workspace:

```text
.pi-im-feishu/inbox/<message-id>/<safe-filename>
```

The path is collision-safe and cannot overwrite an existing project file. Download failure aborts handling rather than creating an empty file. The prompt lists the staged paths explicitly.

### Outbound

The runner exposes a controlled `send_feishu_file` tool. The tool:

- accepts one path inside the bound workspace;
- verifies that the file exists and is a regular file;
- requests confirmation from the original sender;
- queues the file for the current run instead of sending to an arbitrary destination.

After the prompt completes, the router sends queued files only to the originating chat or topic. Images and ordinary files use their respective Feishu upload APIs. A send failure is reported and keeps the message retryable.

## Binding, TUI, and Autostart

Interactive setup is available only when `ctx.hasUI` and `ctx.mode === "tui"`. Print and JSON modes return an instruction and perform no QR registration, prompt, socket, or spawn side effect.

Manual setup collects the secret through a masked TUI component rather than placing it in slash-command history. The secret is verified before replacing the active binding.

Rebinding follows a controlled transition:

1. verify the candidate credentials;
2. stop the old assistant connection;
3. atomically replace credentials and bot identity;
4. start and verify the new assistant;
5. report failure truthfully and keep enough state for explicit retry.

`stop` always attempts to terminate the assistant even when autostart removal fails. Autostart errors remain visible. Unsupported platforms return an explicit unsupported status.

Assistant status is one of `unbound`, `starting`, `online`, or `offline`, with a separate last-error field. User-facing text is consistently localized.

## Error Handling

Errors are classified at module boundaries:

- configuration or binding errors: actionable TUI/Feishu message;
- SDK startup errors: assistant remains offline with a durable last error;
- transport disconnect: online state is removed immediately;
- model/tool error: reply to the originating chat without leaking credentials;
- store corruption: preserve the corrupt file for recovery and stop mutation;
- ownership timeout: do not switch sessions and retain a single owner;
- file upload/download error: report the specific file failure and keep retry semantics.

No catch block may convert a failed required action into a successful status.

## Testing Strategy

### Unit tests

Add or strengthen tests for:

- real SDK schema and required-peer behavior;
- group bot identity and requester-bound confirmation;
- topic replies;
- command parsing and no-UI guards;
- tool policy against real read/write/edit/bash schemas;
- new, folder-change, previous, stop, and queue races;
- atomic store mutation, permissions, and concurrent processes;
- collision-safe inbound files and controlled outbound files;
- stale and live ownership leases;
- rebinding and autostart failure paths.

### Process integration tests

Spawn real Node child processes with temporary state homes to prove:

- the detached process resolves the installed Pi SDK;
- lock acquisition is exclusive;
- startup never reports online before SDK and transport readiness;
- disconnect removes online state;
- stop and `stopped` prevent resurrection;
- assistant/window ownership handoff permits only one writer;
- cleanup removes timers and locks.

Feishu API boundaries remain injected in automated tests; real credentials are not used.

### Pi and Package smoke tests

- load the extension project-locally;
- verify print/JSON modes have no interactive or process side effects;
- pack the Package;
- install the tarball into a temporary Pi/npm environment with its peer graph using only local workspace/host artifacts, never a network fetch;
- start and stop the assistant fixture from the installed Package;
- verify update, uninstall, and rollback state preservation.

### Repository gates

Before local-dogfood handoff:

```bash
npm run check
npm test
npm run pack:check
git diff --check
```

Run LSP/type diagnostics before build or test gates, and verify no blocking diagnostics remain.

## Local Dogfood Workflow

After automated and installed-package smoke tests pass, the maintainer follows the established lifecycle:

1. project-local `.pi/settings.json` loads the source Package in an isolated project;
2. a disposable Feishu/Lark app validates real QR/manual binding, private chat, group mention, topic reply, confirmation, attach, restart, and files;
3. the local source Package may then be added to the global Pi configuration for daily dogfood;
4. only after dogfood passes may publishing work be proposed.

The implementation can be declared **ready for local testing** without real credentials only when every automated gate and independent review passes. It cannot be declared production-tested until the maintainer completes the real Feishu dogfood checklist.

## Non-Goals

This work does not add:

- a generic multi-channel IM framework;
- a public webhook or hosted relay;
- Windows or Linux autostart implementation;
- a sender allowlist not approved by the v1 PRD;
- a root Suite Package;
- publishing automation, npm Trusted Publishing, or a release;
- an OS-level shell sandbox.

## Acceptance Criteria

The Package is ready for maintainer local testing when:

1. a detached installed-package process resolves and creates the real Pi SDK runner;
2. online state always reflects real transport readiness;
3. important operations require confirmation from the original requester;
4. group and topic messages target the configured bot and reply in place;
5. new, previous, folder change, stop, and queued work have deterministic session behavior;
6. state and secrets are atomically and safely persisted under concurrent processes;
7. attach transfers ownership between assistant and Pi window without simultaneous writers;
8. inbound and outbound file flows work through controlled paths;
9. print/JSON modes produce no interactive or resident-process side effects;
10. source, process integration, installed tarball, repository gates, and independent review all pass;
11. documentation describes only behavior that the implementation and evidence support.
