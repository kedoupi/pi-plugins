import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isImportantTool, userConfirmed } from "../src/important.mjs";
import { createRouter } from "../src/router.mjs";
import { createStore } from "../src/store.mjs";
import { createWork } from "../src/work.mjs";

test("same chat runs serially and stop aborts", async () => {
  const order = [];
  const worker = createWork({
    runPrompt: async ({ inbound, signal }) => {
      order.push(`start:${inbound.text}`);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 30);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(Object.assign(new Error("aborted"), { code: "aborted" }));
        });
      });
      order.push(`end:${inbound.text}`);
      return { text: `done:${inbound.text}`, sessionFile: "/tmp/s.jsonl" };
    }
  });
  const first = worker.work({ inbound: { key: "p2p:a", text: "one" }, chat: { folder: "/tmp/a" } });
  const stopped = worker.work({ inbound: { key: "p2p:a", text: "/stop" }, chat: { folder: "/tmp/a" } });
  assert.equal((await stopped).stopped, true);
  await first.catch(() => {});
  assert.equal(order.includes("end:one"), false);
});

test("router with work replies using prompt text and stores sessionFile", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-work-"));
  const store = createStore(home);
  await store.bindFolder("p2p:oc_dm", "/tmp/site");
  const sent = [];
  const worker = createWork({
    runPrompt: async ({ folder }) => ({ text: `ok:${folder}`, sessionFile: "/tmp/site/s.jsonl" })
  });
  const router = createRouter({
    store,
    send: (payload) => sent.push(payload),
    work: (payload) => worker.work(payload)
  });
  const result = await router.accept({
    sender: { sender_type: "user", sender_id: { open_id: "ou_user" } },
    message: {
      message_id: "om_w",
      chat_id: "oc_dm",
      chat_type: "p2p",
      message_type: "text",
      content: JSON.stringify({ text: "帮我改" })
    }
  });
  assert.equal(result.action, "work");
  assert.equal(sent[0].text, "ok:/tmp/site");
  assert.equal((await store.getChat("p2p:oc_dm")).sessionFile, "/tmp/site/s.jsonl");
});

test("新对话 archives session without calling the model", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-new-"));
  const store = createStore(home);
  await store.upsertChat("p2p:oc_dm", { folder: "/tmp/site", sessionFile: "/tmp/old.jsonl" });
  let called = false;
  const worker = createWork({
    runPrompt: async () => {
      called = true;
      return { text: "nope" };
    }
  });
  const result = await worker.work({
    inbound: { key: "p2p:oc_dm", text: "新对话" },
    chat: await store.getChat("p2p:oc_dm")
  });
  assert.equal(called, false);
  assert.equal(result.patch.sessionFile, null);
});

test("important tools need Feishu confirm", () => {
  assert.equal(isImportantTool("bash", { command: "rm -rf /tmp/x" }), true);
  assert.equal(isImportantTool("bash", { command: "ls" }), false);
  assert.equal(userConfirmed("确认"), true);
  assert.equal(userConfirmed("算了"), false);
});
