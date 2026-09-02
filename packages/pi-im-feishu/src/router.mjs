import { parseFeishuCommand } from "./commands.mjs";
import { parseInbound } from "./inbound.mjs";
import { titleForChat } from "./store.mjs";

const FOLDER_HINT =
  "先给这条聊天选一个文件夹。发送「换文件夹 /绝对路径」，或在电脑 Pi 里执行：/feishu folder {key} /绝对路径";
const RECEIVED_HINT =
  "已收到，这条聊天会记在电脑的在线清单里。改代码要等绑定文件夹之后。";

export function folderHint(inbound) {
  return FOLDER_HINT.replace("{key}", inbound.key);
}

export function shouldAccept(inbound) {
  if (!inbound) return false;
  if (inbound.kind === "p2p") return true;
  return inbound.mentioned === true;
}

export function createRouter({ store, send, botOpenId, work, onMessage } = {}) {
  return {
    async accept(event) {
      const inbound = parseInbound(event, { botOpenId });
      if (!inbound) return { action: "ignored" };
      if (!shouldAccept(inbound)) return { action: "filtered" };
      const confirmation = onMessage?.(inbound);
      if (confirmation !== undefined && confirmation !== null) {
        return { action: "confirm", decision: confirmation };
      }
      if (!(await store.claimDelivery(inbound.key, inbound.messageId))) {
        return { action: "duplicate" };
      }

      try {
        await store.upsertChat(inbound.key, {
          title: titleForChat(inbound.key),
          lastMessageId: inbound.messageId,
          lastInbound: inbound.text || null,
        });
        const chat = await store.getChat(inbound.key);
        const command = parseFeishuCommand(inbound.text);
        let response;
        if (!chat?.folder && !command) {
          await send?.({
            chatId: inbound.chatId,
            text: folderHint(inbound),
            inbound,
          });
          response = { action: "need-folder", inbound };
        } else if (typeof work === "function") {
          const result = await work({ inbound, chat });
          const text = result?.text;
          if (text) await send?.({ chatId: inbound.chatId, text, inbound });
          const patch = {
            ...(result?.sessionFile !== undefined
              ? { sessionFile: result.sessionFile }
              : {}),
            ...result?.patch,
          };
          if (Object.keys(patch).length) {
            await store.upsertChat(inbound.key, patch);
          }
          if (result?.files?.length) {
            await send?.({
              chatId: inbound.chatId,
              files: result.files,
              inbound,
            });
          }
          response = { action: "work", inbound, result };
        } else {
          await send?.({
            chatId: inbound.chatId,
            text: RECEIVED_HINT,
            inbound,
          });
          response = { action: "received", inbound };
        }
        await store.completeDelivery(inbound.key, inbound.messageId);
        return response;
      } catch (error) {
        await store.releaseDelivery(inbound.key, inbound.messageId);
        throw error;
      }
    },
  };
}
