import qrcode from "qrcode-terminal";
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

const QR_SETUP = "扫码自动创建飞书助手";
const MANUAL_SETUP = "手动填写已有应用";
const FEISHU_DOMAIN = "Feishu 中国";
const LARK_DOMAIN = "Lark 国际";

const KITTY_CSI_U =
  /^\u001b\[(\d+)(?::(\d*))?(?::\d+)?(?:;(\d+))?(?::\d+)?u$/;
const KITTY_KEYPAD_CHARACTERS = new Map([
  ...Array.from({ length: 10 }, (_, digit) => [57399 + digit, 48 + digit]),
  [57409, 46],
  [57410, 47],
  [57411, 42],
  [57412, 45],
  [57413, 43],
  [57415, 61],
  [57416, 44],
]);

function decodeKittyPrintable(data) {
  const match = data.match(KITTY_CSI_U);
  if (!match) return undefined;
  const codepoint = Number.parseInt(match[1], 10);
  const shifted = match[2] ? Number.parseInt(match[2], 10) : undefined;
  const modifier = (match[3] ? Number.parseInt(match[3], 10) : 1) - 1;
  const allowedModifiers = 1 | 64 | 128;
  if (
    !Number.isFinite(codepoint) ||
    !Number.isFinite(modifier) ||
    (modifier & ~allowedModifiers) !== 0 ||
    (modifier & (2 | 4)) !== 0
  ) {
    return undefined;
  }
  const selected = modifier & 1 && Number.isFinite(shifted) ? shifted : codepoint;
  const normalized = KITTY_KEYPAD_CHARACTERS.get(selected) ?? selected;
  if (!Number.isFinite(normalized) || normalized < 32) return undefined;
  try {
    return String.fromCodePoint(normalized);
  } catch {
    return undefined;
  }
}

function isPrintable(value) {
  return ![...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || (code >= 128 && code <= 159);
  });
}

function cleanPaste(value) {
  return value
    .replace(/\r\n/g, "")
    .replace(/[\r\n]/g, "")
    .replace(/\t/g, "    ");
}

function qrText(url) {
  let output = "";
  qrcode.generate(url, { small: true }, (value) => {
    output = value.trimEnd();
  });
  return output;
}

function wrapLine(line, width) {
  const size = Math.max(1, width);
  const characters = [...line];
  const lines = [];
  for (let index = 0; index < characters.length; index += size) {
    lines.push(characters.slice(index, index + size).join(""));
  }
  return lines.length ? lines : [""];
}

function terminalLink(url) {
  const safe = String(url).replace(/[\u0000-\u001f\u007f]/g, "");
  return `\u001b]8;;${safe}\u001b\\打开授权链接\u001b]8;;\u001b\\`;
}

function showQrPanel(ctx, info, onCancel) {
  let close = () => {};
  const qr = qrText(info.url);
  const result = ctx.ui.custom((_tui, _theme, keybindings, done) => {
    let closed = false;
    close = (value = null) => {
      if (closed) return;
      closed = true;
      done(value);
    };
    return {
      render(width) {
        const beforeLink = [
          "扫描二维码创建 Feishu/Lark 应用",
          "",
          ...qr.split("\n"),
          "",
        ].flatMap((line) => wrapLine(line, width));
        const afterLink = [
          info.url,
          `约 ${info.expireIn} 秒后过期 · Esc 取消`,
        ].flatMap((line) => wrapLine(line, width));
        return [...beforeLink, terminalLink(info.url), ...afterLink];
      },
      handleInput(data) {
        if (!keybindings.matches(data, "tui.select.cancel")) return;
        onCancel();
        close("cancelled");
      },
      invalidate() {},
    };
  });
  result.catch(() => {});
  return { close };
}

