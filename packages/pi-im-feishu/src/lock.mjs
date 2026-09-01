import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWriteJson } from "./atomic-json.mjs";
import { withFileLock } from "./file-lock.mjs";
import { defaultHome, lockGuardPath, lockPath, STALE_MS } from "./paths.mjs";

export function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function isStale(owner, now = Date.now()) {
  if (!owner || !pidIsAlive(owner.pid)) return true;
  const heartbeatAt = Date.parse(owner.heartbeatAt);
  if (!Number.isFinite(heartbeatAt)) return true;
  return now - heartbeatAt > STALE_MS;
}

async function readOwner(path) {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    if (!Number.isInteger(raw.pid) || typeof raw.status !== "string")
      return null;
    return raw;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeOwnerExclusive(path, owner) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(owner, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
}

export function onlineLabel(owner) {
  if (!owner) return "offline";
  if (owner.status === "online") return "online";
  if (owner.status === "starting") return "starting";
  return "offline";
}

export function createLock(home = defaultHome()) {
  const path = lockPath(home);
  const guardPath = lockGuardPath(home);
  let heldToken = null;
  let heldPid = null;

  return {
    path,

    async read() {
      const owner = await readOwner(path);
      if (!owner || isStale(owner)) return null;
      return owner;
    },

    async acquire({
      pid = process.pid,
      appId,
      isAlive = pidIsAlive,
      now = Date.now,
    } = {}) {
      return withFileLock(guardPath, async () => {
        const current = await readOwner(path);
        if (current) {
          if (
            heldToken &&
            current.token === heldToken &&
            current.pid === heldPid
          )
            return current;
          if (isAlive(current.pid)) {
            throw Object.assign(
              new Error(`assistant already running as pid ${current.pid}`),
              {
                code: "assistant-busy",
                owner: current,
              },
            );
          }
          await rm(path, { force: true });
        }

        const timestamp = new Date(now()).toISOString();
        const token = randomUUID();
        const owner = {
          pid,
          appId: appId ?? current?.appId ?? null,
          token,
          status: "starting",
          startedAt: timestamp,
          heartbeatAt: timestamp,
        };
        await writeOwnerExclusive(path, owner);
        heldToken = token;
        heldPid = pid;
        return owner;
      });
    },

    async heartbeat(status = "online") {
      return withFileLock(guardPath, async () => {
        const current = await readOwner(path);
        if (
          !heldToken ||
          !current ||
          current.pid !== heldPid ||
          current.token !== heldToken
        ) {
          throw Object.assign(new Error("assistant lock lost"), {
            code: "lock-lost",
          });
        }
        const owner = {
          ...current,
          status,
          heartbeatAt: new Date().toISOString(),
        };
        await atomicWriteJson(path, owner);
        return owner;
      });
    },

    async release(pid) {
      return withFileLock(guardPath, async () => {
        const current = await readOwner(path);
        if (!current) return null;
        const targetPid = pid ?? heldPid ?? process.pid;
        if (current.pid !== targetPid) return current;
        if (pid === undefined && heldToken && current.token !== heldToken)
          return current;
        await rm(path, { force: true });
        if (current.token === heldToken) {
          heldToken = null;
          heldPid = null;
        }
        return null;
      });
    },
  };
}
