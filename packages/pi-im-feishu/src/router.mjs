import { parseInbound } from "./inbound.mjs";
import { titleForChat } from "./store.mjs";

const FOLDER_HINT = "先给这条聊天选一个文件夹。在电脑 Pi 里执行：/feishu folder {kind} {chatId} /绝对路径";
const RECEIVED_HINT = "已收到，这条聊天会记在电脑的在线清单里。改代码要等绑定文件夹之后。";

export function folderHint(inbound) {
  return FOLDER_HINT
    .replace("{kind}", inbound.kind === "topic" ? "group" : inbound.kind)
    .replace("{chatId}", inbound.chatId);
}

export function shouldAccept(inbound) {
  if (!inbound) return false;
  if (inbound.kind === "p2p") return true;
  return inbound.mentioned === true;
}

export function createRouter({ store, send, botOpenId, work, onMessage } = {}) {
  const seen = new Set();
  return {
    async accept(event) {
      const inbound = parseInbound(event, { botOpenId });
      if (inbound && onMessage?.(inbound)) return { action: "confirm" };
      if (!inbound) return { action: "ignored" };
      if (seen.has(inbound.messageId)) return { action: "duplicate" };
      if (!shouldAccept(inbound)) return { action: "filtered" };
      seen.add(inbound.messageId);
      await store.upsertChat(inbound.key, {
        title: titleForChat(inbound.key),
        lastMessageId: inbound.messageId,
        lastInbound: inbound.text || null
      });
      const chat = await store.getChat(inbound.key);
      if (!chat?.folder) {
        await send?.({ chatId: inbound.chatId, text: folderHint(inbound), inbound });
        return { action: "need-folder", inbound };
      }
      if (typeof work === "function") {
        const result = await work({ inbound, chat });
        const text = result?.text;
        if (text) await send?.({ chatId: inbound.chatId, text, inbound });
        if (result?.sessionFile) {
          await store.upsertChat(inbound.key, { sessionFile: result.sessionFile });
        }
        if (result?.patch) await store.upsertChat(inbound.key, result.patch);
        if (result?.files?.length) {
          await send?.({ chatId: inbound.chatId, files: result.files, inbound });
        }
        return { action: "work", inbound, result };
      }
      await send?.({ chatId: inbound.chatId, text: RECEIVED_HINT, inbound });
      return { action: "received", inbound };
    }
  };
}
