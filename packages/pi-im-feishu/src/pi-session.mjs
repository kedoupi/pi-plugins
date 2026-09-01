import { classifyToolCall } from "./tool-policy.mjs";

export const CHILD_ENV = "PI_IM_FEISHU_ASSISTANT";
export const CODING_TOOLS = [
  "read",
  "grep",
  "find",
  "ls",
  "edit",
  "write",
  "bash",
];

function sdkError(cause) {
  return Object.assign(
    new Error("Pi SDK 未安装或不可用，无法启动飞书助手。", { cause }),
    {
      code: "pi-sdk-missing",
    },
  );
}

export async function loadPiSdk() {
  let pi;
  try {
    pi = await import("@earendil-works/pi-coding-agent");
  } catch (error) {
    throw sdkError(error);
  }
  if (
    typeof pi.createAgentSession !== "function" ||
    typeof pi.SessionManager !== "function" ||
    typeof pi.DefaultResourceLoader !== "function" ||
    typeof pi.getAgentDir !== "function"
  ) {
    throw sdkError();
  }
  return pi;
}

export function assistantText(session) {
  const messages = session?.messages ?? [];
  const last = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  if (typeof last?.content === "string") return last.content;
  if (Array.isArray(last?.content)) {
    return last.content.map((part) => part.text ?? "").join("");
  }
  return "";
}

function skipped(text) {
  return { content: [{ type: "text", text }] };
}

export function interceptToolCalls(
  session,
  confirm,
  inbound,
  { folder, secrets = [] } = {},
) {
  const tools = session?.agent?.state?.tools ?? session?.tools;
  if (!Array.isArray(tools)) return () => {};
  const originals = [];
  for (const tool of tools) {
    if (typeof tool?.execute !== "function") continue;
    const original = tool.execute;
    originals.push([tool, original]);
    tool.execute = async (...args) => {
      const input = args[1] && typeof args[1] === "object" ? args[1] : args[0];
      const decision = await classifyToolCall(tool.name, input ?? {}, {
        folder,
        secrets,
      });
      if (decision.blocked)
        return skipped("工具调用超出工作区，已阻止并跳过。");
      if (decision.confirm) {
        const ok =
          typeof confirm === "function" &&
          (await confirm({
            inbound,
            kind: tool.name,
            detail: decision.detail,
          }));
        if (!ok) return skipped("用户未确认，已跳过。");
      }
      return original.apply(tool, args);
    };
  }
  return () => {
    for (const [tool, original] of originals) tool.execute = original;
  };
}

export function createResourceLoader(pi, folder) {
  return new pi.DefaultResourceLoader({
    cwd: folder,
    agentDir: pi.getAgentDir(),
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
  });
}

/** Reuses one isolated AgentSession per chat key and exact session file. */
export function createPiRunPrompt(pi, { secrets = [] } = {}) {
  if (
    typeof pi?.createAgentSession !== "function" ||
    typeof pi?.SessionManager !== "function" ||
    typeof pi?.DefaultResourceLoader !== "function" ||
    typeof pi?.getAgentDir !== "function"
  ) {
    throw sdkError();
  }
  const pool = new Map();

  async function disposeEntry(entry) {
    await entry?.session?.dispose?.();
  }

  async function sessionFor(key, folder, sessionFile) {
    const requestedSessionFile = sessionFile ?? null;
    const cached = pool.get(key);
    if (
      cached &&
      cached.folder === folder &&
      cached.requestedSessionFile === requestedSessionFile
    ) {
      return cached;
    }
    await disposeEntry(cached);
    pool.delete(key);
    const sessionManager = requestedSessionFile
      ? pi.SessionManager.open(requestedSessionFile)
      : pi.SessionManager.create(folder);
    const resourceLoader = createResourceLoader(pi, folder);
    await resourceLoader.reload();
    const created = await pi.createAgentSession({
      cwd: folder,
      sessionManager,
      resourceLoader,
      tools: [...CODING_TOOLS],
    });
    if (!created?.session || typeof created.session.prompt !== "function") {
      await created?.session?.dispose?.();
      throw Object.assign(
        new Error("Pi 会话创建失败，飞书助手无法处理消息。"),
        {
          code: "pi-session-unavailable",
        },
      );
    }
    const entry = {
      folder,
      requestedSessionFile,
      sessionFile: created.session.sessionFile ?? requestedSessionFile,
      session: created.session,
    };
    pool.set(key, entry);
    return entry;
  }

  const runner = async ({
    folder,
    sessionFile,
    text,
    signal,
    confirm,
    inbound,
  }) => {
    const key = inbound?.key ?? folder;
    const entry = await sessionFor(key, folder, sessionFile);
    const restore = interceptToolCalls(entry.session, confirm, inbound, {
      folder,
      secrets,
    });
    const onAbort = () => entry.session.abort?.();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      await entry.session.prompt(text);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      restore();
    }
    entry.sessionFile = entry.session.sessionFile ?? entry.sessionFile;
    entry.requestedSessionFile = entry.sessionFile;
    return {
      text: assistantText(entry.session) || "完成。",
      sessionFile: entry.sessionFile,
    };
  };
  runner.release = async (key) => {
    const entry = pool.get(key);
    const sessionFile = entry?.session?.sessionFile ?? entry?.sessionFile ?? null;
    pool.delete(key);
    await disposeEntry(entry);
    return { sessionFile };
  };
  runner.dispose = async () => {
    const entries = [...pool.values()];
    pool.clear();
    await Promise.all(entries.map(disposeEntry));
  };
  return runner;
}
