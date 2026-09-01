import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { createLock } from "../src/lock.mjs";
import { createStore } from "../src/store.mjs";

const assistantUrl = pathToFileURL(
  join(import.meta.dirname, "../src/assistant.mjs"),
).href;
const lockUrl = pathToFileURL(
  join(import.meta.dirname, "../src/lock.mjs"),
).href;

async function boundHome(name) {
  const home = await mkdtemp(join(tmpdir(), `pi-im-feishu-${name}-`));
  await createStore(home).bindBot({
    appId: "cli_fixtureabcdefghijkl",
    appSecret: "fixture-secret-not-real",
    botOpenId: "ou_fixture",
  });
  return home;
}

function runChild(source) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", source], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) =>
      resolve({ exitCode, signal, stdout, stderr }),
    );
  });
}

test("assistant process remains offline when runner creation fails", async () => {
  const home = await boundHome("runner-failure");
  const child = await runChild(`
    import { runAssistant } from ${JSON.stringify(assistantUrl)};
    try {
      await runAssistant({
        home: ${JSON.stringify(home)},
        loadSdk: async () => ({}),
        createRunner: () => { throw new Error("fixture runner failed"); },
      });
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  `);

  assert.notEqual(child.exitCode, 0, child.stderr);
  assert.match(child.stderr, /fixture runner failed/);
  assert.equal(await createLock(home).read(), null);
});

test("assistant disconnect removes online presence", async () => {
  const home = await boundHome("disconnect");
  const child = await runChild(`
    import { runAssistant } from ${JSON.stringify(assistantUrl)};
    import { createLock } from ${JSON.stringify(lockUrl)};
    const lock = createLock(${JSON.stringify(home)});
    let runtime;
    runtime = await runAssistant({
      home: ${JSON.stringify(home)},
      runPrompt: Object.assign(async () => ({ text: "unused" }), {
        dispose: async () => {},
      }),
      connect: async ({ onDisconnect }) => {
        let ready = false;
        return {
          async start() {
            ready = true;
            setTimeout(async () => {
              await onDisconnect(new Error("fixture disconnected"));
              console.log("DISCONNECTED:" + (await lock.read())?.status);
              await runtime.shutdown();
            }, 20);
          },
          isReady() { return ready; },
          async stop() {},
        };
      },
      logger: { error() {} },
    });
    console.log("READY:" + (await lock.read())?.status);
  `);

  assert.equal(child.exitCode, 0, child.stderr);
  assert.match(child.stdout, /READY:online/);
  assert.match(child.stdout, /DISCONNECTED:offline/);
  assert.equal(await createLock(home).read(), null);
});
