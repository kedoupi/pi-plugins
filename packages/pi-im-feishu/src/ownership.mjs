export function createOwnership() {
  const holders = new Map();
  return {
    holder(key) {
      return holders.get(key) ?? "assistant";
    },
    async releaseToWindow(key) {
      holders.set(key, "window");
      return { holder: "window" };
    },
    async restoreToAssistant(key) {
      if (key) holders.delete(key);
      else holders.clear();
      return { holder: "assistant" };
    },
    canAssistantWrite(key) {
      return this.holder(key) !== "window";
    }
  };
}

export function attachWithOwnership(chat, cwd, ownership) {
  if (!chat) {
    return { ok: false, code: "unknown-chat", message: "清单里还没有这条飞书聊天。" };
  }
  if (!chat.folder) {
    return { ok: false, code: "folder-missing", message: "这条聊天还没有文件夹。" };
  }
  if (!chat.sessionFile) {
    return { ok: false, code: "no-session", message: "这条聊天还没有对话。先在飞书里说话。" };
  }
  if (cwd && chat.folder !== cwd) {
    return {
      ok: false,
      code: "folder-mismatch",
      message: `这段工作在 ${chat.folder}。请到那个目录打开 Pi，或继续用飞书。`
    };
  }
  ownership?.releaseToWindow?.(chat.key);
  return {
    ok: true,
    code: "attach",
    sessionFile: chat.sessionFile,
    folder: chat.folder,
    message: `窗口可以打开「${chat.title}」。助手已暂停写入这条对话。关掉窗口后助手会再接手。`
  };
}
