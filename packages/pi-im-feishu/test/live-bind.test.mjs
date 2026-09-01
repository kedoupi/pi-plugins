import assert from "node:assert/strict";
import test from "node:test";
import { verifyFeishuApp } from "../src/live-bind.mjs";

test("verifyFeishuApp uses injected fetch and fails without token", async () => {
  await assert.rejects(
    () => verifyFeishuApp({
      appId: "cli_abcdefghijklmn",
      appSecret: "super-secret-value",
      fetchImpl: async () => ({ json: async () => ({}) })
    }),
    /无法验证/
  );
  const ok = await verifyFeishuApp({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
    fetchImpl: async (url) => ({
      json: async () => url.includes("tenant_access_token")
        ? { tenant_access_token: "t" }
        : { code: 0, bot: { open_id: "ou_bot" } }
    })
  });
  assert.equal(ok.bot.open_id, "ou_bot");
});
