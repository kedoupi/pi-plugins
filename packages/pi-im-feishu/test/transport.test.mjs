import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFeishuTransport } from "../src/feishu-transport.mjs";

function fakeLark({ emitReady = true, emitError = false } = {}) {
  const createCalls = [];
  const replyCalls = [];
  const fileUploads = [];
  const imageUploads = [];
  const lark = {
    Domain: { Feishu: "feishu", Lark: "lark" },
    LoggerLevel: { error: "error" },
    Client: class {
      constructor() {
        this.im = {
          v1: {
            message: {
              create: async (payload) => createCalls.push(payload),
              reply: async (payload) => replyCalls.push(payload)
            },
            file: {
              create: async (payload) => {
                fileUploads.push(payload);
                return { data: { file_key: "fk" } };
              }
            },
            image: {
              create: async (payload) => {
                imageUploads.push(payload);
                return { data: { image_key: "ik" } };
              }
            },
            messageResource: { get: async () => Buffer.from("bin") }
          }
        };
      }
    },
    EventDispatcher: class {
      register() {
        return this;
      }
    },
    WSClient: class {
      constructor(options) {
        this.options = options;
        lark.wsOptions = options;
      }
      async start() {
        if (emitReady) queueMicrotask(() => this.options.onReady?.());
        if (emitError) queueMicrotask(() => this.options.onError?.(new Error("boom")));
      }
      async stop() {}
    },
    createCalls,
    replyCalls,
    fileUploads,
    imageUploads
  };
  return lark;
}

const credentials = {
  appId: "cli_abcdefghijklmn",
  appSecret: "super-secret-value"
};

const topicInbound = {
  kind: "topic",
  chatId: "oc_topic",
  messageId: "om_topic"
};

test("start waits for onReady and does not mark ready after start() alone", async () => {
  const lark = fakeLark({ emitReady: true });
  const transport = createFeishuTransport({
    lark,
    credentials,
    onMessage: async () => {}
  });
  await transport.start();
  assert.equal(transport.isReady(), true);
});

test("start fails when onReady never fires", async () => {
  const lark = fakeLark({ emitReady: false });
  const transport = createFeishuTransport({
    lark,
    credentials,
    readyTimeoutMs: 20
  });
  await assert.rejects(() => transport.start(), (error) => error.code === "ws-not-ready");
});

test("replies inside a topic", async () => {
  const lark = fakeLark();
  const transport = createFeishuTransport({ lark, credentials });
  await transport.send({ inbound: topicInbound, text: "done" });
  assert.deepEqual(lark.replyCalls[0], {
    path: { message_id: topicInbound.messageId },
    data: {
      msg_type: "text",
      content: JSON.stringify({ text: "done" }),
      reply_in_thread: true
    }
  });
  assert.equal(lark.createCalls.length, 0);
});

test("uploads images through image.create and replies inside a topic", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-image-"));
  const path = join(home, "image.png");
  await writeFile(path, Buffer.from("png"));
  const lark = fakeLark();
  const transport = createFeishuTransport({ lark, credentials });
  await transport.send({ inbound: topicInbound, files: [{ kind: "image", path }] });
  assert.equal(lark.imageUploads.length, 1);
  assert.equal(lark.fileUploads.length, 0);
  assert.deepEqual(lark.replyCalls[0], {
    path: { message_id: topicInbound.messageId },
    data: {
      msg_type: "image",
      content: JSON.stringify({ image_key: "ik" }),
      reply_in_thread: true
    }
  });
});

test("disconnect callbacks clear readiness and notify the owner", async () => {
  const lark = fakeLark();
  const disconnected = [];
  const transport = createFeishuTransport({
    lark,
    credentials,
    onDisconnect: (error) => disconnected.push(error?.message ?? "closed")
  });
  await transport.start();
  lark.wsOptions.onReconnecting?.();
  assert.equal(transport.isReady(), false);
  assert.deepEqual(disconnected, ["closed"]);
  lark.wsOptions.onReconnected?.();
  assert.equal(transport.isReady(), true);
  lark.wsOptions.onError?.(new Error("boom"));
  assert.equal(transport.isReady(), false);
  lark.wsOptions.onReconnected?.();
  lark.wsOptions.onClose?.();
  assert.equal(transport.isReady(), false);
  assert.deepEqual(disconnected, ["closed", "boom", "closed"]);
});
