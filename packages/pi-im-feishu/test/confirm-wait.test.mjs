import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createConfirmWait } from "../src/confirm-wait.mjs";
import { createRouter } from "../src/router.mjs";
import { createStore } from "../src/store.mjs";

const requesterInbound = {
  key: "p2p:oc_dm",
  kind: "p2p",
  chatId: "oc_dm",
  messageId: "om_request",
  senderOpenId: "ou_requester",
  mentioned: true
};

test("confirmation is consumed only from the original requester", async () => {
  const sent = [];
  const wait = createConfirmWait((payload) => sent.push(payload));
  const asked = wait.ask({ inbound: requesterInbound, kind: "bash", detail: "rm x" });
  assert.equal(wait.take({ ...requesterInbound, senderOpenId: "ou_other", text: "确认" }), null);
  assert.equal(wait.take({ ...requesterInbound, text: "later" }), null);
  assert.equal(wait.take({ ...requesterInbound, text: "确认" }), "confirmed");
  assert.equal(await asked, true);
  assert.match(sent[0].text, /回复「确认」继续，回复「拒绝」跳过。/);
});

test("group confirmation requires a mention and supports explicit rejection", async () => {
  const wait = createConfirmWait(async () => {});
  const inbound = {
    ...requesterInbound,
    key: "group:oc_group",
    kind: "group",
    chatId: "oc_group"
  };
  const asked = wait.ask({ inbound, kind: "bash", detail: "rm x" });
  assert.equal(wait.take({ ...inbound, text: "拒绝", mentioned: false }), null);
  assert.equal(wait.take({ ...inbound, text: "拒绝", mentioned: true }), "rejected");
  assert.equal(await asked, false);
});

test("router treats confirm replies as confirm actions", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-confirm-")));
  await store.bindFolder("p2p:oc_dm", "/tmp/site");
  const wait = createConfirmWait(async () => {});
  const pending = wait.ask({ inbound: requesterInbound, kind: "rm" });
  const router = createRouter({
    store,
    send: async () => {},
    onMessage: (inbound) => wait.take(inbound)
  });
  const result = await router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou_requester" } },
    message: {
      message_id: "om_c",
      chat_id: "oc_dm",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text: "确认" })
    }
  });
  assert.equal(result.action, "confirm");
  assert.equal(await pending, true);
});
