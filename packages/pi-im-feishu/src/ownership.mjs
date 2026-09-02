import { randomUUID } from "node:crypto";
import { STALE_MS } from "./paths.mjs";
import { pidIsAlive } from "./lock.mjs";

function timestamp(now) {
  return new Date(now()).toISOString();
}

function matchesWindow(lease, requestId, pid) {
  return (
    lease?.owner === "window" &&
    lease.state === "owned" &&
    lease.requestId === requestId &&
    lease.pid === pid
  );
}

export function createOwnershipCoordinator({
  store,
  runner,
  worker,
  pid = process.pid,
  isAlive = pidIsAlive,
  now = Date.now,
} = {}) {
  if (!store) throw new Error("ownership coordinator needs a store");
  let closed = false;
  let activeServe;
  const serving = new Set();

  return {
    async requestWindow(key, request = {}) {
      const requestId = request.requestId ?? randomUUID();
      const windowPid = request.pid ?? pid;
      const lease = await store.requestOwnership(key, (current, chat) => {
        const heartbeatAt = Date.parse(current?.heartbeatAt);
        const activeWindowRequest =
          current &&
          (current.owner === "window" ||
            current.state === "requested" ||
            current.state === "releasing") &&
          ((Number.isFinite(heartbeatAt) && now() - heartbeatAt <= STALE_MS) ||
            isAlive(current.pid));
        if (activeWindowRequest) {
          throw Object.assign(new Error("这条对话已经在另一个窗口里打开。"), {
            code: "ownership-busy",
          });
        }
        return {
          owner: "assistant",
          state: "requested",
          pid: windowPid,
          requestId,
          sessionFile: chat.sessionFile ?? null,
          heartbeatAt: timestamp(now),
        };
      });
      return { requestId, lease };
    },

    async serveRequests() {
      if (closed) return 0;
      if (activeServe) return activeServe;
      activeServe = (async () => {
        const chats = (await store.status()).chats;
        let served = 0;
        for (const chat of chats) {
          const current = await store.readOwnership(chat.key);
          if (
            current?.owner !== "assistant" ||
            (current.state !== "requested" && current.state !== "releasing") ||
            serving.has(chat.key)
          ) {
            continue;
          }
          serving.add(chat.key);
          let requested;
          try {
            requested = await store.updateOwnership(chat.key, (latest) => {
              if (
                latest?.owner !== "assistant" ||
                (latest.state !== "requested" && latest.state !== "releasing")
              ) {
                return latest;
              }
              return {
                ...latest,
                state: "releasing",
                heartbeatAt: timestamp(now),
              };
            });
            if (requested?.state !== "releasing") continue;
            await worker?.release?.(chat.key);
            const released = await runner?.release?.(chat.key);
            const sessionFile =
              released?.sessionFile ??
              requested.sessionFile ??
              chat.sessionFile;
            let granted = false;
            await store.updateOwnership(chat.key, (latest, record) => {
              if (
                latest?.state !== "releasing" ||
                latest.requestId !== requested.requestId
              ) {
                return latest;
              }
              record.sessionFile = sessionFile;
              granted = true;
              return {
                owner: "window",
                state: "owned",
                pid: requested.pid,
                requestId: requested.requestId,
                sessionFile,
                heartbeatAt: timestamp(now),
              };
            });
            if (granted) served += 1;
          } catch (error) {
            if (requested) {
              await store.updateOwnership(chat.key, (latest) =>
                latest?.state === "releasing" &&
                latest.requestId === requested.requestId
                  ? { ...latest, state: "requested" }
                  : latest,
              );
            }
            throw error;
          } finally {
            serving.delete(chat.key);
          }
        }
        return served;
      })();
      try {
        return await activeServe;
      } finally {
        activeServe = undefined;
      }
    },

    async heartbeatWindow(key, requestId, windowPid) {
      let heartbeated = false;
      await store.updateOwnership(key, (current) => {
        if (!matchesWindow(current, requestId, windowPid)) return current;
        heartbeated = true;
        return { ...current, heartbeatAt: timestamp(now) };
      });
      return heartbeated;
    },

    async releaseWindow(key, requestId, windowPid, sessionFile) {
      let released = false;
      await store.updateOwnership(key, (current) => {
        if (
          !matchesWindow(current, requestId, windowPid) ||
          current.sessionFile !== sessionFile
        ) {
          return current;
        }
        released = true;
        return {
          ...current,
          owner: "assistant",
          state: "owned",
          pid,
          heartbeatAt: timestamp(now),
        };
      });
      return released;
    },

    async canAssistantWrite(key) {
      const current = await store.readOwnership(key);
      if (
        !current ||
        (current.owner === "assistant" && current.state === "owned")
      ) {
        return true;
      }
      if (current.owner !== "window" || current.state !== "owned") return false;
      const heartbeatAt = Date.parse(current.heartbeatAt);
      const stale =
        !Number.isFinite(heartbeatAt) || now() - heartbeatAt > STALE_MS;
      if (!stale || isAlive(current.pid)) return false;
      let reclaimed = false;
      await store.updateOwnership(key, (latest) => {
        if (
          !matchesWindow(latest, current.requestId, current.pid) ||
          latest.heartbeatAt !== current.heartbeatAt
        ) {
          return latest;
        }
        reclaimed = true;
        return {
          ...latest,
          owner: "assistant",
          state: "owned",
          pid,
          heartbeatAt: timestamp(now),
        };
      });
      return (
        reclaimed || (await store.readOwnership(key))?.owner === "assistant"
      );
    },

    async close() {
      closed = true;
      await activeServe;
    },
  };
}
