import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLock } from "../src/lock.mjs";

test("second acquirer is busy while the first pid is alive", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-lock-"));
  const lock = createLock(home);
  await lock.acquire({ pid: process.pid, appId: "cli_test" });
  await assert.rejects(
    () => createLock(home).acquire({ pid: process.pid + 1 }),
    (error) => error.code === "assistant-busy"
  );
  await lock.release();
});

test("stale lock from a dead pid can be taken over", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-stale-"));
  await createLock(home).acquire({ pid: 999999, appId: "cli_test" });
  const owner = await createLock(home).acquire({ pid: process.pid, appId: "cli_test" });
  assert.equal(owner.pid, process.pid);
});
