import { createAssistantControl } from "./assistant-control.mjs";
import { createBind } from "./bind.mjs";
import { HEARTBEAT_MS } from "./paths.mjs";

function notify(ctx, text, level = "info") {
  ctx.ui?.notify?.(text, level);
}

function parseArgs(args) {
  return String(args ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const STATUS_TEXT = {
  unbound: "未绑定",
  starting: "启动中",
  online: "在线",
  offline: "离线",
};

export function maskedInput(ctx, title) {
  if (typeof ctx?.ui?.custom !== "function") return Promise.resolve(null);
  return ctx.ui.custom((tui, _theme, _keybindings, done) => {
    let value = "";
    return {
      render() {
        return [title, `> ${"•".repeat([...value].length)}`];
      },
      handleInput(data) {
        if (data === "\u001b") return done(null);
        if (data === "\r" || data === "\n") return done(value);
        if (data === "\u007f" || data === "\b") {
          value = [...value].slice(0, -1).join("");
        } else if (
          data &&
          ![...data].some((character) => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127 || (code >= 128 && code <= 159);
          })
        ) {
          value += data;
        }
        tui.requestRender();
      },
      invalidate() {},
    };
  });
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
  return [
    `飞书：${STATUS_TEXT[snapshot.presence] ?? snapshot.presence}`,
    `机器人：${bot}`,
    ...(snapshot.lastError
      ? [`最近错误：${snapshot.lastError.message}（${snapshot.lastError.code}）`]
      : []),
    "清单：",
    chats,
  ].join("\n");
}

export default function createFeishuExtension(pi, { bind, assistant } = {}) {
  const homeBind = bind ?? createBind();
  const control =
    assistant ?? createAssistantControl(homeBind.store.home, { bind: homeBind });
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
    ctx.ui?.setStatus?.(
      "pi-im-feishu",
      `飞书${STATUS_TEXT[snapshot.presence] ?? snapshot.presence}`,
    );
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
      const sideEffect = new Set([
        "setup",
        "start",
        "stop",
        "folder",
        "attach",
      ]);
      if (sideEffect.has(cmd) && !(ctx.hasUI && ctx.mode === "tui")) {
        notify(ctx, "这个命令只能在 Pi TUI 中运行。", "warning");
        return;
      }
      try {
        if (cmd === "setup") {
          const mode = tokens[1];
          if (mode === "qr") {
            const candidate = await homeBind.qrCandidate({
              onQRCodeReady: (info) => {
                notify(
                  ctx,
                  `请扫码（${info.expireIn} 秒后过期）：\n${info.url}`,
                );
              },
            });
            const result = await control.rebind(candidate);
            notify(
              ctx,
              result.status === "online"
                ? "飞书已绑定并在线。"
                : "飞书绑定后未上线。",
              result.status === "online" ? "info" : "warning",
            );
            return;
          }
          if (mode === "manual") {
            const appId = tokens[2];
            const domain = tokens[3] || "feishu";
            if (!appId || !["feishu", "lark"].includes(domain)) {
              notify(
                ctx,
                "用法：/feishu setup manual <appId> [feishu|lark]",
                "warning",
              );
              return;
            }
            const appSecret = await maskedInput(ctx, "请输入 App Secret");
            if (appSecret === null) {
              notify(ctx, "已取消绑定。", "warning");
              return;
            }
            const result = await control.rebind({ appId, appSecret, domain });
            notify(
              ctx,
              result.status === "online"
                ? "飞书已绑定并在线。"
                : "飞书绑定后未上线。",
              result.status === "online" ? "info" : "warning",
            );
            return;
          }
          notify(
            ctx,
            "用法：/feishu setup qr  或  /feishu setup manual <appId> [feishu|lark]",
            "warning",
          );
          return;
        }
        if (cmd === "start") {
          const result = await control.start();
          notify(
            ctx,
            result.status === "online" ? "飞书在线。" : "飞书未上线。",
            result.status === "online" ? "info" : "warning",
          );
          return;
        }
        if (cmd === "stop") {
          const result = await control.stop();
          notify(
            ctx,
            result.autostart.error
              ? `飞书已离线；自动启动处理失败：${result.autostart.error.message}`
              : "飞书离线。",
            result.autostart.error ? "warning" : "info",
          );
          return;
        }
        if (cmd === "status" || cmd === "chats") {
          notify(ctx, formatSnapshot(await control.snapshot()));
          return;
        }
        if (cmd === "folder") {
          const key = tokens[1];
          const folder = tokens.slice(2).join(" ");
          if (!key || !folder) {
            notify(
              ctx,
              "用法：/feishu folder <chat-key> <绝对路径>",
              "warning",
            );
            return;
          }
          await control.bindFolder(key, folder);
          notify(ctx, `已为 ${key} 绑定文件夹。`);
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
