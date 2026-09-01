import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyCommand, parseFeishuCommand } from "../src/commands.mjs";

test("parses Feishu workflow commands", () => {
  assert.equal(parseFeishuCommand("帮助").name, "help");
  assert.equal(parseFeishuCommand("新对话").name, "new");
  assert.equal(parseFeishuCommand("换文件夹 /tmp/site").folder, "/tmp/site");
  assert.equal(parseFeishuCommand("以前的 2").index, 2);
});

test("new conversation archives the old draft", async () => {
  const result = await applyCommand(
    { name: "new" },
    {
      sessionFile: "/tmp/old.jsonl",
      updatedAt: "yesterday",
      archives: [],
    },
  );
  assert.equal(result.sessionAction, "new");
  assert.equal(result.patch.sessionFile, null);
  assert.equal(result.patch.archives[0].sessionFile, "/tmp/old.jsonl");
});

test("folder change archives the old draft and clears the active session", async () => {
  const result = await applyCommand(
    { name: "folder", folder: "/tmp/new" },
    {
      folder: "/tmp/old",
      sessionFile: "/tmp/old.jsonl",
      updatedAt: "yesterday",
      archives: [],
    },
  );
  assert.equal(result.sessionAction, "folder");
  assert.deepEqual(result.patch, {
    folder: "/tmp/new",
    sessionFile: null,
    archives: [{ sessionFile: "/tmp/old.jsonl", label: "yesterday" }],
  });
});

test("previous restores only a session from the current folder", async () => {
  const home = await mkdtemp(join(tmpdir(), "pi-im-feishu-previous-"));
  const oldFile = join(home, "old.jsonl");
  await writeFile(
    oldFile,
    `${JSON.stringify({ type: "session", id: "old", cwd: "/workspace" })}\n`,
  );
  const result = await applyCommand(
    { name: "previous", index: 1 },
    {
      folder: "/workspace",
      sessionFile: "/workspace/current.jsonl",
      archives: [{ sessionFile: oldFile, label: "旧" }],
    },
  );
  assert.equal(result.sessionAction, "previous");
  assert.equal(result.patch.sessionFile, oldFile);

  await writeFile(
    oldFile,
    `${JSON.stringify({ type: "session", id: "old", cwd: "/elsewhere" })}\n`,
  );
  const refused = await applyCommand(
    { name: "previous", index: 1 },
    {
      folder: "/workspace",
      archives: [{ sessionFile: oldFile, label: "旧" }],
    },
  );
  assert.equal(refused.patch, undefined);
  assert.match(refused.text, /文件夹/);
});
