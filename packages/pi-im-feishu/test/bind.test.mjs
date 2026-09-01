import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bindManual, bindQr, createBind } from "../src/bind.mjs";
import { createStore } from "../src/store.mjs";

test("QR and manual bind write the same machine-level store", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-bind-"));
  const store = createStore(home);
  const codes = [];
  await bindQr(store, {
    registerApp: async ({ onQRCodeReady }) => {
      onQRCodeReady?.({ url: "https://example.test/qr", expireIn: 60 });
      codes.push("shown");
      return {
        client_id: "cli_abcdefghijklmn",
        client_secret: "super-secret-value",
        user_info: { tenant_brand: "feishu" }
      };
    }
  });
  let status = await store.status();
  assert.equal(codes[0], "shown");
  assert.equal(status.bot.boundVia, "qr");
  assert.equal(status.bot.domain, "feishu");

  await bindManual(store, {
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
    domain: "lark"
  }, {
    verifyApp: async () => ({ ok: true })
  });
  status = await store.status();
  assert.equal(status.bot.boundVia, "manual");
  assert.equal(status.bot.domain, "lark");
  assert.equal(status.configured, true);
});

test("QR failure can fall through to manual bind", async () => {
  const bind = createBind(await mkdtemp(join(tmpdir(), "pi-im-feishu-qrfail-")));
  await assert.rejects(
    () => bind.bindQr({
      registerApp: async () => {
        throw Object.assign(new Error("expired"), { code: "expired_token" });
      }
    }),
    /expired/
  );
  await bind.bindManual({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value"
  }, {
    verifyApp: async () => ({ ok: true })
  });
  const status = await bind.store.status();
  assert.equal(status.bot.boundVia, "manual");
});

test("Lark tenant brand maps to lark domain", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-lark-")));
  await bindQr(store, {
    registerApp: async () => ({
      client_id: "cli_abcdefghijklmn",
      client_secret: "super-secret-value",
      user_info: { tenant_brand: "lark" }
    })
  });
  assert.equal((await store.status()).bot.domain, "lark");
});
