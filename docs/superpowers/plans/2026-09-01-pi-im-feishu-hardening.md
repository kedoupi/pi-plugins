# Pi IM Feishu Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@kedoupi/pi-im-feishu` a complete P0-P3 local-dogfood candidate with truthful runtime state, requester-bound safety, deterministic sessions, cross-process attach ownership, and bidirectional files.

**Architecture:** Preserve the existing Pi extension plus detached assistant architecture. Harden it with atomic file-backed state, an explicit Pi SDK/tool boundary, persistent per-chat coordination, and official Feishu reply/file APIs. Keep modules small and use Node.js standard-library primitives instead of adding a service, database, or generic IM abstraction.

**Tech Stack:** Node.js >=22, ECMAScript modules, Pi Extension API and coding-agent SDK, `@larksuiteoapi/node-sdk@1.73.0`, Node built-in test runner, macOS launchd.

**Spec:** `docs/superpowers/specs/2026-09-01-pi-im-feishu-hardening-design.md`

## Global Constraints

- First-party code stays under `packages/pi-im-feishu/`; the root repository remains non-installable and private.
- `@earendil-works/pi-coding-agent` is a required peer; no silent reduced-capability runtime is allowed.
- Do not add a database, public webhook, hosted relay, channel framework, sender allowlist, OS shell sandbox, Suite, publish workflow, or release.
- Use Node.js standard-library locking and atomic rename; do not add a runtime dependency for persistence, queues, parsing, or IPC.
- Preserve Feishu and Lark domain support and official long connections.
- Private chats remain accepted without a sender allowlist; group/topic chats require the configured bot's real open id.
- No real Feishu credentials, private paths, environment dumps, or local inventory may enter tests, fixtures, logs, or commits.
- Every task follows red-green-refactor TDD and ends with its focused tests plus the complete Package test suite passing.
- Do not publish. Publishing requires explicit maintainer confirmation after real dogfood.

## File Responsibility Map

- `src/atomic-json.mjs`: atomic JSON creation/replacement with final permissions.
- `src/file-lock.mjs`: bounded cross-process lock with live-PID and stale-lock recovery.
- `src/store.mjs`: validated configuration, secrets, chats, delivery states, and ownership records.
- `src/lock.mjs`: exclusive assistant process lock and truthful presence heartbeat.
- `src/pi-session.mjs`: Pi SDK loading, isolated `AgentSession` pool, release/dispose, tool interception, outbound tool context.
- `src/tool-policy.mjs`: workspace path validation, real built-in tool classification, sanitised confirmation summaries.
- `src/inbound.mjs`: normalized message identity, sender identity, configured-bot mentions, topic metadata, attachment metadata.
- `src/confirm-wait.mjs`: one requester-bound pending confirmation per chat.
- `src/router.mjs`: filtering, persistent delivery states, command/confirmation routing, response persistence.
- `src/feishu-transport.mjs`: WS readiness/disconnect, text/topic reply, file/image upload, download.
- `src/work.mjs`: per-chat lane, current AbortController, queue cancellation, session lifecycle commands.
- `src/ownership.mjs`: assistant/window ownership requests, handoff, heartbeat, release, and stale-window recovery.
- `src/files.mjs`: collision-safe inbound staging and outbound path validation.
- `src/assistant.mjs`: production composition and cleanup.
- `src/assistant-control.mjs`: TUI-side process, folder, ownership, and status control.
- `src/tui.mjs`: interactive-only commands, masked setup, attach/session lifecycle UI.
- `src/macos-autostart.mjs`: checked launchd installation/removal and restart contract.
- `test/*.test.mjs`: focused unit and process-integration evidence.
- `docs/pi-im-feishu/*.md` and Package/root READMEs: canonical truthful product, technical, workflow, and safety documentation.

---

### Task 1: Atomic State and Exclusive Process Lock

**Files:**
- Create: `packages/pi-im-feishu/src/atomic-json.mjs`
- Create: `packages/pi-im-feishu/src/file-lock.mjs`
- Modify: `packages/pi-im-feishu/src/paths.mjs`
- Modify: `packages/pi-im-feishu/src/store.mjs`
- Modify: `packages/pi-im-feishu/src/lock.mjs`
- Test: `packages/pi-im-feishu/test/store.test.mjs`
- Test: `packages/pi-im-feishu/test/lock.test.mjs`
- Create: `packages/pi-im-feishu/test/store-process.test.mjs`

**Interfaces:**
- Produces: `atomicWriteJson(file, value, { mode?: number }): Promise<void>`.
- Produces: `withFileLock(lockDir, fn, { timeoutMs?, staleMs?, pid?, isAlive?, now? }): Promise<T>`.
- Produces: `pidIsAlive(pid): boolean` from `lock.mjs` for Task 5.
- Preserves: `createStore(home)`, `createLock(home)`, and their existing public methods.
- Adds: `store.updateChat(key, updater)` where `updater(current)` returns the replacement chat record under one cross-process mutation lock.
- Adds: one random `bindingId` stored in both public binding metadata and the secret record; `loadCredentials()` returns credentials only when the ids match, preventing mixed old/new credentials after a partial two-file update.

- [ ] **Step 1: Write failing atomicity, permission, concurrency, and lock-race tests**

