import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  inboundFiles,
  sendOutboundFiles,
  stageInboundFiles,
  validateOutboundFile,
} from "../src/files.mjs";

test("stages same-named inbound files without overwriting project files", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-files-"));
  await writeFile(join(folder, "report.txt"), "project");
  const files = inboundFiles({
    message: {
      content: JSON.stringify({ file_key: "fk", file_name: "report.txt" }),
    },
  });
  const [saved] = await stageInboundFiles(folder, "om_123", files, {
    download: async () => Buffer.from("inbound"),
  });
  assert.equal(
    saved.path,
    join(folder, ".pi-im-feishu", "inbox", "om_123", "report.txt"),
  );
  assert.equal(await readFile(saved.path, "utf8"), "inbound");
  assert.equal(await readFile(join(folder, "report.txt"), "utf8"), "project");
});

test("sanitizes message ids and traversal filenames and keeps duplicate names", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-safe-"));
  const saved = await stageInboundFiles(
    folder,
    "../../om_safe",
    [
      { kind: "file", key: "one", name: "../../note.txt" },
      { kind: "file", key: "two", name: "../note.txt" },
    ],
    { download: async ({ key }) => Buffer.from(key) },
  );
  assert.deepEqual(
    saved.map(({ path }) => path),
    [
      join(folder, ".pi-im-feishu", "inbox", "om_safe", "note.txt"),
      join(folder, ".pi-im-feishu", "inbox", "om_safe", "note-2.txt"),
    ],
  );
  assert.equal(await readFile(saved[0].path, "utf8"), "one");
  assert.equal(await readFile(saved[1].path, "utf8"), "two");
});

test("staging rejects missing or empty downloads", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-empty-"));
  const files = [{ kind: "file", key: "fk", name: "a.bin" }];
  await assert.rejects(
    () => stageInboundFiles(folder, "om_missing", files),
    (error) => error.code === "download-missing",
  );
  await assert.rejects(
    () =>
      stageInboundFiles(folder, "om_empty", files, {
        download: async () => Buffer.alloc(0),
      }),
    (error) => error.code === "download-failed",
  );
});

test("validates regular outbound files inside the real workspace", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-outbound-"));
  const image = join(folder, "out.png");
  const file = join(folder, "out.txt");
  await writeFile(image, "png");
  await writeFile(file, "text");
  assert.deepEqual(await validateOutboundFile(folder, image), {
    path: image,
    kind: "image",
  });
  assert.deepEqual(await validateOutboundFile(folder, "out.txt"), {
    path: file,
    kind: "file",
  });
});

test("rejects missing, non-regular, and symlink-escaped outbound paths", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pi-im-feishu-workspace-"));
  const outside = await mkdtemp(join(tmpdir(), "pi-im-feishu-outside-"));
  const secret = join(outside, "secret.txt");
  await writeFile(secret, "secret");
  await symlink(secret, join(folder, "link.txt"));
  await assert.rejects(
    () => validateOutboundFile(folder, join(folder, "missing.txt")),
    (error) => error.code === "outbound-file-invalid",
  );
  await assert.rejects(
    () => validateOutboundFile(folder, folder),
    (error) => error.code === "outbound-file-invalid",
  );
  await assert.rejects(
    () => validateOutboundFile(folder, join(folder, "link.txt")),
    (error) => error.code === "outside-workspace",
  );
});

test("outbound sender ignores relative paths", async () => {
  const sent = [];
  const result = await sendOutboundFiles(
    [{ path: join(tmpdir(), "out.bin") }, { path: "relative.bin" }],
    { sendFile: async (file) => sent.push(file.path) },
  );
  assert.equal(result.length, 1);
  assert.equal(sent.length, 1);
});
