import { spawn } from "node:child_process";
import { open, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createAutostart } from "./autostart.mjs";
import { macosAutostart } from "./macos-autostart.mjs";
import { createOwnershipCoordinator } from "./ownership.mjs";
import { createLock, onlineLabel } from "./lock.mjs";
import {
  assistantScriptPath,
  defaultHome,
  HEARTBEAT_MS,
  HOME_ENV,
  logPath,
} from "./paths.mjs";
import { chatKey, createStore } from "./store.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAssistantControl(
  home = defaultHome(),
  { autostart, runner, pid = process.pid } = {},
) {
  const lock = createLock(home);
  const store = createStore(home);
  const auto = autostart ?? macosAutostart(home);
  const ownership = createOwnershipCoordinator({ store, pid });
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

    async attach(key, cwd, windowPid = pid) {
      const chat = await store.getChat(key);
      if (!chat) {
        return {
          ok: false,
          code: "unknown-chat",
          message: "清单里还没有这条飞书聊天。",
        };
      }
      if (!chat.folder) {
        return {
          ok: false,
          code: "folder-missing",
          message: "这条聊天还没有文件夹。",
        };
      }
      if (!chat.sessionFile) {
        return {
          ok: false,
          code: "no-session",
          message: "这条聊天还没有对话。先在飞书里说话。",
        };
      }
      if (chat.folder !== cwd) {
        return {
          ok: false,
          code: "folder-mismatch",
          message: `这段工作在 ${chat.folder}。请到那个目录打开 Pi，或继续用飞书。`,
        };
      }
      try {
        if (!(await stat(chat.sessionFile)).isFile()) throw new Error();
      } catch {
        return {
          ok: false,
          code: "session-missing",
          message: "这条聊天的对话文件不存在，不能贴到窗口。",
        };
      }

      const request = await ownership.requestWindow(key, { pid: windowPid });
      const deadline = Date.now() + 4_000;
      while (Date.now() < deadline) {
        const lease = await store.readOwnership(key);
        if (
          lease?.owner === "window" &&
          lease.state === "owned" &&
          lease.pid === windowPid &&
          lease.requestId === request.requestId
        ) {
          return {
            ok: true,
            code: "attach",
            requestId: request.requestId,
            sessionFile: lease.sessionFile,
            folder: chat.folder,
            message: `窗口可以打开「${chat.title ?? key}」。助手已暂停写入这条对话。关掉窗口后助手会再接手。`,
          };
        }
        await sleep(50);
      }
      const assistantOwner = await lock.read();
      await store.updateOwnership(key, (current) =>
        current?.state === "requested" &&
        current.requestId === request.requestId
          ? {
              ...current,
              owner: "assistant",
              state: "owned",
              pid: assistantOwner?.pid ?? process.pid,
              heartbeatAt: new Date().toISOString(),
            }
          : current,
      );
      return {
        ok: false,
        code: "ownership-timeout",
        message: "助手没有及时交出这条对话，请确认飞书在线后重试。",
      };
    },

    heartbeatWindow(key, requestId, windowPid = pid) {
      return ownership.heartbeatWindow(key, requestId, windowPid);
    },

    releaseWindow(key, requestId, windowPid = pid, sessionFile) {
      return ownership.releaseWindow(key, requestId, windowPid, sessionFile);
    },

    async snapshot() {
      const [status, owner] = await Promise.all([store.status(), lock.read()]);
      return {
        ...status,
        presence: onlineLabel(owner),
        assistant: owner,
      };
    },

    async start() {
      const credentials = await store.loadCredentials();
      if (!credentials) {
        throw Object.assign(new Error("请先绑定飞书。"), {
          code: "not-configured",
        });
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
          const child = spawn(
            process.execPath,
            [fileURLToPath(assistantScriptPath())],
            {
              detached: true,
              stdio: ["ignore", logFile.fd, logFile.fd],
              env: {
                ...process.env,
                [HOME_ENV]: home,
                PI_IM_FEISHU_ASSISTANT: "1",
              },
            },
          );
          child.unref();
        } finally {
          await logFile.close();
        }
      }
      const owner = await waitForOnline();
      if (owner?.status !== "online") {
        throw Object.assign(
          new Error("飞书没有上线。请看助手日志；可能被其它客户端占用。"),
          {
            code: "not-online",
            owner,
          },
        );
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
    },
  };
}
