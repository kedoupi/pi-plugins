import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
  if (imageKey) files.push({ kind: "image", key: imageKey, name: `${imageKey}.png` });
  const fileKey = nonEmpty(parsed?.file_key) ?? nonEmpty(message.file_key);
  if (fileKey) {
    files.push({
      kind: "file",
      key: fileKey,
      name: nonEmpty(parsed?.file_name) ?? nonEmpty(message.file_name) ?? `${fileKey}.bin`
    });
  }
  return files;
}

export async function stageInboundFiles(folder, files, { download } = {}) {
  if (!files?.length) return [];
  if (!isAbsolute(folder)) {
    throw Object.assign(new Error("folder must be an absolute path"), { code: "invalid-folder" });
  }
  await mkdir(folder, { recursive: true });
  const saved = [];
  for (const file of files) {
    const path = join(folder, basename(file.name ?? file.key ?? "file.bin"));
    if (typeof download !== "function") {
      throw Object.assign(new Error("inbound file download is required"), { code: "download-missing" });
    }
    const bytes = await download({ ...file, messageId: file.messageId });
    if (Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) {
      await writeFile(path, bytes);
    } else if (typeof bytes === "string") {
      await copyFile(bytes, path);
    } else {
      throw Object.assign(new Error("inbound file download returned nothing"), { code: "download-failed" });
    }
    saved.push({ ...file, path });
  }
  return saved;
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
