import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { atomicWriteJson } from "./atomic-json.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function readOwner(lockDir) {
  try {
    return JSON.parse(await readFile(join(lockDir, "owner.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    try {
      const info = await stat(lockDir);
      return { pid: null, createdAt: info.mtime.toISOString(), token: null };
    } catch (statError) {
      if (statError.code === "ENOENT") return null;
      throw statError;
    }
  }
}

export async function withFileLock(lockDir, fn, {
  timeoutMs = 1_000,
  staleMs = 30_000,
  pid = process.pid,
  isAlive = processIsAlive,
  now = Date.now
} = {}) {
  const deadline = now() + timeoutMs;
  const token = randomUUID();
  await mkdir(dirname(lockDir), { recursive: true, mode: 0o700 });

  while (true) {
    try {
      await mkdir(lockDir, { mode: 0o700 });
      try {
        await atomicWriteJson(join(lockDir, "owner.json"), {
          pid,
          createdAt: new Date(now()).toISOString(),
          token
        });
      } catch (error) {
        await rm(lockDir, { recursive: true, force: true });
        throw error;
      }
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const owner = await readOwner(lockDir);
      const createdAt = Date.parse(owner?.createdAt);
      const stale = !Number.isFinite(createdAt) || now() - createdAt >= staleMs;
      if (stale && !isAlive(owner?.pid)) {
        const current = await readOwner(lockDir);
        if (current?.token === owner?.token && current?.pid === owner?.pid) {
          await rm(lockDir, { recursive: true, force: true });
          continue;
        }
      }
      if (now() >= deadline) {
        throw Object.assign(new Error(`timed out waiting for file lock: ${lockDir}`), {
          code: "lock-timeout",
          owner
        });
      }
      await delay(Math.min(10, Math.max(1, deadline - now())));
    }
  }

  try {
    return await fn();
  } finally {
    const owner = await readOwner(lockDir);
    if (owner?.token === token) await rm(lockDir, { recursive: true, force: true });
  }
}
