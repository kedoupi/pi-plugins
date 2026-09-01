import { inboundFiles } from "./files.mjs";
import { chatKey } from "./store.mjs";

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function payload(event) {
  if (!event || typeof event !== "object") return {};
  if (event.message && typeof event.message === "object") return event;
  if (event.event?.message && typeof event.event.message === "object")
    return event.event;
  return event;
}

function parsedContent(message) {
  const value = message?.content;
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function withoutMentions(text, mentions) {
  let result = typeof text === "string" ? text : "";
  for (const mention of Array.isArray(mentions) ? mentions : []) {
    if (typeof mention?.key === "string" && mention.key)
      result = result.replaceAll(mention.key, "");
  }
  return result.replace(/\s+/g, " ").trim();
}

function mentionOpenIds(mentions) {
  return (Array.isArray(mentions) ? mentions : [])
    .map(
      (mention) => nonEmpty(mention?.id?.open_id) ?? nonEmpty(mention?.open_id),
    )
    .filter(Boolean);
}

export function isBotSender(event, botOpenId) {
  const sender = payload(event).sender;
  if (sender?.sender_type === "app") return true;
  const openId = nonEmpty(sender?.sender_id?.open_id);
  return Boolean(botOpenId && openId && openId === botOpenId);
}

export function isMentioned(event, botOpenId) {
  if (!nonEmpty(botOpenId)) return false;
  return mentionOpenIds(payload(event).message?.mentions ?? []).includes(
    botOpenId.trim(),
  );
}

export function parseInbound(event, { botOpenId } = {}) {
  const body = payload(event);
  const message = body.message;
  if (!message || typeof message !== "object") return null;
  if (isBotSender(event, botOpenId)) return null;
  const messageId = nonEmpty(message.message_id);
  const chatId = nonEmpty(message.chat_id);
  if (!messageId || !chatId) return null;
  const rootId = nonEmpty(message.root_id);
  const threadId = nonEmpty(message.thread_id) ?? rootId;
  const senderOpenId = nonEmpty(body.sender?.sender_id?.open_id);
  const senderType = nonEmpty(body.sender?.sender_type);
  let kind;
  if (message.chat_type === "p2p") kind = "p2p";
  else if (threadId) kind = "topic";
  else if (message.chat_type === "group") kind = "group";
  else return null;
  const key =
    kind === "topic"
      ? chatKey({ kind, chatId, threadId })
      : chatKey({ kind, chatId });
  const content = parsedContent(message);
  const text =
    message.message_type === "text"
      ? withoutMentions(content?.text, message.mentions)
      : "";
  return {
    key,
    kind,
    chatId,
    threadId: kind === "topic" ? threadId : null,
    rootId,
    messageId,
    senderOpenId,
    senderType,
    text,
    mentioned:
      message.chat_type === "p2p" ? true : isMentioned(event, botOpenId),
    files: inboundFiles(event).map((file) => ({ ...file, messageId })),
  };
}
