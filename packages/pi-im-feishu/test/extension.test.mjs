import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runAssistant } from "../src/assistant.mjs";
import { createAssistantControl } from "../src/assistant-control.mjs";
import { createAutostart } from "../src/autostart.mjs";
import { createBind } from "../src/bind.mjs";
import createFeishuExtension, { maskedInput } from "../src/tui.mjs";

test("extension registers /feishu and does not start sockets in the factory", () => {
  const commands = [];
  const hooks = [];
  createFeishuExtension({
    registerCommand(name, options) {
      commands.push({ name, description: options.description });
    },
    on(name, handler) {
      hooks.push({ name, handler });
    },
  });
  assert.deepEqual(
    commands.map((item) => item.name),
    ["feishu"],
  );
  assert.ok(hooks.some((hook) => hook.name === "session_start"));
  assert.ok(hooks.some((hook) => hook.name === "session_shutdown"));
});

test("attach switches sessions only after ownership is granted", async () => {
  const hooks = new Map();
  let handler;
  let grant;
  const waiting = new Promise((resolve) => {
    grant = resolve;
  });
  const switched = [];
  createFeishuExtension(
    {
      registerCommand(_name, options) {
        handler = options.handler;
      },
      on(name, hook) {
        hooks.set(name, hook);
      },
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        async attach() {
          return waiting;
        },
      },
    },
  );

  const running = handler("attach p2p:a", {
    mode: "tui",
    hasUI: true,
    cwd: "/tmp/a",
    async switchSession(sessionFile) {
      switched.push(sessionFile);
    },
    ui: { notify() {} },
  });
  await Promise.resolve();
  assert.deepEqual(switched, []);
  grant({
    ok: true,
    message: "granted",
    sessionFile: "/tmp/a.jsonl",
  });
  await running;
  assert.deepEqual(switched, ["/tmp/a.jsonl"]);
});

test("attach releases its grant when switching fails", async () => {
  let handler;
  const releases = [];
  createFeishuExtension(
    {
      registerCommand(_name, options) {
        handler = options.handler;
      },
      on() {},
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        async attach() {
          return {
            ok: true,
            requestId: "request-a",
            sessionFile: "/tmp/a.jsonl",
            message: "granted",
          };
        },
        async releaseWindow(...args) {
          releases.push(args);
        },
      },
    },
  );
  await handler("attach p2p:a", {
    mode: "tui",
    hasUI: true,
    cwd: "/tmp/a",
    async switchSession() {
      throw new Error("switch failed");
    },
    ui: { notify() {} },
  });
  assert.deepEqual(releases, [
    ["p2p:a", "request-a", process.pid, "/tmp/a.jsonl"],
  ]);
});

test("session lifecycle heartbeats and releases only its matching lease", async () => {
  const hooks = new Map();
  const calls = [];
  const lease = {
    owner: "window",
    state: "owned",
    pid: process.pid,
    requestId: "request-a",
    sessionFile: "/tmp/a.jsonl",
  };
  createFeishuExtension(
    {
      registerCommand() {},
      on(name, hook) {
        hooks.set(name, hook);
      },
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        store: {
          async findChatBySession(sessionFile) {
            return sessionFile === lease.sessionFile ? { key: "p2p:a" } : null;
          },
          async readOwnership() {
            return lease;
          },
        },
        async snapshot() {
          return { configured: false, presence: "offline" };
        },
        async heartbeatWindow(...args) {
          calls.push(["heartbeat", ...args]);
          return true;
        },
        async releaseWindow(...args) {
          calls.push(["release", ...args]);
          return true;
        },
      },
    },
  );
  const context = {
    sessionManager: { getSessionFile: () => "/tmp/a.jsonl" },
    ui: { setStatus() {} },
  };

  await hooks.get("session_start")({}, context);
  await hooks.get("session_shutdown")({}, context);
  assert.deepEqual(calls, [
    ["heartbeat", "p2p:a", "request-a", process.pid],
    ["release", "p2p:a", "request-a", process.pid, "/tmp/a.jsonl"],
  ]);
});

test("session_shutdown does not release a lease for another session", async () => {
  const hooks = new Map();
  let releases = 0;
  createFeishuExtension(
    {
      registerCommand() {},
      on(name, hook) {
        hooks.set(name, hook);
      },
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        store: {
          async findChatBySession() {
            return null;
          },
        },
        async snapshot() {
          return { configured: false, presence: "offline" };
        },
        async releaseWindow() {
          releases += 1;
        },
      },
    },
  );
  const context = {
    sessionManager: { getSessionFile: () => "/tmp/other.jsonl" },
    ui: { setStatus() {} },
  };
  await hooks.get("session_start")({}, context);
  await hooks.get("session_shutdown")({}, context);
  assert.equal(releases, 0);
});

