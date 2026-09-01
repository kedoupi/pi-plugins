import assert from "node:assert/strict";
import test from "node:test";
import { createConfirmWait } from "../src/confirm-wait.mjs";
import { createRouter } from "../src/router.mjs";
import { createStore } from "../src/store.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("confirm wait resolves on 确认 and rejects other text", async () => {
  const sent = [];
  const wait = createConfirmWait((payload) => sent.push(payload));
  const asked = wait.ask({ inbound: { key: "p2p:a", chatId: "oc" }, kind: "bash", detail: "rm" });
  assert.equal(wait.take("p2p:a", "确认"), true);
  assert.equal(await asked, true);
  assert.match(sent[0].text, /确认/);
});

test("router treats confirm replies as confirm actions", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-confirm-")));
  await store.bindFolder("p2p:oc_dm", "/tmp/site");
  const wait = createConfirmWait(async () => {});
  const pending = wait.ask({ inbound: { key: "p2p:oc_dm", chatId: "oc_dm" }, kind: "rm" });
  const router = createRouter({
    store,
    send: async () => {},
    onMessage: (inbound) => wait.take(inbound.key, inbound.text)
  });
  const result = await router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou" } },
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
