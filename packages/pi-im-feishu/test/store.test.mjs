import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStore } from "../src/store.mjs";

const binding = {
  appId: "cli_1234567890abcdef",
  appSecret: "secret-value",
  domain: "feishu",
  boundVia: "manual",
  botOpenId: "ou_bot",
};

async function temporaryHome(label) {
  return mkdtemp(join(tmpdir(), `pi-im-feishu-${label}-`));
}

test("bindBot writes masked status and 0600 secrets", async () => {
  const store = createStore(await temporaryHome("store"));
  await store.bindBot(binding);
  const status = await store.status();
  assert.equal(status.configured, true);
  assert.equal(status.bot.appIdMasked.includes("cli_1234"), true);
  assert.equal(JSON.stringify(status).includes("secret-value"), false);
  assert.equal((await stat(store.secretFile)).mode & 0o777, 0o600);
  const secrets = JSON.parse(await readFile(store.secretFile, "utf8"));
  assert.equal(secrets.appSecret, "secret-value");
});

test("creates a missing state home as 0700", async () => {
  const parent = await temporaryHome("missing-home");
  const home = join(parent, "nested", "state");
  await createStore(home).bindBot(binding);
  assert.equal((await stat(home)).mode & 0o777, 0o700);
});

test("creates secrets as 0600 without a permissive window", async () => {
  const home = await temporaryHome("secret-mode");
  let observedMode;
  const store = createStore(home, {
    afterSecretWrite: async () => {
      observedMode = (await stat(store.secretFile)).mode & 0o777;
    },
  });
  await store.bindBot(binding);
  assert.equal(observedMode, 0o600);
});

test("never loads mixed credentials after a partial binding write", async () => {
  const home = await temporaryHome("partial-bind");
  await createStore(home).bindBot(binding);
  const store = createStore(home, {
    afterSecretWrite: async () => {
      throw new Error("crash");
    },
  });
  await assert.rejects(
    () =>
      store.bindBot({
        ...binding,
        appId: "cli_fedcba0987654321",
        appSecret: "replacement-secret",
      }),
    /crash/,
  );
  assert.equal(await store.loadCredentials(), null);
});

test("does not lose concurrent chat updates from separate stores", async () => {
  const home = await temporaryHome("concurrent-store");
  const a = createStore(home);
  const b = createStore(home);
  await Promise.all([
    a.upsertChat("p2p:a", { folder: "/tmp/a" }),
    b.upsertChat("p2p:b", { folder: "/tmp/b" }),
  ]);
  const status = await a.status();
  assert.deepEqual(status.chats.map((chat) => chat.key).sort(), [
    "p2p:a",
    "p2p:b",
  ]);
});

test("updateChat replaces one chat under the shared mutation lock", async () => {
  const store = createStore(await temporaryHome("update-chat"));
  await store.upsertChat("p2p:a", { folder: "/tmp/a", count: 1 });
  const updated = await store.updateChat("p2p:a", (current) => ({
    ...current,
    count: current.count + 1,
  }));
  assert.equal(updated.count, 2);
  assert.equal((await store.getChat("p2p:a")).count, 2);
});

test("delivery claims are persistent and exclusive", async () => {
  const home = await temporaryHome("delivery-claim");
  const a = createStore(home);
  const b = createStore(home);
  const claims = await Promise.all([
    a.claimDelivery("p2p:a", "om_1"),
    b.claimDelivery("p2p:a", "om_1")
  ]);
  assert.deepEqual(claims.sort(), [false, true]);
  await a.releaseDelivery("p2p:a", "om_1");
  assert.equal(await b.claimDelivery("p2p:a", "om_1"), true);
  await b.completeDelivery("p2p:a", "om_1");
  assert.equal(await a.claimDelivery("p2p:a", "om_1"), false);
});

test("completed delivery records are bounded", async () => {
  const store = createStore(await temporaryHome("delivery-bound"), { deliveryLimit: 2 });
  for (const messageId of ["om_1", "om_2", "om_3"]) {
    assert.equal(await store.claimDelivery("p2p:a", messageId), true);
    await store.completeDelivery("p2p:a", messageId);
  }
  const deliveries = (await store.getChat("p2p:a")).deliveries;
  assert.equal(Object.keys(deliveries).length, 2);
  assert.equal(deliveries.om_1, undefined);
  assert.equal(deliveries.om_3.state, "complete");
});
