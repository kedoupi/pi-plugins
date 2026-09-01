import { applyCommand, parseFeishuCommand } from "./commands.mjs";

export function createWork({ runPrompt, confirm } = {}) {
  const queues = new Map();
  const aborts = new Map();

  function enqueue(key, job) {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.then(job, job);
    queues.set(key, next.catch(() => {}));
    return next;
  }

  return {
    abort(key) {
      aborts.get(key)?.abort();
    },

    async work({ inbound, chat }) {
      const command = parseFeishuCommand(inbound.text);
      if (command?.name === "stop") {
        this.abort(inbound.key);
        return { text: "已停止。", stopped: true };
      }
      if (command) return applyCommand(command, chat);
      if (typeof runPrompt !== "function") {
        return { text: "已收到。改代码的能力还没接上。" };
      }
      const ac = new AbortController();
      aborts.set(inbound.key, ac);
      return enqueue(inbound.key, async () => {
        if (ac.signal.aborted) return { text: "已停止。", stopped: true };
        try {
          const result = await runPrompt({
            folder: chat.folder,
            sessionFile: chat.sessionFile ?? null,
            text: inbound.text,
            inbound,
            signal: ac.signal,
            confirm: confirm ?? (async () => true)
          });
          if (ac.signal.aborted) return { text: "已停止。", stopped: true };
          return result ?? { text: "没有回复。" };
        } catch (error) {
          if (ac.signal.aborted) return { text: "已停止。", stopped: true };
          throw error;
        }
      });
    }
  };
}
