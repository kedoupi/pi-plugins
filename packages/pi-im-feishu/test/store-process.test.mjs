import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const storeUrl = new URL("../src/store.mjs", import.meta.url).href;

function launch(home, key, folder, startFile) {
  const source = `
    import { access } from "node:fs/promises";
    import { createStore } from ${JSON.stringify(storeUrl)};
    const [home, key, folder, startFile] = process.argv.slice(1);
    process.stdout.write("ready\\n");
    while (true) {
      try { await access(startFile); break; } catch { await new Promise((resolve) => setTimeout(resolve, 5)); }
    }
    const chat = await createStore(home).upsertChat(key, { folder });
    process.stdout.write(JSON.stringify(chat) + "\\n");
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", source, home, key, folder, startFile], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  return {
    child,
    ready: new Promise((resolve, reject) => {
      child.stdout.on("data", () => {
        if (stdout.includes("ready\n")) resolve();
      });
      child.once("error", reject);
    }),
    done: new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
    })
  };
}

test("separate node processes preserve both chat updates", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-store-process-"));
  const startFile = join(home, "start");
  const a = launch(home, "p2p:a", "/tmp/a", startFile);
  const b = launch(home, "p2p:b", "/tmp/b", startFile);
  await Promise.all([a.ready, b.ready]);
  await writeFile(startFile, "go");
  const results = await Promise.all([a.done, b.done]);
  for (const result of results) {
    assert.equal(result.code, 0, result.stderr || `child exited from ${result.signal}`);
    assert.doesNotThrow(() => JSON.parse(result.stdout.trim().split("\n").at(-1)));
  }

  const { createStore } = await import(storeUrl);
  const status = await createStore(home).status();
  assert.deepEqual(status.chats.map((chat) => chat.key).sort(), ["p2p:a", "p2p:b"]);
});
