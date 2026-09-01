import assert from "node:assert/strict";
import test from "node:test";
import { createFeishuTransport } from "../src/feishu-transport.mjs";

function fakeLark({ emitReady = true, emitError = false } = {}) {
  const sent = [];
  return {
    Domain: { Feishu: "feishu", Lark: "lark" },
    LoggerLevel: { error: "error" },
    Client: class {
      constructor() {
        this.im = {
          v1: {
            message: { create: async (payload) => sent.push(payload) },
            file: { create: async () => ({ data: { file_key: "fk" } }) },
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
      }
      async start() {
        if (emitReady) queueMicrotask(() => this.options.onReady?.());
        if (emitError) queueMicrotask(() => this.options.onError?.(new Error("boom")));
      }
      async stop() {}
    },
    sent
  };
}

test("start waits for onReady and does not mark ready after start() alone", async () => {
  const lark = fakeLark({ emitReady: true });
  const transport = createFeishuTransport({
    lark,
    credentials: { appId: "cli_abcdefghijklmn", appSecret: "super-secret-value" },
    onMessage: async () => {}
  });
  await transport.start();
  assert.equal(transport.isReady(), true);
});

test("start fails when onReady never fires", async () => {
  const lark = fakeLark({ emitReady: false });
  const transport = createFeishuTransport({
    lark,
    credentials: { appId: "cli_abcdefghijklmn", appSecret: "super-secret-value" },
    readyTimeoutMs: 20
  });
  await assert.rejects(() => transport.start(), (error) => error.code === "ws-not-ready");
});
