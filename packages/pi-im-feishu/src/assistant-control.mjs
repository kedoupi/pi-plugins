import { spawn } from "node:child_process";
import { open, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createBind } from "./bind.mjs";
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
import { createStore } from "./store.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAssistantControl(
  home = defaultHome(),
  {
    autostart,
    runner,
    pid = process.pid,
    lock: providedLock,
    store: providedStore,
    bind,
    processKill = process.kill,
  } = {},
) {
  const lock = providedLock ?? createLock(home);
  const store = providedStore ?? createStore(home);
  const binding = bind ?? createBind(home);
  const auto = autostart ?? macosAutostart(home);
  const ownership = createOwnershipCoordinator({ store, pid });
  let inProcess = null;

  async function recordError(error, secrets = []) {
    let message = error instanceof Error ? error.message : String(error);
    for (const secret of secrets) {
      if (typeof secret === "string" && secret) {
        message = message.replaceAll(secret, "[已隐藏]");
      }
    }
    return store.setLastError({
      code:
        typeof error?.code === "string" && error.code
          ? error.code
          : "unknown",
      message,
    });
  }

  async function resultStatus(autostartStatus, extra = {}) {
    const snapshot = await control.snapshot();
    return {
      ...extra,
      status: snapshot.presence,
      autostart: autostartStatus,
      lastError: snapshot.lastError,
    };
  }

  async function waitForOnline(timeoutMs = 4_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const owner = await lock.read();
      if (owner?.status === "online") return owner;
      await sleep(100);
    }
    return lock.read();
  }

  const control = {
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
      await store.updateOwnership(key, (current) => {
        const matchesPending =
          current?.requestId === request.requestId &&
          (current.state === "requested" || current.state === "releasing");
        const matchesGranted =
          current?.owner === "window" &&
          current.state === "owned" &&
          current.pid === windowPid &&
          current.requestId === request.requestId;
        return matchesPending || matchesGranted
          ? {
              ...current,
              owner: "assistant",
              state: "owned",
              pid: assistantOwner?.pid ?? process.pid,
              heartbeatAt: new Date().toISOString(),
            }
          : current;
      });
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
        presence: status.configured ? onlineLabel(owner) : "unbound",
        assistant: owner,
      };
    },

    async start({ timeoutMs = 4_000 } = {}) {
      const credentials = await store.loadCredentials();
      if (!credentials) {
        const error = Object.assign(new Error("请先绑定飞书。"), {
          code: "not-configured",
        });
        await recordError(error);
        throw error;
      }
      const current = await lock.read();
      if (current?.status === "online") {
        return resultStatus(
          { enabled: null, reason: "unchanged" },
          { started: false, reason: "already-running", owner: current },
        );
      }
      await store.setStopped(false);
      let owner;
      try {
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
        owner = await waitForOnline(timeoutMs);
        if (owner?.status !== "online") {
          throw Object.assign(
            new Error("飞书没有上线。请看助手日志；可能被其它客户端占用。"),
            { code: "not-online", owner },
          );
        }
      } catch (error) {
        const lastError = await recordError(error, [credentials.appSecret]);
        Object.assign(error, { status: "offline", lastError });
        throw error;
      }

      let autostartStatus;
      try {
        autostartStatus = await auto.enable();
        await store.setLastError(null);
      } catch (error) {
        const lastError = await recordError(error, [credentials.appSecret]);
        return {
          started: true,
          owner,
          status: "online",
          autostart: { enabled: false, error: lastError },
          lastError,
        };
      }
      return resultStatus(autostartStatus, { started: true, owner });
    },

    async stop() {
      await store.setStopped(true);
      let autostartStatus;
      let autostartError = null;
      try {
        autostartStatus = await auto.disable();
      } catch (error) {
        autostartError = await recordError(error);
        autostartStatus = { enabled: true, error: autostartError };
      }

      let stopped = false;
      let reason = "already-offline";
      if (inProcess?.shutdown) {
        await inProcess.shutdown();
        inProcess = null;
        stopped = true;
        reason = "stopped";
      } else {
        const owner = await lock.read();
        if (owner?.pid === process.pid) {
          await lock.release(owner.pid);
          stopped = true;
          reason = "released-same-process";
        } else if (owner) {
          try {
            processKill(owner.pid, "SIGTERM");
            stopped = true;
            reason = "stopped";
          } catch {
            await lock.release(owner.pid);
            stopped = true;
            reason = "reaped";
          }
          if (await lock.read()) {
            const deadline = Date.now() + HEARTBEAT_MS * 2;
            while (Date.now() < deadline && (await lock.read())) {
              await sleep(50);
            }
            if (await lock.read()) {
              try {
                processKill(owner.pid, "SIGKILL");
              } catch {}
              await lock.release(owner.pid);
              reason = "killed";
            }
          }
        }
      }
      return resultStatus(autostartStatus, {
        stopped,
        reason,
        ...(autostartError ? { lastError: autostartError } : {}),
      });
    },

    async rebind(candidate, options = {}) {
      let verified;
      try {
        verified = await binding.verify(candidate, options);
      } catch (error) {
        await recordError(error, [candidate?.appSecret]);
        throw error;
      }
      const stopped = await control.stop();
      try {
        await binding.writeVerified(verified);
      } catch (error) {
        await recordError(error, [candidate?.appSecret]);
        throw error;
      }
      const started = await control.start(options);
      if (stopped.autostart?.error) {
        await store.setLastError(stopped.autostart.error);
        return { ...started, lastError: stopped.autostart.error };
      }
      return started;
    },

    async bindFolder(key, folder) {
      return store.bindFolder(key, folder);
    },
  };
  return control;
}