```js
it("creates secrets as 0600 without a permissive window", async () => {
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_1234567890abcdef",
    appSecret: "secret-value",
    domain: "feishu",
    boundVia: "manual",
    botOpenId: "ou_bot"
  });
  assert.equal((await stat(store.secretFile)).mode & 0o777, 0o600);
});

it("never loads mixed credentials after a partial binding write", async () => {
  const store = createStore(home, { afterSecretWrite: async () => { throw new Error("crash"); } });
  await assert.rejects(store.bindBot(binding));
  assert.equal(await store.loadCredentials(), null);
});

it("does not lose concurrent chat updates from separate stores", async () => {
  const a = createStore(home);
  const b = createStore(home);
  await Promise.all([
    a.upsertChat("p2p:a", { folder: "/tmp/a" }),
    b.upsertChat("p2p:b", { folder: "/tmp/b" })
  ]);
  const status = await a.status();
  assert.deepEqual(status.chats.map((chat) => chat.key).sort(), ["p2p:a", "p2p:b"]);
});

it("allows only one concurrent assistant acquire", async () => {
  const a = createLock(home);
  const b = createLock(home);
  const results = await Promise.allSettled([
    a.acquire({ pid: 1001, appId: "cli_a", isAlive: () => true }),
    b.acquire({ pid: 1002, appId: "cli_a", isAlive: () => true })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected")[0].reason.code, "assistant-busy");
});
```

The process test launches two `node` children against one temporary home; each updates a different chat and prints JSON. The parent asserts both children exit `0` and both chat records survive.

- [ ] **Step 2: Run focused tests and verify the expected failures**

Run:

```bash
node --test \
  packages/pi-im-feishu/test/store.test.mjs \
  packages/pi-im-feishu/test/lock.test.mjs \
  packages/pi-im-feishu/test/store-process.test.mjs
```

Expected: permission-window instrumentation, concurrent chat preservation, or exclusive acquisition assertions fail against direct `writeFile` and unlocked read-modify-write.

- [ ] **Step 3: Implement atomic JSON and file locking**

Core write shape:

```js
export async function atomicWriteJson(file, value, { mode = 0o600 } = {}) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode, flag: "wx" });
    await rename(temp, file);
    await chmod(file, mode);
  } finally {
    await rm(temp, { force: true });
  }
}
```

`withFileLock` must atomically create a lock directory containing `{ pid, createdAt }`, retry only until `timeoutMs`, and remove a stale lock only when its PID is dead. `store.mjs` must run each config mutation under this lock and write the secret at `0600` on first creation. Bindings use a shared random `bindingId`; a missing or mismatched public/secret id makes `loadCredentials()` return `null` instead of combining two generations. `lock.mjs` must acquire with exclusive creation, recover only dead owners, heartbeat by atomic replacement, and never let heartbeat revive a lost lock.

- [ ] **Step 4: Run focused and complete Package tests**

```bash
node --test packages/pi-im-feishu/test/store*.test.mjs packages/pi-im-feishu/test/lock.test.mjs
npm test --workspace @kedoupi/pi-im-feishu
```

Expected: all pass; temporary lock and JSON files are absent after success and failure cases.

- [ ] **Step 5: Commit**

```bash
git add packages/pi-im-feishu/src/{atomic-json,file-lock,paths,store,lock}.mjs \
  packages/pi-im-feishu/test/{store,store-process,lock}.test.mjs
git commit -m "fix(feishu): make shared state atomic"
```

---

### Task 2: Required Pi Runtime and Explicit Tool Boundary

**Files:**
- Modify: `packages/pi-im-feishu/package.json`
- Modify: `package-lock.json`
- Create: `packages/pi-im-feishu/src/tool-policy.mjs`
- Modify: `packages/pi-im-feishu/src/important.mjs`
- Modify: `packages/pi-im-feishu/src/pi-session.mjs`
- Modify: `packages/pi-im-feishu/src/assistant.mjs`
- Test: `packages/pi-im-feishu/test/pi-session.test.mjs`
- Create: `packages/pi-im-feishu/test/tool-policy.test.mjs`
- Modify: `packages/pi-im-feishu/test/assistant.test.mjs`

**Interfaces:**
- Produces: `classifyToolCall(name, input, { folder }): Promise<{ blocked: boolean, confirm: boolean, detail: string, reason?: string }>`.
- Produces: `redactSensitive(value, secrets): string`.
- Changes: `loadPiSdk()` resolves a valid SDK or throws `{ code: "pi-sdk-missing" }`; it never returns `null`.
- Changes: `createPiRunPrompt(pi)` returns a callable runner with `release(key)`, `dispose()`, and exact session-file matching.
- Consumes: atomic store/lock behavior from Task 1.

- [ ] **Step 1: Write failing SDK, resource isolation, and real-schema policy tests**

