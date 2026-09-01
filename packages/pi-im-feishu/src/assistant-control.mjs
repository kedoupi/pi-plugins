import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createAutostart } from "./autostart.mjs";
import { macosAutostart } from "./macos-autostart.mjs";
import { attachWithOwnership } from "./ownership.mjs";
import { createLock, onlineLabel } from "./lock.mjs";
import { assistantScriptPath, defaultHome, HEARTBEAT_MS, HOME_ENV, logPath } from "./paths.mjs";
import { chatKey, createStore } from "./store.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAssistantControl(home = defaultHome(), {
  autostart,
  runner
} = {}) {
  const lock = createLock(home);
  const store = createStore(home);
  const auto = autostart ?? macosAutostart(home);
  let inProcess = null;

  async function waitForOnline(timeoutMs = 4_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const owner = await lock.read();
      if (owner?.status === "online") return owner;
      await sleep(100);
    }
    return lock.read();
  }

  return {
    home,
    store,
    lock,
    autostart: auto,
    attachDecision: (chat, cwd) => attachWithOwnership(chat, cwd, inProcess?.ownership),

    async snapshot() {
      const [status, owner] = await Promise.all([store.status(), lock.read()]);
      return {
        ...status,
        presence: onlineLabel(owner),
        assistant: owner
      };
    },

    async start() {
      const credentials = await store.loadCredentials();
      if (!credentials) {
        throw Object.assign(new Error("请先绑定飞书。"), { code: "not-configured" });
      }
      const current = await lock.read();
      if (current?.status === "online") {
        return { started: false, reason: "already-running", owner: current };
      }
      await store.setStopped(false);
      if (typeof runner === "function") {
        inProcess = await runner({ home, store, lock });
      } else {
        const logFile = await open(logPath(home), "a");
        try {
          const child = spawn(process.execPath, [fileURLToPath(assistantScriptPath())], {
            detached: true,
            stdio: ["ignore", logFile.fd, logFile.fd],
            env: { ...process.env, [HOME_ENV]: home, PI_IM_FEISHU_ASSISTANT: "1" }
          });
          child.unref();
        } finally {
          await logFile.close();
        }
      }
      const owner = await waitForOnline();
      if (owner?.status !== "online") {
        throw Object.assign(new Error("飞书没有上线。请看助手日志；可能被其它客户端占用。"), {
          code: "not-online",
          owner
        });
      }
      try {
        await auto.enable();
      } catch {}
      return { started: true, owner };
    },

    async stop() {
      await store.setStopped(true);
      await auto.disable();
      if (inProcess?.shutdown) {
        await inProcess.shutdown();
        inProcess = null;
        return { stopped: true, reason: "stopped" };
      }
      const owner = await lock.read();
      if (!owner) return { stopped: false, reason: "already-offline" };
      if (owner.pid === process.pid) {
        await lock.release(owner.pid);
        return { stopped: true, reason: "released-same-process" };
      }
      try {
        process.kill(owner.pid, "SIGTERM");
      } catch {
        await lock.release(owner.pid);
        return { stopped: true, reason: "reaped" };
      }
      const deadline = Date.now() + HEARTBEAT_MS * 2;
      while (Date.now() < deadline) {
        if (!(await lock.read())) return { stopped: true, reason: "stopped" };
        await sleep(50);
      }
      try {
        process.kill(owner.pid, "SIGKILL");
      } catch {}
      await lock.release(owner.pid);
      return { stopped: true, reason: "killed" };
    },

    async bindFolder(kind, chatId, folder) {
      const key = chatKey({ kind, chatId });
      return store.bindFolder(key, folder);
    }
  };
}
