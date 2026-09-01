import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  );
}

function safeMessageId(messageId) {
  const value = basename(String(messageId ?? "").trim())
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+|\.+$/g, "");
  return value && value !== "." && value !== ".." ? value : "message";
}

function safeFilename(file) {
  const value = basename(String(file?.name ?? file?.key ?? "").trim());
  return value && value !== "." && value !== ".." ? value : "file.bin";
}

async function downloadBytes(file, messageId, download) {
  if (typeof download !== "function") {
    throw Object.assign(new Error("inbound file download is required"), {
      code: "download-missing",
    });
  }
  const downloaded = await download({ ...file, messageId });
  const bytes =
    typeof downloaded === "string" ? await readFile(downloaded) : downloaded;
  if (
    (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) ||
    bytes.byteLength === 0
  ) {
    throw Object.assign(new Error("inbound file download returned nothing"), {
      code: "download-failed",
    });
  }
  return bytes;
}

async function writeExclusive(directory, name, bytes) {
  const extension = extname(name);
  const stem = basename(name, extension);
  for (let suffix = 1; ; suffix += 1) {
    const candidate = join(
      directory,
      suffix === 1 ? name : `${stem}-${suffix}${extension}`,
    );
    try {
      await writeFile(candidate, bytes, { flag: "wx" });
      return candidate;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

export function inboundFiles(event) {
  const message = event?.message ?? event?.event?.message ?? {};
  const files = [];
  const content = message.content;
  let parsed = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }
  }
  const imageKey = nonEmpty(parsed?.image_key) ?? nonEmpty(message.image_key);
  if (imageKey)
    files.push({ kind: "image", key: imageKey, name: `${imageKey}.png` });
  const fileKey = nonEmpty(parsed?.file_key) ?? nonEmpty(message.file_key);
  if (fileKey) {
    files.push({
      kind: "file",
      key: fileKey,
      name:
        nonEmpty(parsed?.file_name) ??
        nonEmpty(message.file_name) ??
        `${fileKey}.bin`,
    });
  }
  return files;
}

export async function stageInboundFiles(
  folder,
  messageId,
  files,
  { download } = {},
) {
  if (!files?.length) return [];
  if (!isAbsolute(folder)) {
    throw Object.assign(new Error("folder must be an absolute path"), {
      code: "invalid-folder",
    });
  }
  const directory = join(
    folder,
    ".pi-im-feishu",
    "inbox",
    safeMessageId(messageId),
  );
  await mkdir(directory, { recursive: true });
  const saved = [];
  for (const file of files) {
    const bytes = await downloadBytes(file, messageId, download);
    const path = await writeExclusive(directory, safeFilename(file), bytes);
    saved.push({ ...file, path });
  }
  return saved;
}

export async function validateOutboundFile(folder, path) {
  if (!isAbsolute(folder) || typeof path !== "string" || path.trim() === "") {
    throw Object.assign(new Error("outbound file path is invalid"), {
      code: "outbound-file-invalid",
    });
  }
  let root;
  let actual;
  try {
    root = await realpath(folder);
    actual = await realpath(resolve(folder, path));
  } catch {
    throw Object.assign(new Error("outbound file must exist"), {
      code: "outbound-file-invalid",
    });
  }
  if (!inside(root, actual)) {
    throw Object.assign(new Error("outbound file is outside the workspace"), {
      code: "outside-workspace",
    });
  }
  if (!(await stat(actual)).isFile()) {
    throw Object.assign(new Error("outbound path must be a regular file"), {
      code: "outbound-file-invalid",
    });
  }
  return {
    path: actual,
    kind: IMAGE_EXTENSIONS.has(extname(actual).toLowerCase())
      ? "image"
      : "file",
  };
}

export async function sendOutboundFiles(files, { sendFile } = {}) {
  if (!files?.length) return [];
  const sent = [];
  for (const file of files) {
    const path = file.path ?? file;
    if (typeof path !== "string" || !isAbsolute(path)) continue;
    if (typeof sendFile === "function") await sendFile(file);
    sent.push(path);
  }
  return sent;
}
