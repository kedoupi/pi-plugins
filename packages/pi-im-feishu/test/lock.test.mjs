import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { withFileLock } from "../src/file-lock.mjs";
import { createLock } from "../src/lock.mjs";

async function temporaryHome(label) {
  return mkdtemp(join(tmpdir(), `pi-im-feishu-${label}-`));
}

test("second acquirer is busy while the first pid is alive", async () => {
  const home = await temporaryHome("lock");
  const lock = createLock(home);
  await lock.acquire({ pid: process.pid, appId: "cli_test" });
  await assert.rejects(
    () => createLock(home).acquire({ pid: process.pid + 1, isAlive: () => true }),
    (error) => error.code === "assistant-busy"
  );
  await lock.release();
});

test("stale lock from a dead pid can be taken over", async () => {
  const home = await temporaryHome("stale");
  await createLock(home).acquire({ pid: 999999, appId: "cli_test" });
  const owner = await createLock(home).acquire({
    pid: process.pid,
    appId: "cli_test",
    isAlive: (pid) => pid === process.pid
  });
  assert.equal(owner.pid, process.pid);
});

test("allows only one concurrent assistant acquire", async () => {
  const home = await temporaryHome("lock-race");
  const a = createLock(home);
  const b = createLock(home);
  const results = await Promise.allSettled([
    a.acquire({ pid: 1001, appId: "cli_a", isAlive: () => true }),
    b.acquire({ pid: 1002, appId: "cli_a", isAlive: () => true })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected")[0].reason.code, "assistant-busy");
});

test("does not recover a stale heartbeat while its pid is alive", async () => {
  const home = await temporaryHome("live-stale");
  const first = createLock(home);
  await first.acquire({ pid: 1001, appId: "cli_a", isAlive: () => true });
  const owner = JSON.parse(await readFile(first.path, "utf8"));
  await writeFile(first.path, `${JSON.stringify({ ...owner, heartbeatAt: "2000-01-01T00:00:00.000Z" })}\n`);
  await assert.rejects(
    () => createLock(home).acquire({ pid: 1002, appId: "cli_a", isAlive: () => true }),
    (error) => error.code === "assistant-busy"
  );
});

test("a heartbeat never revives a replaced lock", async () => {
  const home = await temporaryHome("heartbeat-race");
  const lock = createLock(home);
  await lock.acquire({ pid: process.pid, appId: "cli_a" });
  const replacement = {
    pid: process.pid,
    appId: "cli_b",
    token: "replacement-token",
    status: "starting",
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString()
  };
  await writeFile(lock.path, `${JSON.stringify(replacement)}\n`);
  await assert.rejects(() => lock.heartbeat("online"), (error) => error.code === "lock-lost");
  assert.deepEqual(JSON.parse(await readFile(lock.path, "utf8")), replacement);
});

test("file locks reap only dead stale owners and clean up after callbacks", async () => {
  const lockDir = join(await temporaryHome("file-lock"), "mutation.lock");
  await mkdir(lockDir);
  await writeFile(join(lockDir, "owner.json"), JSON.stringify({
    pid: 1001,
    createdAt: "2000-01-01T00:00:00.000Z",
    token: "stale-token"
  }));

  await assert.rejects(
    () => withFileLock(lockDir, async () => {}, {
      timeoutMs: 0,
      staleMs: 1,
      isAlive: () => true,
      now: () => Date.parse("2026-09-01T00:00:00.000Z")
    }),
    (error) => error.code === "lock-timeout"
  );

  const result = await withFileLock(lockDir, async () => "done", {
    timeoutMs: 0,
    staleMs: 1,
    isAlive: () => false,
    now: () => Date.parse("2026-09-01T00:00:00.000Z")
  });
  assert.equal(result, "done");
  await assert.rejects(() => access(lockDir), (error) => error.code === "ENOENT");
});
