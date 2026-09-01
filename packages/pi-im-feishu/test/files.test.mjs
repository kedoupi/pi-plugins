import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inboundFiles, sendOutboundFiles, stageInboundFiles } from "../src/files.mjs";

test("stages inbound files into the chat folder", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-files-"));
  const files = inboundFiles({
    message: { content: JSON.stringify({ file_key: "fk", file_name: "note.txt" }) }
  });
  const saved = await stageInboundFiles(folder, files, {
    download: async () => Buffer.from("hello")
  });
  assert.equal(await readFile(saved[0].path, "utf8"), "hello");
});

test("staging without download fails instead of writing empty files", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-empty-"));
  await assert.rejects(
    () => stageInboundFiles(folder, [{ kind: "file", key: "fk", name: "a.bin" }]),
    (error) => error.code === "download-missing"
  );
});

test("outbound files require absolute paths", async () => {
  const sent = [];
  const result = await sendOutboundFiles(
    [{ path: join(tmpdir(), "out.bin") }, { path: "relative.bin" }],
    { sendFile: async (file) => sent.push(file.path) }
  );
  assert.equal(result.length, 1);
  assert.equal(sent.length, 1);
});
