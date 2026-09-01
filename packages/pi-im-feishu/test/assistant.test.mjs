import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runAssistant } from "../src/assistant.mjs";
import { createAssistantControl } from "../src/assistant-control.mjs";
import { createAutostart } from "../src/autostart.mjs";
import { createLock } from "../src/lock.mjs";
import { createOwnershipCoordinator } from "../src/ownership.mjs";
import { createStore } from "../src/store.mjs";

function fakeTransport({ ready = true } = {}) {
  const sent = [];
  return {
    sent,
    started: false,
    stopped: false,
    isReady: () => ready,
    async start() {
      this.started = true;
    },
    async stop() {
      this.stopped = true;
    },
    async send(payload) {
      sent.push(payload);
    },
  };
}

test("stopped configuration refuses assistant startup before locking or transport", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-stopped-"));
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  await store.setStopped(true);
  const transport = fakeTransport();
  await assert.rejects(
    () =>
      runAssistant({
        home,
        store,
        transport,
        runPrompt: async () => ({ text: "unused" }),
        handleSignals: false,
      }),
    (error) => error.code === "stopped",
  );
  assert.equal(transport.started, false);
  assert.equal(await createLock(home).read(), null);
});

test("WS not ready must not become online", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-ws-"));
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  await assert.rejects(
    () =>
      runAssistant({
        home,
        store,
        transport: fakeTransport({ ready: false }),
        runPrompt: async () => ({ text: "unused" }),
        handleSignals: false,
      }),
    (error) => error.code === "ws-not-ready",
  );
});

test("ready transport is online and routes inbound", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-on-"));
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
    botOpenId: "ou_bot",
  });
  const transport = fakeTransport();
  const runtime = await runAssistant({
    home,
    store,
    transport,
    runPrompt: async () => ({ text: "unused" }),
    handleSignals: false,
  });
  const result = await runtime.router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: "om_live",
      chat_id: "oc_dm",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text: "在吗" }),
    },
  });
  assert.equal(result.action, "need-folder");
  assert.equal(transport.sent.length, 1);
  const wrongMention = await runtime.router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: "om_group",
      chat_id: "oc_group",
      chat_type: "group",
      message_type: "text",
      mentions: [{ key: "@_other", id: { open_id: "ou_other" } }],
      content: JSON.stringify({ text: "@_other 在吗" }),
    },
  });
  assert.equal(wrongMention.action, "filtered");
  await runtime.shutdown();
  assert.equal(transport.stopped, true);
});

test("stages inbound files and lists their paths in the current prompt", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-inbound-home-"));
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-inbound-work-"));
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  await store.bindFolder("p2p:oc_dm", folder);
  const prompts = [];
  const runtime = await runAssistant({
    home,
    store,
    transport: fakeTransport(),
    download: async () => Buffer.from("inbound"),
    runPrompt: async (payload) => {
      prompts.push(payload.text);
      return { text: "done", sessionFile: null };
    },
    handleSignals: false,
  });
  await runtime.router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: "om_file",
      chat_id: "oc_dm",
      chat_type: "p2p",
      message_type: "file",
      content: JSON.stringify({ file_key: "fk", file_name: "../report.txt" }),
    },
  });
  const staged = join(
    folder,
    ".pi-im-feishu",
    "inbox",
    "om_file",
    "report.txt",
  );
  assert.match(prompts[0], /收到的文件：/);
  assert.ok(prompts[0].includes(staged));
  assert.equal(await readFile(staged, "utf8"), "inbound");
  await runtime.shutdown();
});

test("start requires binding; stop disables autostart; shutdown does not stop assistant", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-ctl-"));
  let enabled = true;
  const autostart = createAutostart({
    install: async () => {
      enabled = true;
    },
    uninstall: async () => {
      enabled = false;
    },
  });
  const control = createAssistantControl(home, {
    autostart,
    runner: async ({ store, lock }) => {
      const transport = fakeTransport();
      return runAssistant({
        home,
        store,
        lock,
        transport,
        runPrompt: async () => ({ text: "unused" }),
        handleSignals: false,
      });
    },
  });
  await assert.rejects(
    () => control.start(),
    (error) => error.code === "not-configured",
  );
  await control.store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  await control.start();
  assert.equal((await control.snapshot()).presence, "online");
  assert.equal(enabled, true);
  await control.stop();
  assert.equal(enabled, false);
  assert.equal((await control.snapshot()).presence, "offline");
});

test("SDK startup failure is visible and releases the process lock before transport start", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-sdk-"));
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  const transport = fakeTransport();
  await assert.rejects(
    () =>
      runAssistant({
        home,
        store,
        transport,
        loadSdk: async () => {
          throw Object.assign(new Error("Pi SDK missing"), {
            code: "pi-sdk-missing",
          });
        },
        handleSignals: false,
      }),
    (error) => error.code === "pi-sdk-missing",
  );
  assert.equal(transport.started, false);
  assert.equal(await createLock(home).read(), null);
});

test("stop kills the assistant even when autostart disable fails", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-stop-failure-"));
  const store = createStore(home);
  const owner = { pid: 4242, status: "online" };
  const killCalls = [];
  const lock = {
    async read() {
      return owner.status ? owner : null;
    },
    async release() {
      owner.status = null;
      return null;
    },
  };
  const control = createAssistantControl(home, {
    store,
    lock,
    autostart: {
      async disable() {
        throw new Error("launchctl failed");
      },
    },
    processKill(pid, signal) {
      killCalls.push([pid, signal]);
      owner.status = null;
    },
  });
  const result = await control.stop();
  assert.deepEqual(killCalls, [[4242, "SIGTERM"]]);
  assert.equal(result.stopped, true);
  assert.equal(result.autostart.enabled, true);
  assert.match(result.lastError.message, /launchctl failed/);
  assert.equal((await store.status()).lastError.message, "launchctl failed");
});

