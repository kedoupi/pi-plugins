export function attachDecision(chat, cwd) {
  if (!chat) {
    return { ok: false, code: "unknown-chat", message: "清单里还没有这条飞书聊天。" };
  }
  if (!chat.folder) {
    return {
      ok: false,
      code: "folder-missing",
      message: "这条聊天还没有文件夹。在飞书里选，或执行 /feishu folder。"
    };
  }
  if (!chat.sessionFile) {
    return {
      ok: false,
      code: "no-session",
      message: "这条聊天还没有对话。先在飞书里说话。"
    };
  }
  if (cwd && chat.folder !== cwd) {
    return {
      ok: false,
      code: "folder-mismatch",
      message: `这段工作在 ${chat.folder}。请到那个目录打开 Pi，或继续用飞书。`
    };
  }
  return {
    ok: true,
    code: "ok",
    sessionFile: chat.sessionFile,
    folder: chat.folder,
    message: `文件夹一致，可以接着看「${chat.title}」。本版本不会把窗口切到那份对话。`
  };
}