```js
it("does not treat the Pi SDK peer as optional", async () => {
  const pkg = JSON.parse(await readFile(packageJson, "utf8"));
  assert.equal(pkg.peerDependencies["@earendil-works/pi-coding-agent"], "*");
  assert.equal(pkg.peerDependenciesMeta?.["@earendil-works/pi-coding-agent"], undefined);
  const sdk = await loadPiSdk();
  assert.equal(typeof sdk.createAgentSession, "function");
});

it("disables ambient extensions and allowlists coding tools", async () => {
  const pi = fakePi();
  const run = createPiRunPrompt(pi);
  await run(message);
  assert.equal(pi.loaderOptions.noExtensions, true);
  assert.equal(pi.loaderOptions.noPromptTemplates, true);
  assert.deepEqual(pi.sessionOptions.tools, ["read", "grep", "find", "ls", "edit", "write", "bash"]);
});

it("confirms overwrite using the real write schema", async () => {
  await writeFile(join(folder, "exists.txt"), "old");
  const decision = await classifyToolCall("write", { path: "exists.txt", content: "new" }, { folder });
  assert.equal(decision.confirm, true);
});

it("allows a new in-workspace file and blocks path traversal", async () => {
  assert.equal((await classifyToolCall("write", { path: "new.txt", content: "x" }, { folder })).confirm, false);
  assert.equal((await classifyToolCall("read", { path: "../secret" }, { folder })).blocked, true);
});
```

