import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, parseFeishuCommand } from "../src/commands.mjs";

test("parses Feishu workflow commands", () => {
  assert.equal(parseFeishuCommand("帮助").name, "help");
  assert.equal(parseFeishuCommand("新对话").name, "new");
  assert.equal(parseFeishuCommand("换文件夹 /tmp/site").folder, "/tmp/site");
  assert.equal(parseFeishuCommand("以前的 2").index, 2);
});

test("new conversation archives the old draft", () => {
  const result = applyCommand({ name: "new" }, {
    sessionFile: "/tmp/old.jsonl",
    updatedAt: "yesterday",
    archives: []
  });
  assert.equal(result.patch.sessionFile, null);
  assert.equal(result.patch.archives[0].sessionFile, "/tmp/old.jsonl");
});

test("previous restores an archived session", () => {
  const result = applyCommand({ name: "previous", index: 1 }, {
    sessionFile: "/tmp/current.jsonl",
    archives: [{ sessionFile: "/tmp/old.jsonl", label: "旧" }]
  });
  assert.equal(result.patch.sessionFile, "/tmp/old.jsonl");
});
