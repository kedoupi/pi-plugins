import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";
import { createStore } from "../src/store.mjs";

const ownershipUrl = pathToFileURL(
  join(import.meta.dirname, "../src/ownership.mjs"),
).href;
const storeUrl = pathToFileURL(join(import.meta.dirname, "../src/store.mjs")).href;

const childSource = `
import { createOwnershipCoordinator } from ${JSON.stringify(ownershipUrl)};
import { createStore } from ${JSON.stringify(storeUrl)};
const store = createStore(process.env.TEST_HOME);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = "p2p:process";
if (process.env.TEST_ROLE === "assistant") {
  const started = Date.now();
  const coordinator = createOwnershipCoordinator({
    store,
    worker: {
      async release() {
        await sleep(30);
        process.send({ type: "assistant-paused", interval: [started, Date.now()] });
      }
    },
    runner: { async release() { return { sessionFile: process.env.TEST_SESSION }; } },
  });
  process.send({ type: "ready" });
  while ((await store.readOwnership(key))?.owner !== "window") {
    await coordinator.serveRequests();
    await sleep(5);
  }
  while (!(await coordinator.canAssistantWrite(key))) await sleep(5);
  process.send({ type: "assistant-resumed", at: Date.now() });
  await coordinator.close();
} else {
  const coordinator = createOwnershipCoordinator({ store });
  const request = await coordinator.requestWindow(key, { pid: process.pid });
  let lease;
  while (true) {
    lease = await store.readOwnership(key);
    if (lease?.owner === "window" && lease.requestId === request.requestId) break;
    await sleep(5);
  }
  const started = Date.now();
  await sleep(30);
  await coordinator.heartbeatWindow(key, request.requestId, process.pid);
  const ended = Date.now();
  await coordinator.releaseWindow(key, request.requestId, process.pid, process.env.TEST_SESSION);
  process.send({ type: "window", interval: [started, ended] });
  await coordinator.close();
}
`;

function child(role, home, sessionFile) {
  return spawn(process.execPath, ["--input-type=module", "-e", childSource], {
    env: {
      ...process.env,
      TEST_HOME: home,
      TEST_ROLE: role,
      TEST_SESSION: sessionFile,
    },
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
}

function waitFor(childProcess, type, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), timeoutMs);
    const onMessage = (message) => {
      if (message?.type !== type) return;
      clearTimeout(timer);
      childProcess.off("error", onError);
      childProcess.off("message", onMessage);
      resolve(message);
    };
    const onError = (error) => {
      clearTimeout(timer);
      childProcess.off("message", onMessage);
      reject(error);
    };
    childProcess.on("message", onMessage);
    childProcess.once("error", onError);
  });
}

function exited(childProcess) {
  return new Promise((resolve, reject) => {
    childProcess.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`child exited ${code}`)),
    );
    childProcess.once("error", reject);
  });
}

test("assistant and window processes never hold overlapping write intervals", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-owner-process-"));
  const sessionFile = join(home, "session.jsonl");
  const store = createStore(home);
  await store.upsertChat("p2p:process", {
    folder: home,
    sessionFile,
  });

  const assistant = child("assistant", home, sessionFile);
  const assistantExit = exited(assistant);
  t.after(() => assistant.kill("SIGKILL"));
  await waitFor(assistant, "ready");
  const window = child("window", home, sessionFile);
  const windowExit = exited(window);
  t.after(() => window.kill("SIGKILL"));

  const [assistantPaused, windowInterval, assistantResumed] = await Promise.all([
    waitFor(assistant, "assistant-paused"),
    waitFor(window, "window"),
    waitFor(assistant, "assistant-resumed"),
  ]);
  await Promise.all([assistantExit, windowExit]);

  assert.ok(assistantPaused.interval[1] <= windowInterval.interval[0]);
  assert.ok(windowInterval.interval[1] <= assistantResumed.at);
});
