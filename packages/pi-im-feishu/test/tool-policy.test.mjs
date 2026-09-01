import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { classifyToolCall, redactSensitive } from "../src/tool-policy.mjs";

async function workspace() {
  return mkdtemp(join(tmpdir(), "pi-im-feishu-policy-"));
}

test("confirms overwrite using the real write schema", async () => {
  const folder = await workspace();
  await writeFile(join(folder, "exists.txt"), "old");
  const decision = await classifyToolCall(
    "write",
    { path: "exists.txt", content: "new" },
    { folder },
  );
  assert.equal(decision.blocked, false);
  assert.equal(decision.confirm, true);
});

test("allows a new in-workspace file and blocks path traversal", async () => {
  const folder = await workspace();
  assert.equal(
    (await classifyToolCall("write", { path: "new.txt", content: "x" }, { folder })).confirm,
    false,
  );
  assert.equal(
    (await classifyToolCall("read", { path: "../secret" }, { folder })).blocked,
    true,
  );
});

test("blocks file access through a symlinked workspace ancestor", async () => {
  const folder = await workspace();
  const outside = await workspace();
  await mkdir(join(outside, "nested"));
  await symlink(join(outside, "nested"), join(folder, "escape"));
  const decision = await classifyToolCall("write", { path: "escape/new.txt", content: "x" }, { folder });
  assert.equal(decision.blocked, true);
});

test("always confirms edits inside the workspace", async () => {
  const folder = await workspace();
  const decision = await classifyToolCall(
    "edit",
    { path: "new.txt", oldText: "old", newText: "new" },
    { folder },
  );
  assert.equal(decision.blocked, false);
  assert.equal(decision.confirm, true);
});

test("only clearly read-only shell commands are automatic", async () => {
  const folder = await workspace();
  for (const command of ["pwd", "git status --short", "ls src", "grep needle README.md"]) {
    assert.equal(
      (await classifyToolCall("bash", { command }, { folder })).confirm,
      false,
      command,
    );
  }
  for (const command of [
    "npm test",
    "rm file",
    "chmod 600 file",
    "git reset --hard",
    "git status | cat",
    "git status > result",
    "echo $(pwd)",
    "find . -type f",
    "node script.mjs",
    "mystery --read-only",
    "ls ../outside",
    "rg --pre cat needle",
    "git diff --ext-diff",
    "git diff --output=result.txt",
    "git status --unknown-flag",
  ]) {
    assert.equal(
      (await classifyToolCall("bash", { command }, { folder })).confirm,
      true,
      command,
    );
  }
});

test("redacts configured and common secrets from confirmation details", async () => {
  const folder = await workspace();
  const appSecret = "configured-app-secret-value";
  const decision = await classifyToolCall(
    "bash",
    { command: `npm test -- --token=${appSecret}` },
    { folder, secrets: [appSecret] },
  );
  assert.equal(decision.confirm, true);
  assert.doesNotMatch(decision.detail, new RegExp(appSecret));
  assert.equal(redactSensitive({ appSecret, password: "other-secret" }, [appSecret]).includes(appSecret), false);
  assert.match(redactSensitive("Authorization: Bearer abcdef123456", []), /\[REDACTED\]/);
});
