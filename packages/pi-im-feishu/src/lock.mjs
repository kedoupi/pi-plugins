import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { defaultHome, lockPath, STALE_MS } from "./paths.mjs";

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isStale(owner, now = Date.now()) {
  if (!owner || !isAlive(owner.pid)) return true;
  const heartbeatAt = Date.parse(owner.heartbeatAt);
  if (!Number.isFinite(heartbeatAt)) return true;
  return now - heartbeatAt > STALE_MS;
}

async function readOwner(path) {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    if (!Number.isInteger(raw.pid) || typeof raw.status !== "string") return null;
    return raw;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function onlineLabel(owner) {
  if (!owner) return "offline";
  if (owner.status === "online") return "online";
  if (owner.status === "starting") return "starting";
  return "offline";
}

export function createLock(home = defaultHome()) {
  const path = lockPath(home);

  async function writeOwner(owner) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(owner, null, 2)}\n`, "utf8");
  }

  return {
    path,

    async read() {
      const owner = await readOwner(path);
      if (!owner || isStale(owner)) return null;
      return owner;
    },

    async acquire({ pid = process.pid, appId } = {}) {
      const current = await readOwner(path);
      if (current && !isStale(current) && current.pid !== pid) {
        throw Object.assign(new Error(`assistant already running as pid ${current.pid}`), {
          code: "assistant-busy",
          owner: current
        });
      }
      const now = new Date().toISOString();
      const owner = {
        pid,
        appId: appId ?? current?.appId ?? null,
        status: "starting",
        startedAt: current?.pid === pid ? current.startedAt : now,
        heartbeatAt: now
      };
      await writeOwner(owner);
      return owner;
    },

    async heartbeat(status = "online") {
      const current = await readOwner(path);
      if (!current || current.pid !== process.pid) {
        throw Object.assign(new Error("assistant lock lost"), { code: "lock-lost" });
      }
      const owner = { ...current, status, heartbeatAt: new Date().toISOString() };
      await writeOwner(owner);
      return owner;
    },

    async release(pid = process.pid) {
      const current = await readOwner(path);
      if (current && current.pid !== pid) return current;
      await rm(path, { force: true });
      return null;
    }
  };
}
