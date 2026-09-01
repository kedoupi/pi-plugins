import { isImportantTool } from "./important.mjs";

export const CHILD_ENV = "PI_IM_FEISHU_ASSISTANT";

export async function loadPiSdk() {
  try {
    return await import("@earendil-works/pi-coding-agent");
  } catch {
    return null;
  }
}

export function assistantText(session) {
  const messages = session?.messages ?? [];
  const last = [...messages].reverse().find((message) => message.role === "assistant");
  if (typeof last?.content === "string") return last.content;
  if (Array.isArray(last?.content)) {
    return last.content.map((part) => part.text ?? "").join("");
  }
  return "";
}

export function interceptToolCalls(session, confirm, inbound) {
  const tools = session?.agent?.state?.tools ?? session?.tools;
  if (!Array.isArray(tools) || typeof confirm !== "function") return () => {};
  const originals = [];
  for (const tool of tools) {
    if (typeof tool?.execute !== "function") continue;
    const original = tool.execute;
    originals.push([tool, original]);
    tool.execute = async (...args) => {
      const input = args[1] && typeof args[1] === "object" ? args[1] : args[0];
      if (isImportantTool(tool.name, input ?? {})) {
        const ok = await confirm({
          inbound,
          kind: tool.name,
          detail: typeof input === "string" ? input : JSON.stringify(input ?? {}).slice(0, 500)
        });
        if (!ok) {
          return { content: [{ type: "text", text: "用户未确认，已跳过。" }] };
        }
      }
      return original.apply(tool, args);
    };
  }
  return () => {
    for (const [tool, original] of originals) tool.execute = original;
  };
}

export function createResourceLoader(pi, folder) {
  if (typeof pi.DefaultResourceLoader !== "function") return undefined;
  return new pi.DefaultResourceLoader({
    cwd: folder,
    additionalExtensionPaths: []
  });
}

/**
 * Reuses one AgentSession per chat. Nested sessions must not load this package
 * as an extension: the assistant process sets PI_IM_FEISHU_ASSISTANT=1 and the
 * TUI factory no-ops. ResourceLoader is still passed when the SDK has one.
 */
export function createPiRunPrompt(pi) {
  if (!pi?.createAgentSession || !pi.SessionManager) return null;
  const pool = new Map();

  async function sessionFor(key, folder, sessionFile) {
    const cached = pool.get(key);
    if (cached && cached.folder === folder && cached.sessionFile === (sessionFile ?? cached.sessionFile)) {
      return cached;
    }
    cached?.session?.dispose?.();
    const sessionManager = sessionFile
      ? pi.SessionManager.open(sessionFile)
      : pi.SessionManager.create(folder);
    const options = { cwd: folder, sessionManager };
    const loader = createResourceLoader(pi, folder);
    if (loader) options.resourceLoader = loader;
    const created = await pi.createAgentSession(options);
    const entry = {
      folder,
      sessionFile: created.session.sessionFile ?? sessionFile ?? null,
      session: created.session
    };
    pool.set(key, entry);
    return entry;
  }

  const runner = async ({ folder, sessionFile, text, signal, confirm, inbound }) => {
    const key = inbound?.key ?? folder;
    const entry = await sessionFor(key, folder, sessionFile);
    const restore = interceptToolCalls(entry.session, confirm, inbound);
    const onAbort = () => entry.session.abort?.();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      await entry.session.prompt(text);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      restore();
    }
    entry.sessionFile = entry.session.sessionFile ?? entry.sessionFile;
    return {
      text: assistantText(entry.session) || "完成。",
      sessionFile: entry.sessionFile
    };
  };
  runner.dispose = () => {
    for (const entry of pool.values()) entry.session?.dispose?.();
    pool.clear();
  };
  return runner;
}
