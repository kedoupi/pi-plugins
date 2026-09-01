import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isImportantTool, userConfirmed } from "../src/important.mjs";
import { createRouter } from "../src/router.mjs";
import { createStore } from "../src/store.mjs";
import { createWork } from "../src/work.mjs";

test("stop aborts the running job and cancels the queued job", async () => {
  const startedPrompts = [];
  const runPrompt = async ({ inbound, signal }) => {
    startedPrompts.push(inbound.text);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(Object.assign(new Error("aborted"), { code: "aborted" }));
        },
        { once: true },
      );
    });
    return { text: `done:${inbound.text}`, sessionFile: "/tmp/s.jsonl" };
  };
  runPrompt.release = async () => ({ sessionFile: null });
  runPrompt.dispose = async () => {};
  const worker = createWork({ runPrompt });
  const chat = { folder: "/tmp/a" };
  const first = worker.work({ inbound: { key: "p2p:a", text: "first" }, chat });
  const second = worker.work({ inbound: { key: "p2p:a", text: "second" }, chat });
  const stopped = await worker.work({
    inbound: { key: "p2p:a", text: "/stop" },
    chat,
  });
  assert.equal(stopped.stopped, true);
  assert.equal((await first).stopped, true);
  assert.equal((await second).stopped, true);
  assert.deepEqual(startedPrompts, ["first"]);
});

test("folder change releases the runner, archives the session, and starts fresh", async () => {
  const releasedKeys = [];
  const oldFile = "/tmp/latest.jsonl";
  const runPrompt = async () => ({ text: "unused" });
  runPrompt.release = async (key) => {
    releasedKeys.push(key);
    return { sessionFile: oldFile };
  };
  runPrompt.dispose = async () => {};
  const worker = createWork({ runPrompt });
  const result = await worker.work({
    inbound: { key: "group:a", text: "换文件夹 /tmp/new" },
    chat: {
      folder: "/tmp/old",
      sessionFile: "/tmp/stale.jsonl",
      archives: [],
    },
  });
  assert.equal(result.patch.sessionFile, null);
  assert.equal(result.patch.archives[0].sessionFile, oldFile);
  assert.equal(result.patch.folder, "/tmp/new");
  assert.deepEqual(releasedKeys, ["group:a"]);
});

test("previous releases the runner before switching sessions", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-work-previous-"));
  const oldFile = join(home, "old.jsonl");
  await writeFile(
    oldFile,
    `${JSON.stringify({ type: "session", id: "old", cwd: "/tmp/site" })}\n`,
  );
  const releasedKeys = [];
  const runPrompt = async () => ({ text: "unused" });
  runPrompt.release = async (key) => {
    releasedKeys.push(key);
    return { sessionFile: "/tmp/latest.jsonl" };
  };
  const worker = createWork({ runPrompt });
  const result = await worker.work({
    inbound: { key: "p2p:a", text: "以前的 1" },
    chat: {
      folder: "/tmp/site",
      sessionFile: "/tmp/stale.jsonl",
      archives: [{ sessionFile: oldFile, label: "旧" }],
    },
  });
  assert.equal(result.patch.sessionFile, oldFile);
  assert.equal(result.patch.archives[0].sessionFile, "/tmp/latest.jsonl");
  assert.deepEqual(releasedKeys, ["p2p:a"]);
});

test("release drains one lane without disposing its Pi session", async () => {
  let runnerReleases = 0;
  let runnerDisposes = 0;
  const runPrompt = async ({ signal }) => {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 50);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    return { text: "done" };
  };
  runPrompt.release = async () => {
    runnerReleases += 1;
    return { sessionFile: null };
  };
  runPrompt.dispose = async () => {
    runnerDisposes += 1;
  };
  const worker = createWork({ runPrompt });
  const running = worker.work({
    inbound: { key: "p2p:a", text: "one" },
    chat: { folder: "/tmp/a" },
  });
  const queued = worker.work({
    inbound: { key: "p2p:a", text: "two" },
    chat: { folder: "/tmp/a" },
  });
  await worker.release("p2p:a");
  assert.equal((await running).stopped, true);
  assert.equal((await queued).stopped, true);
  assert.equal(runnerReleases, 0);
  await worker.dispose();
  assert.equal(runnerDisposes, 1);
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
