import { createAssistantControl } from "./assistant-control.mjs";
import { createBind } from "./bind.mjs";
import { HEARTBEAT_MS } from "./paths.mjs";
import { chatKey } from "./store.mjs";

function notify(ctx, text, level = "info") {
  ctx.ui?.notify?.(text, level);
}

function parseArgs(args) {
  return String(args ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function formatSnapshot(snapshot) {
  const bot = snapshot.bot
    ? `${snapshot.bot.domain} ${snapshot.bot.appIdMasked}`
    : "未绑定";
  const chats = snapshot.chats?.length
    ? snapshot.chats
        .map(
          (chat) =>
            `- ${chat.title} (${chat.key})\n  ${chat.folder ?? "未选择文件夹"}`,
        )
        .join("\n")
    : "- 还没有飞书聊天";
  return [`飞书：${snapshot.presence}`, `机器人：${bot}`, "清单：", chats].join(
    "\n",
  );
}

export default function createFeishuExtension(pi, { bind, assistant } = {}) {
  const homeBind = bind ?? createBind();
  const control = assistant ?? createAssistantControl(homeBind.store.home);
  let heartbeatTimer;
  let windowLease;

  function currentSessionFile(ctx) {
    return ctx?.sessionManager?.getSessionFile?.() ?? null;
  }

  pi.on("session_start", async (_event, ctx) => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
    windowLease = undefined;
    const sessionFile = currentSessionFile(ctx);
    const chat = await control.store?.findChatBySession?.(sessionFile);
    const lease = chat ? await control.store.readOwnership(chat.key) : null;
    if (
      chat &&
      lease?.owner === "window" &&
      lease.state === "owned" &&
      lease.pid === process.pid &&
      lease.sessionFile === sessionFile &&
      (await control.heartbeatWindow(chat.key, lease.requestId, process.pid))
    ) {
      windowLease = {
        key: chat.key,
        requestId: lease.requestId,
        pid: process.pid,
        sessionFile,
      };
      heartbeatTimer = setInterval(() => {
        control
          .heartbeatWindow(chat.key, lease.requestId, process.pid)
          .catch(() => {});
      }, HEARTBEAT_MS);
    }
    const snapshot = await control.snapshot();
    const text = !snapshot.configured
      ? "飞书未绑定"
      : snapshot.presence === "online"
        ? "飞书在线"
        : "飞书离线";
    ctx.ui?.setStatus?.("pi-im-feishu", text);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
    const lease = windowLease;
    windowLease = undefined;
    if (!lease || currentSessionFile(ctx) !== lease.sessionFile) return;
    await control.releaseWindow(
      lease.key,
      lease.requestId,
      lease.pid,
      lease.sessionFile,
    );
  });

  pi.registerCommand("feishu", {
    description: "飞书：接入、在线、清单、文件夹、贴上说明",
    handler: async (args, ctx) => {
      const tokens = parseArgs(args);
      const cmd = tokens[0] || "status";
      try {
        if (cmd === "setup") {
          const mode = tokens[1];
          if (mode === "qr") {
            await homeBind.bindQr({
              onQRCodeReady: (info) => {
                notify(
                  ctx,
                  `请扫码（${info.expireIn} 秒后过期）：\n${info.url}`,
                );
              },
            });
            const started = await control.start();
            notify(
              ctx,
              started.started
                ? "飞书已绑定并在线。"
                : "飞书已绑定，助手已在线。",
            );
            return;
          }
          if (mode === "manual") {
            const appId = tokens[2];
            const appSecret = tokens[3];
            const domain = tokens[4] || "feishu";
            if (!appId || !appSecret) {
              notify(
                ctx,
                "用法：/feishu setup manual <appId> <appSecret> [feishu|lark]",
                "warning",
              );
              return;
            }
            await homeBind.bindManual({ appId, appSecret, domain });
            const started = await control.start();
            notify(
              ctx,
              started.started
                ? "飞书已绑定并在线。"
                : "飞书已绑定，助手已在线。",
            );
            return;
          }
          notify(
            ctx,
            "用法：/feishu setup qr  或  /feishu setup manual <appId> <appSecret> [feishu|lark]",
            "warning",
          );
          return;
        }
        if (cmd === "start") {
          const result = await control.start();
          notify(ctx, result.started ? "飞书在线。" : "飞书已在线。");
          return;
        }
        if (cmd === "stop") {
          const result = await control.stop();
          notify(ctx, result.stopped ? "飞书离线。" : "飞书已是离线。");
          return;
        }
        if (cmd === "status" || cmd === "chats") {
          notify(ctx, formatSnapshot(await control.snapshot()));
          return;
        }
        if (cmd === "folder") {
          const kind = tokens[1];
          const id = tokens[2];
          const folder = tokens[3];
          if (!kind || !id || !folder) {
            notify(
              ctx,
              "用法：/feishu folder <p2p|group> <chatId> <绝对路径>",
              "warning",
            );
            return;
          }
          await control.bindFolder(kind, id, folder);
          notify(ctx, `已为 ${chatKey({ kind, chatId: id })} 绑定文件夹。`);
          return;
        }
        if (cmd === "attach") {
          const key = tokens[1];
          if (!key) {
            notify(ctx, "用法：/feishu attach <chat-key>", "warning");
            return;
          }
          const decision = await control.attach(key, ctx.cwd, process.pid);
          notify(ctx, decision.message, decision.ok ? "info" : "warning");
          if (!decision.ok) return;
          try {
            await ctx.switchSession(decision.sessionFile);
          } catch (error) {
            await control.releaseWindow(
              key,
              decision.requestId,
              process.pid,
              decision.sessionFile,
            );
            throw error;
          }
          return;
        }
        notify(
          ctx,
          "命令：/feishu setup | start | stop | status | chats | folder | attach",
          "info",
        );
      } catch (error) {
        notify(
          ctx,
          error instanceof Error ? error.message : String(error),
          "error",
        );
      }
    },
  });
}
