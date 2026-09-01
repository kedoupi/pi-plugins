import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createOwnershipCoordinator } from "../src/ownership.mjs";
import { createStore } from "../src/store.mjs";

async function fixture(options = {}) {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-ownership-"));
  const store = createStore(home);
  await store.upsertChat("p2p:a", {
    folder: "/tmp/a",
    sessionFile: "/tmp/a.jsonl",
  });
  return { store, coordinator: createOwnershipCoordinator({ store, ...options }) };
}

test("grants the window only after the assistant releases the session", async () => {
  const calls = [];
  const { store, coordinator } = await fixture({
    worker: {
      async release(key) {
        calls.push(`worker.release:${key}`);
      },
    },
    runner: {
      async release(key) {
        calls.push(`runner.release:${key}`);
        return { sessionFile: "/tmp/latest.jsonl" };
      },
    },
    pid: 4001,
    now: () => 0,
  });

  const request = await coordinator.requestWindow("p2p:a", { pid: 4101 });
  assert.equal((await store.readOwnership("p2p:a")).state, "requested");
  await coordinator.serveRequests();

  assert.deepEqual(calls, ["worker.release:p2p:a", "runner.release:p2p:a"]);
  assert.deepEqual(await store.readOwnership("p2p:a"), {
    owner: "window",
    state: "owned",
    pid: 4101,
    requestId: request.requestId,
    sessionFile: "/tmp/latest.jsonl",
    heartbeatAt: "1970-01-01T00:00:00.000Z",
  });
  assert.equal((await store.getChat("p2p:a")).sessionFile, "/tmp/latest.jsonl");
});

test("one request is released and granted exactly once", async () => {
  let workerReleases = 0;
  let runnerReleases = 0;
  const { coordinator } = await fixture({
    worker: {
      async release() {
        workerReleases += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
    },
    runner: {
      async release() {
        runnerReleases += 1;
        return { sessionFile: "/tmp/a.jsonl" };
      },
    },
  });
  await coordinator.requestWindow("p2p:a", { pid: 4101 });
  await Promise.all([coordinator.serveRequests(), coordinator.serveRequests()]);
  assert.equal(workerReleases, 1);
  assert.equal(runnerReleases, 1);
  await assert.rejects(
    () => coordinator.requestWindow("p2p:a", { pid: 4102 }),
    (error) => error.code === "ownership-busy",
  );
});

test("pauses Feishu work while the window lease is live", async () => {
  const { coordinator } = await fixture({ pid: 4001, now: () => 1_000 });
  const request = await coordinator.requestWindow("p2p:a", { pid: 4101 });
  await coordinator.serveRequests();
  assert.equal(request.requestId.length > 0, true);
  assert.equal(await coordinator.canAssistantWrite("p2p:a"), false);
});

test("reclaims only a dead stale window", async () => {
  let now = 1_000;
  const { store, coordinator } = await fixture({
    pid: 4001,
    now: () => now,
    isAlive: () => true,
  });
  const request = await coordinator.requestWindow("p2p:a", { pid: 4201 });
  await coordinator.serveRequests();
  now = 60_000;
  assert.equal(await coordinator.canAssistantWrite("p2p:a"), false);

  const deadCoordinator = createOwnershipCoordinator({
    store,
    pid: 4001,
    now: () => now,
    isAlive: () => false,
  });
  assert.equal(await deadCoordinator.canAssistantWrite("p2p:a"), true);
  assert.deepEqual(await store.readOwnership("p2p:a"), {
    owner: "assistant",
    state: "owned",
    pid: 4001,
    requestId: request.requestId,
    sessionFile: "/tmp/a.jsonl",
    heartbeatAt: "1970-01-01T00:01:00.000Z",
  });
});

test("heartbeat and release require the exact window lease", async () => {
  let now = 1_000;
  const { store, coordinator } = await fixture({ pid: 4001, now: () => now });
  const request = await coordinator.requestWindow("p2p:a", { pid: 4101 });
  await coordinator.serveRequests();

  now = 2_000;
  assert.equal(
    await coordinator.heartbeatWindow("p2p:a", request.requestId, 9999),
    false,
  );
  assert.equal(
    await coordinator.heartbeatWindow("p2p:a", request.requestId, 4101),
    true,
  );
  assert.equal(
    await coordinator.releaseWindow(
      "p2p:a",
      request.requestId,
      4101,
      "/tmp/other.jsonl",
    ),
    false,
  );
  assert.equal(
    await coordinator.releaseWindow(
      "p2p:a",
      request.requestId,
      4101,
      "/tmp/a.jsonl",
    ),
    true,
  );
  assert.equal((await store.readOwnership("p2p:a")).owner, "assistant");
});

test("findChatBySession returns the matching key and record", async () => {
  const { store } = await fixture();
  const chat = await store.findChatBySession("/tmp/a.jsonl");
  assert.equal(chat.key, "p2p:a");
  assert.equal(chat.folder, "/tmp/a");
  assert.equal(chat.sessionFile, "/tmp/a.jsonl");
  assert.equal(await store.findChatBySession("/tmp/missing.jsonl"), null);
});
