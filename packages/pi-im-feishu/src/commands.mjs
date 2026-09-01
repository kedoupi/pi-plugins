import { isAbsolute } from "node:path";
import { validateFolder } from "./store.mjs";

export const HELP_TEXT = [
  "飞书助手已连接这台电脑。",
  "私聊直接说；群里请 @ 我。",
  "没选文件夹前不会改你电脑上的文件。",
  "",
  "常用：",
  "/stop  停止当前任务",
  "新对话  这条聊天换一件新任务（旧草稿保留）",
  "换文件夹 /绝对路径  这条聊天改去另一份代码",
  "以前的  列出可接上的草稿；以前的 1 接上第 1 条",
  "帮助  再看一遍"
].join("\n");

const STOP = /^\/stop\b/i;
const HELP = /^(?:\/help|帮助)$/i;
const NEW = /^(?:\/new|新对话)$/i;
const FOLDER = /^(?:\/folder|换文件夹)\s+(\S+)$/i;
const PREVIOUS = /^(?:\/previous|以前的)(?:\s+(\d+))?$/i;

export function parseFeishuCommand(text) {
  const value = String(text ?? "").trim();
  if (!value) return null;
  if (STOP.test(value)) return { name: "stop" };
  if (HELP.test(value)) return { name: "help" };
  if (NEW.test(value)) return { name: "new" };
  const folder = value.match(FOLDER);
  if (folder) return { name: "folder", folder: folder[1] };
  const previous = value.match(PREVIOUS);
  if (previous) {
    return { name: "previous", index: previous[1] ? Number(previous[1]) : null };
  }
  return null;
}

export function formatPrevious(archives = []) {
  if (!archives.length) return "还没有可接上的草稿。";
  const lines = archives.map((item, index) => `${index + 1}. ${item.label ?? item.sessionFile}`);
  return ["可以接上的草稿：", ...lines, "发送「以前的 1」接上第 1 条。"].join("\n");
}

export function applyCommand(command, chat) {
  if (!command) return null;
  if (command.name === "help") return { text: HELP_TEXT };
  if (command.name === "stop") return { text: "已停止。", stopped: true };
  if (command.name === "new") {
    const archives = [...(chat.archives ?? [])];
    if (chat.sessionFile) {
      archives.unshift({
        sessionFile: chat.sessionFile,
        label: chat.updatedAt ?? new Date().toISOString()
      });
    }
    return {
      text: "已开新对话。下一句开始新任务。旧草稿还在，发「以前的」可接上。",
      patch: { sessionFile: null, archives }
    };
  }
  if (command.name === "folder") {
    const error = validateFolder(command.folder);
    if (error || !isAbsolute(command.folder)) {
      return { text: "文件夹必须是绝对路径。" };
    }
    return {
      text: `这条聊天改去：${command.folder}`,
      patch: { folder: command.folder }
    };
  }
  if (command.name === "previous") {
    const archives = chat.archives ?? [];
    if (command.index == null) return { text: formatPrevious(archives) };
    const item = archives[command.index - 1];
    if (!item) return { text: formatPrevious(archives) };
    const rest = archives.filter((_, index) => index !== command.index - 1);
    if (chat.sessionFile) {
      rest.unshift({
        sessionFile: chat.sessionFile,
        label: chat.updatedAt ?? new Date().toISOString()
      });
    }
    return {
      text: `已接上：${item.label ?? item.sessionFile}`,
      patch: { sessionFile: item.sessionFile, archives: rest }
    };
  }
  return null;
}
