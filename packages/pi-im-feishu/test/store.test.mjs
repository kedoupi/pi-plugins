import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStore } from "../src/store.mjs";

test("bindBot writes masked status and 0600 secrets", async () => {
  const store = createStore(await mkdtemp(join(tmpdir(), "pi-im-feishu-store-")));
  await store.bindBot({
    appId: "cli_abcdefghijklmn",
    appSecret: "super-secret-value",
    domain: "feishu",
    boundVia: "manual"
  });
  const status = await store.status();
  assert.equal(status.configured, true);
  assert.equal(status.bot.appIdMasked.includes("cli_abcd"), true);
  assert.equal(JSON.stringify(status).includes("super-secret-value"), false);
  assert.equal(statSync(store.secretFile).mode & 0o777, 0o600);
  const secrets = JSON.parse(await readFile(store.secretFile, "utf8"));
  assert.equal(secrets.appSecret, "super-secret-value");
});
