import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runAssistant } from "../src/assistant.mjs";
import { createAssistantControl } from "../src/assistant-control.mjs";
import { createAutostart } from "../src/autostart.mjs";
import { createBind } from "../src/bind.mjs";
import createFeishuExtension from "../src/tui.mjs";

test("extension registers /feishu and does not start sockets in the factory", () => {
  const commands = [];
  const hooks = [];
  createFeishuExtension({
    registerCommand(name, options) {
      commands.push({ name, description: options.description });
    },
    on(name, handler) {
      hooks.push({ name, handler });
    }
  });
  assert.deepEqual(commands.map((item) => item.name), ["feishu"]);
  assert.ok(hooks.some((hook) => hook.name === "session_start"));
  assert.ok(hooks.some((hook) => hook.name === "session_shutdown"));
});

test("session_shutdown does not stop the assistant", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-tui-"));
  const bind = createBind(home);
  await bind.store.bindBot({ appId: "cli_abcdefghijklmn", appSecret: "super-secret-value" });
  const control = createAssistantControl(home, {
    autostart: createAutostart(),
    runner: async ({ store, lock }) => runAssistant({
      home,
      store,
      lock,
      transport: {
        isReady: () => true,
        async start() {},
        async stop() {},
        async send() {}
      },
      handleSignals: false
    })
  });
  await control.start();
  const hooks = new Map();
  createFeishuExtension({
    registerCommand() {},
    on(name, handler) {
      hooks.set(name, handler);
    }
  }, { bind, assistant: control });
  await hooks.get("session_shutdown")();
  assert.equal((await control.snapshot()).presence, "online");
  await control.stop();
});
