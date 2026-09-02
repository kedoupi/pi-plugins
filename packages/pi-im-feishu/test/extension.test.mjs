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

const TEST_KEYBINDINGS = {
  matches(data, binding) {
    const keys = {
      "tui.select.cancel": ["\u001b", "\u0003", "\u001b[27u", "\u001b[99;5u"],
      "tui.input.submit": ["\r", "\n", "\u001b[13u"],
      "tui.editor.deleteCharBackward": ["\u007f", "\b", "\u001b[127u"],
    };
    return keys[binding]?.includes(data) ?? false;
  },
};

function kittyText(value) {
  return [...value].map((character) => `\u001b[${character.codePointAt(0)}u`);
}

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
    "setup",
    "start",
    "stop",
    "folder topic:chat:thread /tmp/a",
    "attach p2p:a",
  ]) {
    await handler(command, noUi);
  }
  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 5);
  assert.ok(notifications.every((message) => /Pi TUI/.test(message)));
});

test("masked input handles Kitty keys and bracketed paste without revealing the secret", async () => {
  let rendered;
  const ctx = {
    ui: {
      custom(factory) {
        return new Promise((resolve) => {
          const component = factory(
            { requestRender() {} },
            {},
            TEST_KEYBINDINGS,
            resolve,
          );
          for (const key of kittyText("secret")) component.handleInput(key);
          component.handleInput("\u001b[200~-value\u001b[201~");
          rendered = component.render(80).join("\n");
          component.handleInput("\u001b[127u");
          component.handleInput("\u001b[13u");
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
      const component = factory(
        { requestRender() {} },
        {},
        TEST_KEYBINDINGS,
        resolve,
      );
      component.handleInput("do-not-return");
      component.handleInput("\u001b[27u");
    });
  assert.equal(await maskedInput(ctx, "App Secret"), null);
});

test("setup defaults to QR and renders a QR code plus authorization link", async () => {
  let handler;
  let rendered = "";
  const candidates = [];
  const selections = [];
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
        async qrCandidate({ onQRCodeReady, signal }) {
          assert.equal(signal instanceof AbortSignal, true);
          onQRCodeReady({ url: "https://accounts.feishu.cn/qr-test", expireIn: 60 });
          return {
            appId: "cli_1234567890",
            appSecret: "secret-value",
            domain: "feishu",
            botOpenId: "ou_bot",
          };
        },
      },
      assistant: {
        async snapshot() {
          return { configured: false };
        },
        async rebind(candidate) {
          candidates.push(candidate);
          return { status: "online" };
        },
      },
    },
  );

  await handler("setup", {
    mode: "tui",
    hasUI: true,
    ui: {
      notify() {},
      async select(title, options) {
        selections.push({ title, options });
        return options[0];
      },
      custom(factory) {
        return new Promise((resolve) => {
          const component = factory({ requestRender() {} }, {}, {}, resolve);
          rendered = component.render(100).join("\n");
        });
      },
    },
  });

  assert.match(selections[0].title, /绑定方式/);
  assert.match(selections[0].options[0], /扫码/);
  assert.match(rendered, /https:\/\/accounts\.feishu\.cn\/qr-test/);
  assert.equal(
    rendered.includes("\u001b]8;;https://accounts.feishu.cn/qr-test"),
    true,
  );
  assert.match(rendered, /[▀▄█]/);
  assert.deepEqual(candidates.map(({ appSecret, ...candidate }) => candidate), [
    {
      appId: "cli_1234567890",
      domain: "feishu",
      botOpenId: "ou_bot",
    },
  ]);
});

test("escaping the QR panel aborts registration without replacing the binding", async () => {
  let handler;
  let aborted = false;
  let rebound = false;
  const notifications = [];
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
        qrCandidate({ onQRCodeReady, signal }) {
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              aborted = true;
              reject(Object.assign(new Error("Registration was aborted"), { code: "abort" }));
            });
            onQRCodeReady({ url: "https://accounts.feishu.cn/qr-test", expireIn: 60 });
          });
        },
      },
      assistant: {
        async snapshot() {
          return { configured: false };
        },
        async rebind() {
          rebound = true;
        },
      },
    },
  );

  await handler("setup", {
    mode: "tui",
    hasUI: true,
    ui: {
      notify: (message) => notifications.push(message),
      async select(_title, options) {
        return options[0];
      },
      custom(factory) {
        return new Promise((resolve) => {
          const component = factory(
            { requestRender() {} },
            {},
            TEST_KEYBINDINGS,
            resolve,
          );
          component.handleInput("\u001b[99;5u");
        });
      },
    },
  });

  assert.equal(aborted, true);
  assert.equal(rebound, false);
  assert.match(notifications.join("\n"), /取消/);
});

test("setup can select manual binding without putting the secret in arguments", async () => {
  let handler;
  const candidates = [];
  const notifications = [];
  let selection = 0;
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
          return { configured: false };
        },
        async rebind(candidate) {
          candidates.push(candidate);
          return { status: "online" };
        },
      },
    },
  );
  await handler("setup", {
    mode: "tui",
    hasUI: true,
    ui: {
      notify: (message) => notifications.push(message),
      async select(_title, options) {
        selection += 1;
        return options[1];
      },
      async input() {
        return "cli_1234567890";
      },
      custom: (factory) =>
        new Promise((resolve) => {
          const component = factory(
            { requestRender() {} },
            {},
            TEST_KEYBINDINGS,
            resolve,
          );
          component.handleInput("secret-value");
          component.handleInput("\r");
        }),
    },
  });
  assert.equal(selection, 2);
  assert.deepEqual(candidates, [
    {
      appId: "cli_1234567890",
      appSecret: "secret-value",
      domain: "lark",
    },
  ]);
  assert.equal(notifications.join("\n").includes("secret-value"), false);
});

test("setup preserves an existing binding when replacement is cancelled", async () => {
  let handler;
  let confirmed = false;
  let selected = false;
  let rebound = false;
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
          return { configured: true };
        },
        async rebind() {
          rebound = true;
        },
      },
    },
  );
  await handler("setup", {
    mode: "tui",
    hasUI: true,
    ui: {
      notify() {},
      async confirm() {
        confirmed = true;
        return false;
      },
      async select() {
        selected = true;
      },
    },
  });
  assert.equal(confirmed, true);
  assert.equal(selected, false);
  assert.equal(rebound, false);
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