Also assert `edit` always confirms, safe shell commands such as `pwd` and `git status --short` are automatic, `npm test`, `rm`, `chmod`, `git reset`, pipes, redirections, command substitution, and unknown shell forms confirm, and details redact the configured app secret.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{pi-session,tool-policy,assistant}.test.mjs
```

Expected: optional-peer assertion fails, loader options are missing, missing SDK is silently accepted, and real write overwrite is classified as safe.

- [ ] **Step 3: Implement the required runtime and policy**

Remove `peerDependenciesMeta` for Pi. Configure `DefaultResourceLoader` with `cwd`, `agentDir`, `noExtensions: true`, `noPromptTemplates: true`, and `noThemes: true`. Pass the explicit tool list to `createAgentSession`.

`classifyToolCall` must resolve tool paths against `folder`, verify existing ancestors with `realpath`, and use the real schemas. Shell automation uses a token-aware conservative predicate rather than a broad mutation-prone regex:

```js
function clearlyReadOnlyBash(command, folder) {
  if (/[|;&><`$()\\\n]/.test(command)) return false;
  const tokens = command.trim().split(/\s+/);
  if (tokens.some((token) => isPathOutsideFolder(token, folder))) return false;
  if (tokens.length === 1 && tokens[0] === "pwd") return true;
  if (tokens[0] === "ls" || tokens[0] === "grep") return true;
  if (tokens[0] === "rg") return !tokens.some((token) => token === "--pre" || token.startsWith("--pre="));
  if (tokens[0] !== "git") return false;
  if (!["status", "diff", "log", "show"].includes(tokens[1])) return false;
  return !tokens.some((token) => ["--ext-diff", "--textconv"].includes(token));
}
```

`find`, runtimes, package scripts, unknown flags/forms, shell metacharacters, and commands outside the workspace require confirmation. The wrapper returns a skipped tool result when blocked or denied. Assistant composition must create the runner before transport start and throw visibly if SDK resolution or session creation is unavailable.

- [ ] **Step 4: Run diagnostics and Package tests**

```bash
node --test packages/pi-im-feishu/test/{pi-session,tool-policy,assistant}.test.mjs
npm test --workspace @kedoupi/pi-im-feishu
```

Run LSP diagnostics on `src/pi-session.mjs`, `src/tool-policy.mjs`, and `src/assistant.mjs`; expected: no blocking diagnostics.

- [ ] **Step 5: Commit**

```bash
git add package-lock.json packages/pi-im-feishu/package.json \
  packages/pi-im-feishu/src/{assistant,important,pi-session,tool-policy}.mjs \
  packages/pi-im-feishu/test/{assistant,pi-session,tool-policy}.test.mjs
git commit -m "fix(feishu): require a real isolated Pi runtime"
```

---

### Task 3: Verified Bot Identity, Topic Replies, Confirmation, and Durable Delivery

**Files:**
- Modify: `packages/pi-im-feishu/src/live-bind.mjs`
- Modify: `packages/pi-im-feishu/src/bind.mjs`
- Modify: `packages/pi-im-feishu/src/store.mjs`
- Modify: `packages/pi-im-feishu/src/inbound.mjs`
- Modify: `packages/pi-im-feishu/src/confirm-wait.mjs`
- Modify: `packages/pi-im-feishu/src/router.mjs`
- Modify: `packages/pi-im-feishu/src/feishu-transport.mjs`
- Modify: `packages/pi-im-feishu/src/assistant.mjs`
- Test: `packages/pi-im-feishu/test/{bind,live-bind,store,inbound,confirm-wait,router,transport,assistant}.test.mjs`

**Interfaces:**
- Adds: binding field `botOpenId: string`; `loadCredentials()` returns it.
- Adds: inbound fields `senderOpenId`, `senderType`, `rootId`, and existing `messageId/threadId` normalization.
- Changes: `confirmWait.take(inbound): "confirmed" | "rejected" | null`.
- Adds: `store.claimDelivery(chatKey, messageId)`, `store.completeDelivery(...)`, and `store.releaseDelivery(...)` with bounded persistent records.
- Changes: `transport.send({ inbound, text?, files? })` replies to topic `inbound.messageId` with `reply_in_thread: true`.

- [ ] **Step 1: Write failing identity, requester, topic, and retry tests**

```js
it("rejects a group mention when bot identity is missing", () => {
  const inbound = parseInbound(groupEvent({ mentions: ["ou_someone"] }), {});
  assert.equal(inbound.mentioned, false);
});

it("records sender identity", () => {
  assert.equal(parseInbound(p2pEvent({ sender: "ou_requester" }), { botOpenId: "ou_bot" }).senderOpenId, "ou_requester");
});

it("does not consume another member's confirmation", async () => {
  const wait = createConfirmWait(send);
  const asked = wait.ask({ inbound: requesterInbound, kind: "bash", detail: "rm x" });
  assert.equal(wait.take({ ...requesterInbound, senderOpenId: "ou_other", text: "确认" }), null);
  assert.equal(wait.take({ ...requesterInbound, text: "确认" }), "confirmed");
  assert.equal(await asked, true);
});

it("replies inside a topic", async () => {
  await transport.send({ inbound: topicInbound, text: "done" });
  assert.deepEqual(replyCalls[0], {
    path: { message_id: topicInbound.messageId },
    data: { msg_type: "text", content: JSON.stringify({ text: "done" }), reply_in_thread: true }
  });
});

it("retries a delivery whose send failed", async () => {
  await assert.rejects(router.accept(event));
  sendSucceeds = true;
  assert.equal((await router.accept(event)).action, "work");
});
```

QR tests must assert that returned credentials are verified and store the same `botOpenId` as manual setup. Durable delivery tests must assert concurrent duplicate accepts execute work once and completed records are bounded.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{bind,live-bind,store,inbound,confirm-wait,router,transport,assistant}.test.mjs
```

Expected: absent bot identity accepts any mention; inbound lacks sender; another member consumes confirmation; topic calls `message.create`; failed sends remain permanently in the in-memory seen set.

- [ ] **Step 3: Implement identity, confirmation, transport, and delivery states**

`verifyFeishuApp` must reject missing `bot.open_id`. Both bind paths verify before replacing credentials and call:

```js
store.bindBot({ appId, appSecret, domain, boundVia, botOpenId: verified.bot.open_id });
```

Confirmation matching requires same key, sender open id, exact phrase, expiry, and `mentioned === true` for group/topic. Router filtering precedes confirmation consumption. Delivery records use `in-progress` and `complete`; only successful send marks complete, while catch/finally releases failed attempts. Topic text and files use `client.im.v1.message.reply`; images use `client.im.v1.image.create`, not `file.create` with an image type. Transport exposes `onDisconnect` and clears readiness on every WS error/close callback supported by the SDK adapter.

- [ ] **Step 4: Run focused and complete tests**

```bash
node --test packages/pi-im-feishu/test/{bind,live-bind,store,inbound,confirm-wait,router,transport,assistant}.test.mjs
npm test --workspace @kedoupi/pi-im-feishu
```

Expected: all pass and no test relies on an in-memory `seen` set.

- [ ] **Step 5: Commit**

```bash
git add packages/pi-im-feishu/src/{assistant,bind,confirm-wait,feishu-transport,inbound,live-bind,router,store}.mjs \
  packages/pi-im-feishu/test/{assistant,bind,confirm-wait,inbound,live-bind,router,store,transport}.test.mjs
git commit -m "fix(feishu): bind routing to verified identities"
```

---

### Task 4: Deterministic Work Queue and Session Lifecycle

**Files:**
- Modify: `packages/pi-im-feishu/src/commands.mjs`
- Modify: `packages/pi-im-feishu/src/work.mjs`
- Modify: `packages/pi-im-feishu/src/pi-session.mjs`
- Modify: `packages/pi-im-feishu/src/router.mjs`
- Test: `packages/pi-im-feishu/test/commands.test.mjs`
- Test: `packages/pi-im-feishu/test/work.test.mjs`
- Test: `packages/pi-im-feishu/test/pi-session.test.mjs`
- Test: `packages/pi-im-feishu/test/router.test.mjs`

**Interfaces:**
- Changes: `createWork({ runPrompt, confirm })` returns `work`, `abort(key)`, `release(key)`, and `dispose()`.
- Requires: `runPrompt.release(key): Promise<{ sessionFile: string | null }>` and `runPrompt.dispose()`.
- Command results include `sessionAction: "new" | "folder" | "previous"` when runner disposal is required; this implements the product's new conversation, folder-change, and previous-conversation lifecycle.

- [ ] **Step 1: Write failing stop, queue, new, folder, and previous tests**

```js
it("stop aborts the running job and cancels the queued job", async () => {
  const first = worker.work(job("first"));
  const second = worker.work(job("second"));
  const stopped = await worker.work(commandJob("/stop"));
  assert.equal(stopped.stopped, true);
  assert.equal((await first).stopped, true);
  assert.equal((await second).stopped, true);
  assert.deepEqual(startedPrompts, ["first"]);
});

it("new disposes the cached session before the next prompt", async () => {
  await run(message({ sessionFile: oldFile }));
  await runner.release("p2p:a");
  await run(message({ sessionFile: null }));
  assert.equal(openedFiles.at(-1), null);
  assert.equal(disposed, 1);
});

it("folder change archives the old session and starts in the new cwd", async () => {
  const result = await worker.work(commandJob("换文件夹 /tmp/new", chatWithSession));
  assert.equal(result.patch.sessionFile, null);
  assert.equal(result.patch.archives[0].sessionFile, oldFile);
  assert.equal(result.patch.folder, "/tmp/new");
  assert.deepEqual(releasedKeys, ["group:a"]);
});
```

Add a previous-session cwd mismatch test that refuses to open an archive whose JSONL header cwd differs from the current folder.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{commands,work,pi-session,router}.test.mjs
```

Expected: queued controller replaces the running controller; queued prompt starts; null session file reuses the old cache; folder change keeps the old session active.

- [ ] **Step 3: Implement lane generations and explicit session release**

Each chat lane stores `{ tail, generation, activeController }`. Jobs capture the generation and install their AbortController only when execution begins. `/stop` increments generation, aborts `activeController`, and makes queued generations return stopped without invoking the runner.

Run lifecycle commands through the lane. Before returning a `new`, `folder`, or selected `previous` patch, call `runPrompt.release(key)`. `new` and folder changes archive the old session and set `sessionFile: null`. Previous validates the session cwd before switching. `createPiRunPrompt.sessionFor` compares requested session files exactly and `release(key)` disposes and removes one pool entry.

- [ ] **Step 4: Run focused, race-repeat, and Package tests**

```bash
node --test packages/pi-im-feishu/test/{commands,work,pi-session,router}.test.mjs
for i in 1 2 3 4 5; do node --test packages/pi-im-feishu/test/work.test.mjs >/dev/null; done
npm test --workspace @kedoupi/pi-im-feishu
```

Expected: every run passes without unhandled rejections.

- [ ] **Step 5: Commit**

```bash
git add packages/pi-im-feishu/src/{commands,pi-session,router,work}.mjs \
  packages/pi-im-feishu/test/{commands,pi-session,router,work}.test.mjs
git commit -m "fix(feishu): make chat sessions deterministic"
```

---

### Task 5: Cross-Process Attach Ownership

**Files:**
- Replace: `packages/pi-im-feishu/src/ownership.mjs`
- Modify: `packages/pi-im-feishu/src/store.mjs`
- Modify: `packages/pi-im-feishu/src/assistant.mjs`
- Modify: `packages/pi-im-feishu/src/assistant-control.mjs`
- Modify: `packages/pi-im-feishu/src/tui.mjs`
- Modify: `packages/pi-im-feishu/extensions/index.ts`
- Test: `packages/pi-im-feishu/test/assistant.test.mjs`
- Create: `packages/pi-im-feishu/test/ownership.test.mjs`
- Create: `packages/pi-im-feishu/test/ownership-process.test.mjs`
- Modify: `packages/pi-im-feishu/test/extension.test.mjs`

**Interfaces:**
- Produces: `createOwnershipCoordinator({ store, runner, worker, pid?, isAlive?, now? })` with `requestWindow`, `serveRequests`, `heartbeatWindow`, `releaseWindow`, `canAssistantWrite`, and `close`.
- Adds store methods: `requestOwnership(key, request)`, `readOwnership(key)`, `updateOwnership(key, updater)`, and `findChatBySession(sessionFile)`.
- Adds control methods: `attach(key, cwd, windowPid)` and `heartbeatWindow(key, requestId, windowPid)`.
- Consumes: Task 4 `worker.release(key)` and `runner.release(key)`.

- [ ] **Step 1: Write failing handoff, paused-write, release, and stale-window tests**

```js
it("grants the window only after the assistant releases the session", async () => {
  const request = await window.requestWindow("p2p:a", { pid: 4101 });
  assert.equal((await store.readOwnership("p2p:a")).state, "requested");
  await assistant.serveRequests();
  assert.deepEqual(calls, ["worker.release:p2p:a", "runner.release:p2p:a"]);
  assert.equal((await store.readOwnership("p2p:a")).owner, "window");
  assert.equal((await store.readOwnership("p2p:a")).requestId, request.requestId);
});

it("pauses Feishu work while the window lease is live", async () => {
  await grantLiveWindowLease();
  assert.equal(await assistant.canAssistantWrite("p2p:a"), false);
});

it("reclaims only a dead stale window", async () => {
  await staleWindowLease({ pid: 4201 });
  assert.equal(await aliveCoordinator.canAssistantWrite("p2p:a"), false);
  assert.equal(await deadCoordinator.canAssistantWrite("p2p:a"), true);
});
```

The process test launches an assistant coordinator and a window coordinator against the same home, waits for ownership transfer, and asserts their recorded write intervals never overlap.

Extension tests must assert `ctx.switchSession(sessionFile)` is called only after a grant, `session_start` heartbeats the matching lease, and `session_shutdown` releases it.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{ownership,ownership-process,assistant,extension}.test.mjs
```

Expected: in-memory ownership is invisible across processes; attach never switches; session shutdown does not release ownership.

- [ ] **Step 3: Implement persistent lease coordination**

Persist `{ owner, state, pid, requestId, sessionFile, heartbeatAt }` under the chat record. Window attach validates chat, folder, cwd, and existing session file, writes `requested`, and waits a bounded interval. The assistant poll calls `worker.release(key)`, calls `runner.release(key)`, persists the latest session file, and grants the exact request id. The extension then calls `ctx.switchSession`.

Start ownership timers only in `runAssistant` and `session_start`, never during extension factory evaluation. `session_shutdown` clears the timer and releases the lease. Reclaim only when heartbeat is stale and `pidIsAlive(pid)` is false. Incoming Feishu work while a window lease is live returns the approved paused message.

- [ ] **Step 4: Run focused, process-repeat, and Package tests**

```bash
node --test packages/pi-im-feishu/test/{ownership,ownership-process,assistant,extension}.test.mjs
for i in 1 2 3; do node --test packages/pi-im-feishu/test/ownership-process.test.mjs >/dev/null; done
npm test --workspace @kedoupi/pi-im-feishu
```

Expected: all pass and test teardown leaves no interval or lock handle.

- [ ] **Step 5: Commit**

```bash
git add packages/pi-im-feishu/extensions/index.ts \
  packages/pi-im-feishu/src/{assistant,assistant-control,ownership,store,tui}.mjs \
  packages/pi-im-feishu/test/{assistant,extension,ownership,ownership-process}.test.mjs
git commit -m "feat(feishu): hand sessions safely to Pi windows"
```

---

### Task 6: Collision-Safe Inbound and Controlled Outbound Files

**Files:**
- Modify: `packages/pi-im-feishu/src/files.mjs`
- Modify: `packages/pi-im-feishu/src/pi-session.mjs`
- Modify: `packages/pi-im-feishu/src/router.mjs`
- Modify: `packages/pi-im-feishu/src/feishu-transport.mjs`
- Modify: `packages/pi-im-feishu/src/assistant.mjs`
- Test: `packages/pi-im-feishu/test/files.test.mjs`
- Test: `packages/pi-im-feishu/test/pi-session.test.mjs`
- Test: `packages/pi-im-feishu/test/router.test.mjs`
- Test: `packages/pi-im-feishu/test/transport.test.mjs`

**Interfaces:**
- Changes: `stageInboundFiles(folder, messageId, files, { download })` returns staged records below `.pi-im-feishu/inbox/<messageId>/`.
- Adds: `validateOutboundFile(folder, path): Promise<{ path, kind }>`.
- Adds runner result field: `files: Array<{ path: string, kind: "image" | "file" }>`.
- Adds custom tool: `send_feishu_file({ path })` bound to the current run's requester and workspace.

- [ ] **Step 1: Write failing collision, traversal, custom-tool, and API tests**

```js
it("stages same-named inbound files without overwriting project files", async () => {
  await writeFile(join(folder, "report.txt"), "project");
  const [saved] = await stageInboundFiles(folder, "om_123", [{ key: "k", name: "report.txt" }], {
    download: async () => Buffer.from("inbound")
  });
  assert.equal(saved.path, join(folder, ".pi-im-feishu", "inbox", "om_123", "report.txt"));
  assert.equal(await readFile(join(folder, "report.txt"), "utf8"), "project");
});

it("queues an in-workspace file only after requester confirmation", async () => {
  const result = await callSendFileTool({ path: join(folder, "out.txt") });
  assert.equal(confirmCalls.length, 1);
  assert.deepEqual(result.files, [{ path: join(folder, "out.txt"), kind: "file" }]);
});

it("uploads images through image.create", async () => {
  await transport.send({ inbound, files: [{ path: imagePath, kind: "image" }] });
  assert.equal(imageCreateCalls.length, 1);
  assert.equal(fileCreateCalls.length, 0);
});
```

Also test sanitized message-id and filename traversal, missing/empty downloads, symlink escape, denied confirmation, missing/non-regular outbound path, and topic file reply.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{files,pi-session,router,transport}.test.mjs
```

Expected: inbound overwrites the root file, no custom outbound tool exists, and images use `file.create`.

- [ ] **Step 3: Implement the two file flows**

Create the inbox path from sanitized `messageId` and `basename(file.name)`, use exclusive or atomic file creation, and include staged paths in the prompt text. The custom tool uses a per-session mutable run context set immediately before `session.prompt` and cleared in `finally`; it validates a regular file inside the workspace, calls requester confirmation, and appends to only that run's file list.

Transport uploads images with `client.im.v1.image.create({ data: { image: bytes } })`, files with `file.create`, and sends/replies with the returned key. It preserves topic reply context from `inbound`.

- [ ] **Step 4: Run focused and complete tests**

```bash
node --test packages/pi-im-feishu/test/{files,pi-session,router,transport}.test.mjs
npm test --workspace @kedoupi/pi-im-feishu
```

Expected: all pass and no generated inbox fixture remains in the repository.

- [ ] **Step 5: Commit**

```bash
git add packages/pi-im-feishu/src/{assistant,feishu-transport,files,pi-session,router}.mjs \
  packages/pi-im-feishu/test/{files,pi-session,router,transport}.test.mjs
git commit -m "feat(feishu): complete controlled file transfer"
```

---

### Task 7: Truthful TUI, Rebinding, Stop, and Autostart

**Files:**
- Modify: `packages/pi-im-feishu/src/tui.mjs`
- Modify: `packages/pi-im-feishu/src/bind.mjs`
- Modify: `packages/pi-im-feishu/src/assistant-control.mjs`
- Modify: `packages/pi-im-feishu/src/autostart.mjs`
- Modify: `packages/pi-im-feishu/src/macos-autostart.mjs`
- Modify: `packages/pi-im-feishu/src/store.mjs`
- Modify: `packages/pi-im-feishu/extensions/index.ts`
- Test: `packages/pi-im-feishu/test/extension.test.mjs`
- Test: `packages/pi-im-feishu/test/bind.test.mjs`
- Test: `packages/pi-im-feishu/test/assistant.test.mjs`
- Test: `packages/pi-im-feishu/test/autostart.test.mjs`

**Interfaces:**
- Adds: `maskedInput(ctx, title): Promise<string | null>` implemented with `ctx.ui.custom` and no new TUI dependency.
- Changes: `control.start({ timeoutMs? })`, `control.stop()`, and `control.rebind(candidate)` return explicit status plus `autostart` and `lastError` information.
- Adds store field: `lastError: { code, message, at } | null` without secret-bearing stacks or input.

- [ ] **Step 1: Write failing no-UI, secret-history, rebind, and stop-failure tests**

```js
it("does not set up or spawn outside TUI mode", async () => {
  await command.handler("setup qr", context({ mode: "json", hasUI: false }));
  assert.equal(registerCalls, 0);
  assert.equal(spawnCalls, 0);
});

it("manual setup obtains the secret from masked input", async () => {
  await command.handler("setup manual cli_123 feishu", tuiContext({ maskedValue: "secret-value" }));
  assert.equal(bindCalls[0].appSecret, "secret-value");
  assert.equal(notifications.join("\n").includes("secret-value"), false);
});

it("kills the assistant even when autostart disable fails", async () => {
  autostart.disable = async () => { throw new Error("launchctl failed"); };
  const result = await control.stop();
  assert.equal(killCalls.length, 1);
  assert.equal(result.stopped, true);
  assert.equal(result.autostart.enabled, true);
  assert.match(result.lastError.message, /launchctl/);
});

it("rebinds by stopping the old connection before starting the verified one", async () => {
  await control.rebind(candidate);
  assert.deepEqual(order, ["verify-new", "stop-old", "write-new", "start-new"]);
});
```

Add tests for unsupported autostart, checked non-zero launchctl statuses, `stopped` startup refusal, status values `unbound|starting|online|offline`, full topic folder keys, and attach calling `ctx.switchSession`.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{extension,bind,assistant,autostart}.test.mjs
```

Expected: print/JSON setup acts, manual command contains the secret, autostart failure prevents kill, launchctl failures are swallowed, and rebind does not restart the old process.

- [ ] **Step 3: Implement the truthful control flow**

Guard all interactive/process commands with `ctx.hasUI && ctx.mode === "tui"`. Implement a minimal custom masked component whose `render()` displays bullets, `handleInput()` supports printable input/backspace/enter/escape, and never returns the secret through notifications or logs. Parse manual setup as `/feishu setup manual <appId> [feishu|lark]` and collect only the secret interactively.

`stop()` sets stopped, attempts autostart disable while recording any error, and always continues to SIGTERM/SIGKILL cleanup. launchd adapters inspect command exit status and throw on failed required actions. Snapshot combines config and live lock into the four approved states and exposes a sanitized durable last error. Folder commands accept a complete chat key so topics remain distinct.

- [ ] **Step 4: Run focused and complete tests**

```bash
node --test packages/pi-im-feishu/test/{extension,bind,assistant,autostart}.test.mjs
npm test --workspace @kedoupi/pi-im-feishu
```

Expected: all pass and process-handle detection reports no leaked child/timer.

- [ ] **Step 5: Commit**

```bash
git add packages/pi-im-feishu/extensions/index.ts \
  packages/pi-im-feishu/src/{assistant-control,autostart,bind,macos-autostart,store,tui}.mjs \
  packages/pi-im-feishu/test/{assistant,autostart,bind,extension}.test.mjs
git commit -m "fix(feishu): make local control truthful"
```

---

### Task 8: Installed-Package Smoke, Strict Checks, and Truthful Documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/pi-im-feishu/package.json`
- Create: `packages/pi-im-feishu/tsconfig.json`
- Modify: `packages/pi-im-feishu/extensions/index.ts`
- Create: `packages/pi-im-feishu/test/installed-package.test.mjs`
- Create: `packages/pi-im-feishu/test/assistant-process.test.mjs`
- Modify: `packages/pi-im-feishu/README.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/development.md`
- Modify: `docs/publishing.md`
- Modify: `docs/pi-im-feishu/README.md`
- Modify: `docs/pi-im-feishu/prd.md`
- Modify: `docs/pi-im-feishu/technical.md`
- Modify: `docs/pi-im-feishu/plan.md`
- Modify: `docs/pi-im-feishu/open-questions.md`

**Interfaces:**
- Adds Package scripts: `check`, `typecheck`, and existing `test`.
- Root `npm run check` invokes workspace checks through `npm run check --workspaces --if-present`.
- Installed smoke uses only the generated tarball and locally resolved Pi peer; it performs no network request.

- [ ] **Step 1: Write failing process and tarball smoke tests**

```js
it("resolves the real Pi SDK from an installed tarball layout", async () => {
  const installed = await installPackedFixture({ packageDir, peerDir: resolvedPiPeer });
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const mod = await import(${JSON.stringify(pathToFileURL(join(installed, "src/pi-session.mjs")).href)});
    const sdk = await mod.loadPiSdk();
    console.log(typeof sdk.createAgentSession);
  `], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "function");
});

