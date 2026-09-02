import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bindManual, bindQr, createBind } from "../src/bind.mjs";
import { createStore } from "../src/store.mjs";

test("QR and manual bind verify and store the same bot identity", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-bind-"));
  const store = createStore(home);
  const codes = [];
  const verified = [];
  const verifyApp = async (credentials) => {
    verified.push(credentials);
    return { ok: true, bot: { open_id: "ou_bot" } };
  };
  const controller = new AbortController();
  await bindQr(store, {
    signal: controller.signal,
    registerApp: async ({ onQRCodeReady, signal }) => {
      assert.equal(signal, controller.signal);
      onQRCodeReady?.({ url: "https://example.test/qr", expireIn: 60 });
      codes.push("shown");
      return {
        client_id: "cli_abcdefghijklmn",
        client_secret: "super-secret-value",
        user_info: { tenant_brand: "feishu" },
      };
    },
    verifyApp,
  });
  let credentials = await store.loadCredentials();
  assert.equal(codes[0], "shown");
  assert.equal(credentials.boundVia, "qr");
  assert.equal(credentials.domain, "feishu");
  assert.equal(credentials.botOpenId, "ou_bot");

  await bindManual(
    store,
    {
      appId: "cli_abcdefghijklmn",
      appSecret: "super-secret-value",
      domain: "lark",
    },
    { verifyApp },
  );
  credentials = await store.loadCredentials();
  assert.equal(credentials.boundVia, "manual");
  assert.equal(credentials.domain, "lark");
  assert.equal(credentials.botOpenId, "ou_bot");
  assert.equal(verified.length, 2);
});

test("QR failure can fall through to manual bind", async () => {
  const bind = createBind(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-qrfail-")),
  );
  await assert.rejects(
    () =>
      bind.bindQr({
        registerApp: async () => {
          throw Object.assign(new Error("expired"), { code: "expired_token" });
        },
      }),
    /expired/,
  );
  await bind.bindManual(
    {
      appId: "cli_abcdefghijklmn",
      appSecret: "super-secret-value",
    },
    {
      verifyApp: async () => ({ ok: true, bot: { open_id: "ou_bot" } }),
    },
  );
  const status = await bind.store.status();
  assert.equal(status.bot.boundVia, "manual");
});

test("Lark tenant brand maps to lark domain", async () => {
  const store = createStore(
    await mkdtemp(join(tmpdir(), "pi-im-feishu-lark-")),
  );
  await bindQr(store, {
    registerApp: async () => ({
      client_id: "cli_abcdefghijklmn",
      client_secret: "super-secret-value",
      user_info: { tenant_brand: "lark" },
    }),
    verifyApp: async () => ({ ok: true, bot: { open_id: "ou_bot" } }),
  });
  assert.equal((await store.status()).bot.domain, "lark");
});