test("snapshot reports unbound, starting, online, and offline with lastError", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-status-"));
  const store = createStore(home);
  let owner = null;
  const control = createAssistantControl(home, {
    store,
    lock: { async read() { return owner; } },
    autostart: createAutostart(),
  });
  assert.equal((await control.snapshot()).presence, "unbound");
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  assert.equal((await control.snapshot()).presence, "offline");
  owner = { pid: 1, status: "starting" };
  assert.equal((await control.snapshot()).presence, "starting");
  owner = { pid: 1, status: "online" };
  assert.equal((await control.snapshot()).presence, "online");
  await store.setLastError({ code: "launchctl", message: "bootstrap failed" });
  const snapshot = await control.snapshot();
  assert.deepEqual(
    { code: snapshot.lastError.code, message: snapshot.lastError.message },
    { code: "launchctl", message: "bootstrap failed" },
  );
  assert.equal(typeof snapshot.lastError.at, "string");
});

test("rebind verifies, stops, writes, and starts in order", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-rebind-"));
  const store = createStore(home);
  await store.bindBot({
    appId: "cli_oldabcdefghijkl",
    appSecret: "old-secret-value",
    botOpenId: "ou_old",
  });
  const order = [];
  const binding = {
    async verify(candidate) {
      order.push("verify-new");
      return { ...candidate, boundVia: "manual", botOpenId: "ou_new" };
    },
    async writeVerified(candidate) {
      order.push("write-new");
      return store.bindBot(candidate);
    },
  };
  const autostart = createAutostart({
    install: async () => {},
    uninstall: async () => order.push("stop-old"),
  });
  const control = createAssistantControl(home, {
    store,
    bind: binding,
    autostart,
    runner: async ({ lock }) => {
      order.push("start-new");
      await lock.acquire({ appId: "cli_newabcdefghijkl" });
      await lock.heartbeat("online");
      return { shutdown: () => lock.release() };
    },
  });
  const result = await control.rebind({
    appId: "cli_newabcdefghijkl",
    appSecret: "new-secret-value",
    domain: "feishu",
  });
  assert.deepEqual(order, [
    "verify-new",
    "stop-old",
    "write-new",
    "start-new",
  ]);
  assert.equal(result.status, "online");
  assert.equal((await store.loadCredentials()).botOpenId, "ou_new");
  await control.stop();
});

test("attach timeout reclaims a request while the assistant is still releasing", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-attach-timeout-"));
  const sessionFile = join(home, "session.jsonl");
  await writeFile(sessionFile, "{}\n");
  const control = createAssistantControl(home, {
    autostart: createAutostart(),
  });
  await control.store.upsertChat("p2p:a", {
    folder: home,
    sessionFile,
  });

  let beginRelease;
  const releaseStarted = new Promise((resolve) => {
    beginRelease = resolve;
  });
  let finishRelease;
  const releaseFinished = new Promise((resolve) => {
    finishRelease = resolve;
  });
  const assistant = createOwnershipCoordinator({
    store: control.store,
    worker: {
      async release() {
        beginRelease();
        await releaseFinished;
      },
    },
    runner: {
      async release() {
        return { sessionFile };
      },
    },
    pid: 4001,
  });

  const attaching = control.attach("p2p:a", home, 4101);
  while ((await control.store.readOwnership("p2p:a"))?.state !== "requested") {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const serving = assistant.serveRequests();
  await releaseStarted;

  try {
    const result = await attaching;
    assert.equal(result.code, "ownership-timeout");
    const lease = await control.store.readOwnership("p2p:a");
    assert.deepEqual(
      { owner: lease.owner, state: lease.state },
      { owner: "assistant", state: "owned" },
    );
  } finally {
    finishRelease();
    await serving;
  }

  assert.equal((await control.store.readOwnership("p2p:a")).owner, "assistant");
  await assistant.requestWindow("p2p:a", { pid: 4102 });
  assert.equal((await control.store.readOwnership("p2p:a")).state, "requested");
});

test("attach validates the session and waits for the assistant grant", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-attach-"));
  const sessionFile = join(home, "session.jsonl");
  await writeFile(sessionFile, "{}\n");
  const control = createAssistantControl(home, {
    autostart: createAutostart(),
    runner: async ({ store, lock }) =>
      runAssistant({
        home,
        store,
        lock,
        transport: fakeTransport(),
        runPrompt: Object.assign(async () => ({ text: "unused" }), {
          release: async () => ({ sessionFile }),
          dispose: async () => {},
        }),
        handleSignals: false,
      }),
  });
  await control.store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  await control.store.upsertChat("p2p:a", {
    title: "张三",
    folder: home,
    sessionFile,
  });
  assert.equal(
    (await control.attach("p2p:missing", home)).code,
    "unknown-chat",
  );

  await control.start();
  const result = await control.attach("p2p:a", home, process.pid);
  assert.equal(result.ok, true);
  assert.equal(result.sessionFile, sessionFile);
  assert.equal((await control.store.readOwnership("p2p:a")).owner, "window");
  await control.releaseWindow(
    "p2p:a",
    result.requestId,
    process.pid,
    sessionFile,
  );
  await control.stop();
});