it("assistant process remains offline when runner creation fails", async () => {
  const child = await spawnAssistantFixture({ failRunner: true });
  assert.notEqual(child.exitCode, 0);
  assert.equal(await createLock(child.home).read(), null);
});

it("assistant disconnect removes online presence", async () => {
  const child = await spawnAssistantFixture({ disconnectAfterReady: true });
  await child.ready;
  await child.disconnected;
  assert.notEqual((await createLock(child.home).read())?.status, "online");
});
```

Add installed fixture assertions for manifest files, extension loading without socket startup, print/JSON command no-op, start/stop, state preservation across replacement with the previous tarball, and removal without deleting machine state.

- [ ] **Step 2: Run the new smoke tests and verify failures**

```bash
node --test packages/pi-im-feishu/test/{installed-package,assistant-process}.test.mjs
```

Expected: at least the installed peer/runtime, truthful disconnect, or print/JSON assertions fail before final wiring.

- [ ] **Step 3: Add strict checks and finish integration wiring**

Add exact workspace-root development dependencies `typescript@5.9.3` and `@types/node@24.13.3`. Configure `tsconfig.json` with `strict: true`, `noEmit: true`, NodeNext module resolution, and the extension entry as its include. Annotate the extension factory with the exported Pi `ExtensionAPI` type. Package `check` runs TypeScript plus `node --check` for each `.mjs` source/bin file. Root check invokes Package checks.

The installed test packs once, extracts into a temporary `node_modules/@kedoupi/pi-im-feishu`, symlinks the locally resolved Pi peer, and never calls `npm install` or the network. Finish any assistant lifecycle wiring needed for process tests.

- [ ] **Step 4: Update canonical documentation with verified behavior**

Document exact commands and the established workflow:

```text
project-local source load
→ temporary-home automated smoke
→ disposable real Feishu app test
→ global local-source dogfood
→ publishing proposal only after evidence
```

Update all P0-P3 checkboxes from test evidence. State that automated tests use injected Feishu boundaries and do not prove real Feishu connectivity. Document requester confirmation, full topic key syntax, cross-process attach, inbox path, `send_feishu_file`, no-UI behavior, launchd limitations, state paths, stop/rebind recovery, remote-control risk, model cost, and rollback. Remove every claim that exceeds the final implementation.

- [ ] **Step 5: Run complete diagnostics and repository gates**

```bash
npm run check
npm test
npm run pack:check
git diff --check
```

Then run LSP diagnostics on `packages/pi-im-feishu/` and `docs/pi-im-feishu/`; expected: zero blocking diagnostics. Inspect `npm pack --json` output and assert no test, secret, `.pi`, private path, or development artifact enters the tarball.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json README.md README.zh-CN.md \
  docs/development.md docs/publishing.md docs/pi-im-feishu \
  packages/pi-im-feishu
git commit -m "test(feishu): prove the local dogfood package"
```

