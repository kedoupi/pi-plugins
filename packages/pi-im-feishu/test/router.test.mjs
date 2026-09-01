import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRouter } from "../src/router.mjs";
import { createStore } from "../src/store.mjs";
import { createWork } from "../src/work.mjs";

function event({
  chatType = "p2p",
  chatId = "oc_dm",
  text = "hi",
  mentions,
  messageId = "om_1",
  rootId,
  threadId,
}) {
  return {
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: messageId,
      chat_id: chatId,
      chat_type: chatType,
      message_type: "text",
      mentions,
      root_id: rootId,
      thread_id: threadId,
      content: JSON.stringify({ text }),
    },
  };
}

test("unmentioned group messages are ignored", async () => {
  const sent = [];
  const router = createRouter({
    store: createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-filter-"))),
    send: (payload) => sent.push(payload),
  });
  assert.equal(
    (
      await router.accept(
        event({ chatType: "group", chatId: "oc_g", text: "noise" }),
      )
    ).action,
    "filtered",
  );
  assert.equal(sent.length, 0);
});

test("unbound chats ask for a folder", async () => {
  const sent = [];
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-need-")),
  );
  const router = createRouter({ store, send: (payload) => sent.push(payload) });
  assert.equal(
    (await router.accept(event({ text: "改代码" }))).action,
    "need-folder",
  );
  assert.match(sent[0].text, /\/feishu folder p2p oc_dm/);
});

test("relative folders are rejected", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-rel-")));
  await assert.rejects(
    () => store.bindFolder("p2p:oc_dm", "relative"),
    /absolute/,
  );
});

test("duplicate message ids are ignored", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-dup-")));
  const router = createRouter({ store, send: async () => {} });
  const first = await router.accept(event({ messageId: "om_dup" }));
  const second = await router.accept(event({ messageId: "om_dup" }));
  assert.equal(first.action, "need-folder");
  assert.equal(second.action, "duplicate");
});

test("mentioned group messages are accepted", async () => {
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-mention-")),
  );
  await store.bindFolder("group:oc_g", "/tmp/site");
  const router = createRouter({
    store,
    send: async () => {},
    botOpenId: "ou_bot",
  });
  const result = await router.accept(
    event({
      chatType: "group",
      chatId: "oc_g",
      text: "@_bot 看下",
      mentions: [{ key: "@_bot", id: { open_id: "ou_bot" } }],
    }),
  );
  assert.equal(result.action, "received");
});

test("filtering precedes confirmation consumption", async () => {
  let confirmations = 0;
  const router = createRouter({
    store: createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-order-"))),
    botOpenId: "ou_bot",
    onMessage: () => {
      confirmations += 1;
      return "confirmed";
    },
  });
  const result = await router.accept(
    event({
      chatType: "group",
      chatId: "oc_g",
      text: "确认",
      mentions: [{ key: "@_other", id: { open_id: "ou_other" } }],
    }),
  );
  assert.equal(result.action, "filtered");
  assert.equal(confirmations, 0);
});

test("router persists a lifecycle patch after the runner is released", async () => {
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-lifecycle-")),
  );
  await store.upsertChat("p2p:oc_dm", {
    folder: "/tmp/site",
    sessionFile: "/tmp/old.jsonl",
    archives: [],
  });
  let released = false;
  const runPrompt = async () => ({ text: "unused" });
  runPrompt.release = async () => {
    released = true;
    return { sessionFile: "/tmp/latest.jsonl" };
  };
  runPrompt.dispose = async () => {};
  const worker = createWork({ runPrompt });
  const router = createRouter({
    store,
    send: async () => {},
    work: (payload) => worker.work(payload),
  });
  assert.equal(
    (await router.accept(event({ text: "新对话", messageId: "om_new" })))
      .action,
    "work",
  );
  const chat = await store.getChat("p2p:oc_dm");
  assert.equal(released, true);
  assert.equal(chat.sessionFile, null);
  assert.equal(chat.archives[0].sessionFile, "/tmp/latest.jsonl");
});

test("returns queued files only to the originating topic", async () => {
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-topic-file-")),
  );
  await store.bindFolder("topic:oc_g:omt_thread", "/tmp/site");
  const sent = [];
  const router = createRouter({
    store,
    botOpenId: "ou_bot",
    send: async (payload) => sent.push(payload),
    work: async () => ({
      text: "done",
      files: [{ path: "/tmp/site/out.txt", kind: "file" }],
    }),
  });
  const result = await router.accept(
    event({
      chatType: "group",
      chatId: "oc_g",
      messageId: "om_topic_file",
      threadId: "omt_thread",
      mentions: [{ key: "@_bot", id: { open_id: "ou_bot" } }],
    }),
  );
  assert.equal(result.action, "work");
  assert.equal(sent.length, 2);
  assert.equal(sent[1].chatId, "oc_g");
  assert.equal(sent[1].inbound.key, "topic:oc_g:omt_thread");
  assert.equal(sent[1].inbound.messageId, "om_topic_file");
  assert.deepEqual(sent[1].files, [
    { path: "/tmp/site/out.txt", kind: "file" },
  ]);
});

test("retries a delivery whose send failed", async () => {
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-retry-")),
  );
  await store.bindFolder("p2p:oc_dm", "/tmp/site");
  let sendSucceeds = false;
  let workCalls = 0;
  const router = createRouter({
    store,
    work: async () => {
      workCalls += 1;
      return { text: "done" };
    },
    send: async () => {
      if (!sendSucceeds) throw new Error("send failed");
    },
  });
  const inboundEvent = event({ messageId: "om_retry" });
  await assert.rejects(() => router.accept(inboundEvent), /send failed/);
  sendSucceeds = true;
  assert.equal((await router.accept(inboundEvent)).action, "work");
  assert.equal(workCalls, 2);
});

test("concurrent duplicate accepts execute work once", async () => {
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-race-")),
  );
  await store.bindFolder("p2p:oc_dm", "/tmp/site");
  let releaseWork;
  let workCalls = 0;
  const router = createRouter({
    store,
    send: async () => {},
    work: async () => {
      workCalls += 1;
      await new Promise((resolve) => {
        releaseWork = resolve;
      });
      return { text: "done" };
    },
  });
  const inboundEvent = event({ messageId: "om_race" });
  const first = router.accept(inboundEvent);
  while (!releaseWork) await new Promise((resolve) => setImmediate(resolve));
  const second = await router.accept(inboundEvent);
  releaseWork();
  assert.equal((await first).action, "work");
  assert.equal(second.action, "duplicate");
  assert.equal(workCalls, 1);
});
