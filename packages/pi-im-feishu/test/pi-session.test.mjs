import assert from "node:assert/strict";
import test from "node:test";
import { createPiRunPrompt, interceptToolCalls } from "../src/pi-session.mjs";

test("createPiRunPrompt returns null without Pi SDK factories", () => {
  assert.equal(createPiRunPrompt({}), null);
});

test("interceptToolCalls asks confirm for rm and skips when denied", async () => {
  const calls = [];
  const tool = {
    name: "bash",
    execute: async () => {
      calls.push("run");
      return { ok: true };
    }
  };
  const restore = interceptToolCalls(
    { tools: [tool] },
    async () => false,
    { key: "p2p:a" }
  );
  const result = await tool.execute("id", { command: "rm -rf /tmp/x" });
  assert.equal(calls.length, 0);
  assert.match(result.content[0].text, /未确认/);
  restore();
  await tool.execute("id", { command: "rm -rf /tmp/x" });
  assert.equal(calls.length, 1);
});