---

### Task 9: Independent Review and Final Local-Dogfood Gate

**Files:**
- Modify only files required by substantiated review findings.
- Record evidence in the final delivery response; do not commit private machine inventory or credentials.

**Interfaces:**
- Consumes: all Task 1-8 behavior and tests.
- Produces: a reviewed, clean branch with no blocking findings and a precise maintainer local-test checklist.

- [ ] **Step 1: Request independent requirements and code-quality review**

Give reviewers the spec, this plan, baseline findings, and branch diff. Require findings with file/line evidence for correctness, security, race conditions, Feishu API shape, Pi SDK wiring, test realism, and documentation truthfulness. A prose concern without source evidence is investigated but not blindly applied.

- [ ] **Step 2: Reproduce each blocking finding with the smallest failing test**

For every accepted finding, add one focused regression test that fails on the reviewed branch. Reject findings contradicted by source/API evidence and record the evidence in the delivery summary.

- [ ] **Step 3: Apply minimal fixes and rerun focused tests**

Change the shared root-cause function rather than patching individual callers. Run each new regression test until green, then run the complete Package suite.

- [ ] **Step 4: Run final clean-room gates**

From the feature worktree:

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
git diff --check
git status --short
```

Repeat race-sensitive process tests three times. Run `lens_diagnostics mode=all` and Package-wide LSP diagnostics. Expected: all commands exit `0`, no blocking diagnostics, and no uncommitted files.

- [ ] **Step 5: Perform local no-credential acceptance**

Using a fresh temporary `PI_IM_FEISHU_HOME`, verify:

- extension load has no socket side effect;
- print/JSON setup does not spawn or prompt;
- missing credentials produce `unbound`;
- missing/invalid SDK never produces online;
- fake ready/disconnect updates presence truthfully;
- source and packed layouts both resolve the same SDK contract;
- stop, stale lock, ownership handoff, and state preservation complete without leaked processes.

Do not enter real credentials. Produce the real-credential checklist for the maintainer covering QR/manual setup, private chat, group mention, topic reply, confirmation identity, new/folder/previous/stop, attach/release, files, login restart, stop, rebind, update, uninstall, and rollback.

- [ ] **Step 6: Commit accepted review fixes, if any**

```bash
git add -u
git add packages/pi-im-feishu/test docs/pi-im-feishu
git commit -m "fix(feishu): address hardening review"
```

If no fixes are needed, do not create an empty commit.
