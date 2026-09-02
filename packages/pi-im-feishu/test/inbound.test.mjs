import assert from "node:assert/strict";
import test from "node:test";
import { parseInbound } from "../src/inbound.mjs";

function textEvent({
  chatType,
  chatId,
  text,
  mentions = [],
  threadId,
  rootId,
  senderType = "user",
  sender = "ou_user",
}) {
  return {
    sender: { sender_type: senderType, sender_id: { open_id: sender } },
    message: {
      message_id: "om_1",
      chat_id: chatId,
      chat_type: chatType,
      message_type: "text",
      thread_id: threadId,
      root_id: rootId,
      mentions,
      content: JSON.stringify({ text }),
    },
  };
}

test("parses p2p, group, and topic keys", () => {
  assert.equal(
    parseInbound(textEvent({ chatType: "p2p", chatId: "oc_dm", text: "hi" }))
      .key,
    "p2p:oc_dm",
  );
  const group = parseInbound(
    textEvent({
      chatType: "group",
      chatId: "oc_g",
      text: "@_user_1 看下",
      mentions: [{ key: "@_user_1", id: { open_id: "ou_bot" } }],
    }),
    { botOpenId: "ou_bot" },
  );
  assert.equal(group.key, "group:oc_g");
  assert.equal(group.mentioned, true);
  const topic = parseInbound(
    textEvent({
      chatType: "group",
      chatId: "oc_g",
      threadId: "omt_thread",
      rootId: "om_root",
      text: "话题",
    }),
  );
  assert.equal(topic.key, "topic:oc_g:omt_thread");
  assert.equal(topic.rootId, "om_root");
  assert.equal(topic.threadId, "omt_thread");
});

test("keeps ordinary group replies in the group session", () => {
  const reply = parseInbound(
    textEvent({
      chatType: "group",
      chatId: "oc_g",
      rootId: "om_root",
      text: "普通回复",
    }),
  );
  assert.equal(reply.key, "group:oc_g");
  assert.equal(reply.kind, "group");
  assert.equal(reply.rootId, "om_root");
  assert.equal(reply.threadId, null);
});

test("rejects an arbitrary group mention without configured bot identity", () => {
  const inbound = parseInbound(
    textEvent({
      chatType: "group",
      chatId: "oc_g",
      text: "@_user hi",
      mentions: [{ key: "@_user", id: { open_id: "ou_someone" } }],
    }),
    {},
  );
  assert.equal(inbound.mentioned, false);
});

test("records sender identity", () => {
  const inbound = parseInbound(
    textEvent({
      chatType: "p2p",
      chatId: "oc_dm",
      text: "hi",
      sender: "ou_requester",
    }),
    { botOpenId: "ou_bot" },
  );
  assert.equal(inbound.senderOpenId, "ou_requester");
  assert.equal(inbound.senderType, "user");
});

test("ignores bot senders", () => {
  assert.equal(
    parseInbound(
      textEvent({
        chatType: "p2p",
        chatId: "oc_dm",
        text: "loop",
        senderType: "app",
      }),
    ),
    null,
  );
});