test("commands with side effects refuse non-TUI contexts", async () => {
  let handler;
  const calls = [];
  createFeishuExtension(
    {
      registerCommand(_name, options) {
        handler = options.handler;
      },
      on() {},
    },
    {
      bind: {
        store: { home: "/tmp/unused" },
        async qrCandidate() {
          calls.push("register-qr");
        },
      },
      assistant: new Proxy(
        {},
        {
          get(_target, name) {
            if (name === "store") return undefined;
            return async () => calls.push(String(name));
          },
        },
      ),
    },
  );
  const notifications = [];
  const noUi = {
    mode: "json",
    hasUI: false,
    cwd: "/tmp/a",
    ui: { notify: (message) => notifications.push(message) },
  };
  for (const command of [
    "setup qr",
    "setup manual cli_123 feishu",
    "start",
    "stop",
    "folder topic:chat:thread /tmp/a",
    "attach p2p:a",
  ]) {
    await handler(command, noUi);
  }
  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 6);
  assert.ok(notifications.every((message) => /Pi TUI/.test(message)));
});

test("masked input renders bullets and returns no secret on escape", async () => {
  let rendered;
  const ctx = {
    ui: {
      custom(factory) {
        return new Promise((resolve) => {
          const component = factory({ requestRender() {} }, {}, {}, resolve);
          component.handleInput("secret-value");
          rendered = component.render(80).join("\n");
          component.handleInput("\u007f");
          component.handleInput("\r");
        });
      },
    },
  };
  assert.equal(await maskedInput(ctx, "App Secret"), "secret-valu");
  assert.match(rendered, /App Secret/);
  assert.match(rendered, /••••••••••••/);
  assert.equal(rendered.includes("secret-value"), false);

  ctx.ui.custom = (factory) =>
    new Promise((resolve) => {
      const component = factory({ requestRender() {} }, {}, {}, resolve);
      component.handleInput("do-not-return");
      component.handleInput("\u001b");
    });
  assert.equal(await maskedInput(ctx, "App Secret"), null);
});

test("manual setup obtains the secret only from masked input and rebinds", async () => {
  let handler;
  const candidates = [];
  const notifications = [];
  createFeishuExtension(
    {
      registerCommand(_name, options) {
        handler = options.handler;
      },
      on() {},
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        async rebind(candidate) {
          candidates.push(candidate);
          return {
            started: true,
            status: "online",
            autostart: { enabled: true },
            lastError: null,
          };
        },
      },
    },
  );
  await handler("setup manual cli_1234567890 lark", {
    mode: "tui",
    hasUI: true,
    ui: {
      notify: (message) => notifications.push(message),
      custom: (factory) =>
        new Promise((resolve) => {
          const component = factory({ requestRender() {} }, {}, {}, resolve);
          component.handleInput("secret-value");
          component.handleInput("\r");
        }),
    },
  });
  assert.deepEqual(candidates, [
    {
      appId: "cli_1234567890",
      appSecret: "secret-value",
      domain: "lark",
    },
  ]);
  assert.equal(notifications.join("\n").includes("secret-value"), false);
});

test("status text distinguishes all four states and shows lastError", async () => {
  let handler;
  const notifications = [];
  const states = ["unbound", "starting", "online", "offline"];
  createFeishuExtension(
    {
      registerCommand(_name, options) {
        handler = options.handler;
      },
      on() {},
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        async snapshot() {
          const presence = states.shift();
          return {
            presence,
            bot: null,
            chats: [],
            lastError:
              presence === "offline"
                ? { code: "launchctl", message: "启动失败" }
                : null,
          };
        },
      },
    },
  );
  for (let index = 0; index < 4; index += 1) {
    await handler("status", {
      mode: "json",
      hasUI: false,
      ui: { notify: (message) => notifications.push(message) },
    });
  }
  assert.match(notifications[0], /飞书：未绑定/);
  assert.match(notifications[1], /飞书：启动中/);
  assert.match(notifications[2], /飞书：在线/);
  assert.match(notifications[3], /飞书：离线/);
  assert.match(notifications[3], /最近错误：启动失败（launchctl）/);
});

test("folder commands preserve complete topic chat keys", async () => {
  let handler;
  const calls = [];
  createFeishuExtension(
    {
      registerCommand(_name, options) {
        handler = options.handler;
      },
      on() {},
    },
    {
      bind: { store: { home: "/tmp/unused" } },
      assistant: {
        async bindFolder(...args) {
          calls.push(args);
        },
      },
    },
  );
  await handler("folder topic:oc_chat:om_thread /tmp/project folder", {
    mode: "tui",
    hasUI: true,
    ui: { notify() {} },
  });
  assert.deepEqual(calls, [["topic:oc_chat:om_thread", "/tmp/project folder"]]);
});

test("session_shutdown does not stop the assistant", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-tui-"));
  const bind = createBind(home);
  await bind.store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
  });
  const control = createAssistantControl(home, {
    autostart: createAutostart(),
    runner: async ({ store, lock }) =>
      runAssistant({
        home,
        store,
        lock,
        transport: {
          isReady: () => true,
          async start() {},
          async stop() {},
          async send() {},
        },
        handleSignals: false,
      }),
  });
  await control.start();
  const hooks = new Map();
  createFeishuExtension(
    {
      registerCommand() {},
      on(name, handler) {
        hooks.set(name, handler);
      },
    },
    { bind, assistant: control },
  );
  await hooks.get("session_shutdown")();
  assert.equal((await control.snapshot()).presence, "online");
  await control.stop();
});
