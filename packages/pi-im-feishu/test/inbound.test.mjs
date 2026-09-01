import assert from "node:assert/strict";
import test from "node:test";
import { parseInbound } from "../src/inbound.mjs";

function textEvent({ chatType, chatId, text, mentions = [], threadId, senderType = "user" }) {
  return {
    sender: { sender_type: senderType, sender_id: { open_id: "ou_user" } },
    message: {
      message_id: "om_1",
      chat_id: chatId,
      chat_type: chatType,
      message_type: "text",
      thread_id: threadId,
      mentions,
      content: JSON.stringify({ text })
    }
  };
}

test("parses p2p, group, and topic keys", () => {
  assert.equal(parseInbound(textEvent({ chatType: "p2p", chatId: "oc_dm", text: "hi" })).key, "p2p:oc_dm");
  const group = parseInbound(textEvent({
    chatType: "group",
    chatId: "oc_g",
    text: "@_user_1 看下",
    mentions: [{ key: "@_user_1", id: { open_id: "ou_bot" } }]
  }), { botOpenId: "ou_bot" });
  assert.equal(group.key, "group:oc_g");
  assert.equal(group.mentioned, true);
  assert.equal(parseInbound(textEvent({
    chatType: "group",
    chatId: "oc_g",
    threadId: "om_root",
    text: "话题"
  })).key, "topic:oc_g:om_root");
});

test("ignores bot senders", () => {
  assert.equal(parseInbound(textEvent({
    chatType: "p2p",
    chatId: "oc_dm",
    text: "loop",
    senderType: "app"
  })), null);
});
