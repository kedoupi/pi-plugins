import { createLock } from "./lock.mjs";
import { HEARTBEAT_MS, defaultHome } from "./paths.mjs";
import { createStore } from "./store.mjs";
import { createRouter } from "./router.mjs";
import { createFeishuTransport, loadLarkSdk } from "./feishu-transport.mjs";
import { HELP_TEXT } from "./commands.mjs";
import { createConfirmWait } from "./confirm-wait.mjs";
import { stageInboundFiles } from "./files.mjs";
import { createOwnership } from "./ownership.mjs";
import { createWork } from "./work.mjs";
import { createPiRunPrompt, loadPiSdk } from "./pi-session.mjs";

export async function runAssistant({
  home = defaultHome(),
  store = createStore(home),
  lock = createLock(home),
  transport,
  connect,
  runPrompt,
  confirm,
  download,
  logger = console,
  handleSignals = false,
  loadSdk = loadPiSdk,
  createRunner = createPiRunPrompt,
} = {}) {
  const credentials = await store.loadCredentials();
  if (!credentials) {
    throw Object.assign(new Error("这台电脑还没有绑定飞书。"), { code: "not-configured" });
  }

  await lock.acquire({ appId: credentials.appId });

  let timer;
  let activeTransport = transport ?? null;
  let promptRunner = runPrompt;
  let closed = false;
  let signalHandler;
  async function shutdown() {
    if (closed) return;
    closed = true;
    if (timer) clearInterval(timer);
    if (signalHandler) {
      process.off("SIGTERM", signalHandler);
      process.off("SIGINT", signalHandler);
    }
    try {
      await promptRunner?.dispose?.();
    } catch {}
    try {
      await activeTransport?.stop?.();
    } catch (error) {
      logger.error?.(error);
    }
    try {
      await lock.release();
    } catch {}
  }

  try {
    if (typeof promptRunner !== "function") {
      const pi = await loadSdk();
      promptRunner = createRunner(pi, { secrets: [credentials.appSecret] });
    }
    if (typeof promptRunner !== "function") {
      throw Object.assign(new Error("Pi 会话运行器不可用，飞书助手无法上线。"), {
        code: "pi-session-unavailable",
      });
    }

    const ownership = createOwnership();
    const confirmWait = createConfirmWait((payload) => activeTransport?.send?.(payload));
    const worker = createWork({
      runPrompt: promptRunner,
      confirm: confirm ?? ((request) => confirmWait.ask(request)),
    });
    const router = createRouter({
      store,
      send: (payload) => activeTransport?.send?.(payload),
      onMessage: (inbound) => confirmWait.take(inbound.key, inbound.text),
      work: async (payload) => {
        if (!ownership.canAssistantWrite(payload.inbound.key)) {
          return { text: "这条对话正在电脑窗口里打开，飞书侧暂停改代码。关掉窗口后再说。" };
        }
        if (payload.inbound.files?.length && payload.chat.folder) {
          await stageInboundFiles(payload.chat.folder, payload.inbound.files, {
            download: download ?? ((file) => activeTransport?.download?.(file)),
          });
        }
        const result = await worker.work(payload);
        if (result?.patch && !payload.chat.sessionFile && result.patch.sessionFile === null) {
          return { ...result, text: result.text };
        }
        return result;
      },
    });

    if (handleSignals) {
      signalHandler = () => shutdown().finally(() => process.exit(0));
      process.on("SIGTERM", signalHandler);
      process.on("SIGINT", signalHandler);
    }

    if (!activeTransport) {
      if (typeof connect === "function") {
        activeTransport = await connect({ credentials, router });
      } else {
        const lark = await loadLarkSdk();
        if (!lark) {
          throw Object.assign(new Error("飞书 SDK 未安装，无法上线。"), {
            code: "sdk-missing",
          });
        }
        activeTransport = createFeishuTransport({
          lark,
          credentials,
          onMessage: (event) => router.accept(event),
          logger,
        });
      }
    }

    await activeTransport.start?.();
    const ready = typeof activeTransport.isReady === "function"
      ? activeTransport.isReady()
      : true;
    if (!ready) {
      throw Object.assign(new Error("飞书长连接未接通，不能显示在线。可能被其它客户端占用。"), {
        code: "ws-not-ready",
      });
    }

    await lock.heartbeat("online");
    timer = setInterval(() => {
      lock.heartbeat("online").catch(async (error) => {
        logger.error?.(error);
        await shutdown();
        if (handleSignals) process.exit(1);
      });
    }, HEARTBEAT_MS);

    return {
      store,
      lock,
      router,
      transport: activeTransport,
      ownership,
      help: HELP_TEXT,
      shutdown,
    };
  } catch (error) {
    await shutdown();
    throw error;
  }
}
