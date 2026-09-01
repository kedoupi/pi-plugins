import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRouter } from "../src/router.mjs";
import { createStore } from "../src/store.mjs";

function event({ chatType = "p2p", chatId = "oc_dm", text = "hi", mentions, messageId = "om_1" }) {
  return {
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: messageId,
      chat_id: chatId,
      chat_type: chatType,
      message_type: "text",
      mentions,
      content: JSON.stringify({ text })
    }
  };
}

test("unmentioned group messages are ignored", async () => {
  const sent = [];
  const router = createRouter({
    store: createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-filter-"))),
    send: (payload) => sent.push(payload)
  });
  assert.equal((await router.accept(event({ chatType: "group", chatId: "oc_g", text: "noise" }))).action, "filtered");
  assert.equal(sent.length, 0);
});

test("unbound chats ask for a folder", async () => {
  const sent = [];
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-need-")));
  const router = createRouter({ store, send: (payload) => sent.push(payload) });
  assert.equal((await router.accept(event({ text: "改代码" }))).action, "need-folder");
  assert.match(sent[0].text, /\/feishu folder p2p oc_dm/);
});

test("relative folders are rejected", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-rel-")));
  await assert.rejects(() => store.bindFolder("p2p:oc_dm", "relative"), /absolute/);
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
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-mention-")));
  await store.bindFolder("group:oc_g", "/tmp/site");
  const router = createRouter({ store, send: async () => {}, botOpenId: "ou_bot" });
  const result = await router.accept(event({
    chatType: "group",
    chatId: "oc_g",
    text: "@_bot 看下",
    mentions: [{ key: "@_bot", id: { open_id: "ou_bot" } }]
  }));
  assert.equal(result.action, "received");
});