export function maskedInput(ctx, title) {
  if (typeof ctx?.ui?.custom !== "function") return Promise.resolve(null);
  return ctx.ui.custom((tui, _theme, keybindings, done) => {
    let value = "";
    let pasteBuffer = null;
    return {
      render() {
        return [title, `> ${"•".repeat([...value].length)}`];
      },
      handleInput(data) {
        const pasteStart = data.indexOf("\u001b[200~");
        if (pasteStart !== -1) {
          pasteBuffer = "";
          data = data.slice(pasteStart + 6);
        }
        if (pasteBuffer !== null) {
          pasteBuffer += data;
          const pasteEnd = pasteBuffer.indexOf("\u001b[201~");
          if (pasteEnd === -1) return;
          const pasted = cleanPaste(pasteBuffer.slice(0, pasteEnd));
          if (isPrintable(pasted)) value += pasted;
          const remaining = pasteBuffer.slice(pasteEnd + 6);
          pasteBuffer = null;
          if (remaining) this.handleInput(remaining);
          tui.requestRender();
          return;
        }
        if (keybindings.matches(data, "tui.select.cancel")) return done(null);
        if (keybindings.matches(data, "tui.input.submit") || data === "\n") {
          return done(value);
        }
        if (keybindings.matches(data, "tui.editor.deleteCharBackward")) {
          value = [...value].slice(0, -1).join("");
        } else {
          const kittyPrintable = decodeKittyPrintable(data);
          if (kittyPrintable !== undefined) value += kittyPrintable;
          else if (data && isPrintable(data)) value += data;
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
      ? [
          `最近错误：${snapshot.lastError.message}（${snapshot.lastError.code}）`,
        ]
      : []),
    "清单：",
    chats,
  ].join("\n");
}

export default function createFeishuExtension(pi, { bind, assistant } = {}) {
  const homeBind = bind ?? createBind();
  const control =
    assistant ??
    createAssistantControl(homeBind.store.home, { bind: homeBind });
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
          if (tokens.length > 1) {
            notify(ctx, "直接执行 /feishu setup 即可。", "warning");
            return;
          }
          const snapshot = await control.snapshot();
          if (
            snapshot.configured &&
            !(await ctx.ui.confirm(
              "重新绑定飞书？",
              "当前助手会停止，扫码或手动验证成功后再切换到新应用。",
              { initialValue: false },
            ))
          ) {
            notify(ctx, "已保留当前绑定。");
            return;
          }
          const selected = await ctx.ui.select(
            "选择绑定方式",
            [QR_SETUP, MANUAL_SETUP],
            { initialValue: QR_SETUP },
          );
          if (!selected) {
            notify(ctx, "已取消绑定。", "warning");
            return;
          }

          let candidate;
          if (selected === QR_SETUP) {
            const controller = new AbortController();
            let panel;
            try {
              candidate = await homeBind.qrCandidate({
                signal: controller.signal,
                onQRCodeReady: (info) => {
                  panel = showQrPanel(ctx, info, () => controller.abort());
                },
                onStatusChange: (info) => {
                  if (info?.status === "domain_switched") {
                    notify(ctx, "检测到 Lark 租户，正在切换区域。");
                  }
                },
              });
            } catch (error) {
              panel?.close();
              if (error?.code === "abort") {
                notify(ctx, "已取消绑定。", "warning");
                return;
              }
              if (error?.code === "expired_token") {
                notify(ctx, "二维码已过期，请重新执行 /feishu setup。", "warning");
                return;
              }
              throw error;
            }
            panel?.close("complete");
          } else {
            const region = await ctx.ui.select(
              "选择应用区域",
              [FEISHU_DOMAIN, LARK_DOMAIN],
              { initialValue: FEISHU_DOMAIN },
            );
            if (!region) {
              notify(ctx, "已取消绑定。", "warning");
              return;
            }
            const appId = String(
              (await ctx.ui.input("请输入 App ID", "")) ?? "",
            ).trim();
            if (!appId) {
              notify(ctx, "App ID 不能为空。", "warning");
              return;
            }
            const appSecret = await maskedInput(ctx, "请输入 App Secret");
            if (appSecret === null) {
              notify(ctx, "已取消绑定。", "warning");
              return;
            }
            candidate = {
              appId,
              appSecret,
              domain: region === LARK_DOMAIN ? "lark" : "feishu",
            };
          }

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
