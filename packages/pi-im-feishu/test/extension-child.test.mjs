import assert from "node:assert/strict";
import test from "node:test";
import extension from "../extensions/index.ts";

test("assistant child process does not register the TUI extension", () => {
  process.env.PI_IM_FEISHU_ASSISTANT = "1";
  const commands = [];
  const result = extension({
    registerCommand(name) {
      commands.push(name);
    },
    on() {}
  });
  delete process.env.PI_IM_FEISHU_ASSISTANT;
  assert.equal(result, undefined);
  assert.deepEqual(commands, []);
});
