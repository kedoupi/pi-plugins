import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runAssistant } from "../src/assistant.mjs";
import { createAssistantControl } from "../src/assistant-control.mjs";
import { createAutostart } from "../src/autostart.mjs";
import { attachWithOwnership } from "../src/ownership.mjs";
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
    }
  };
}

test("WS not ready must not become online", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-ws-"));
  const store = createStore(home);
  await store.bindBot({ appId: "cli_abcdefghijklmn", appSecret: "super-secret-value" });
  await assert.rejects(
    () => runAssistant({ home, store, transport: fakeTransport({ ready: false }), handleSignals: false }),
    (error) => error.code === "ws-not-ready"
  );
});

test("ready transport is online and routes inbound", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-on-"));
  const store = createStore(home);
  await store.bindBot({ appId: "cli_abcdefghijklmn", appSecret: "super-secret-value" });
  const transport = fakeTransport();
  const runtime = await runAssistant({ home, store, transport, handleSignals: false });
  const result = await runtime.router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: "om_live",
      chat_id: "oc_dm",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text: "在吗" })
    }
  });
  assert.equal(result.action, "need-folder");
  assert.equal(transport.sent.length, 1);
  await runtime.shutdown();
  assert.equal(transport.stopped, true);
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
    }
  });
  const control = createAssistantControl(home, {
    autostart,
    runner: async ({ store, lock }) => {
      const transport = fakeTransport();
      return runAssistant({ home, store, lock, transport, handleSignals: false });
    }
  });
  await assert.rejects(() => control.start(), (error) => error.code === "not-configured");
  await control.store.bindBot({ appId: "cli_abcdefghijklmn", appSecret: "super-secret-value" });
  await control.start();
  assert.equal((await control.snapshot()).presence, "online");
  assert.equal(enabled, true);
  await control.stop();
  assert.equal(enabled, false);
  assert.equal((await control.snapshot()).presence, "offline");
});

test("attach pauses assistant writes when folders match", () => {
  const ownership = { released: false, releaseToWindow() { this.released = true; } };
  assert.equal(attachWithOwnership(undefined, "/tmp/a").code, "unknown-chat");
  const ok = attachWithOwnership({
    key: "p2p:a",
    title: "张三",
    folder: "/tmp/a",
    sessionFile: "/tmp/a.jsonl"
  }, "/tmp/a", ownership);
  assert.equal(ok.ok, true);
  assert.equal(ownership.released, true);
  assert.match(ok.message, /暂停写入/);
});
