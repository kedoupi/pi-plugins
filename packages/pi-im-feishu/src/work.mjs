import { applyCommand, parseFeishuCommand } from "./commands.mjs";

const STOPPED = { text: "已停止。", stopped: true };

export function createWork({ runPrompt, confirm } = {}) {
  const lanes = new Map();
  let disposed = false;

  function laneFor(key) {
    let lane = lanes.get(key);
    if (!lane) {
      lane = { tail: null, generation: 0, activeController: null };
      lanes.set(key, lane);
    }
    return lane;
  }

  function enqueue(key, action) {
    const lane = laneFor(key);
    const generation = lane.generation;
    const execute = async () => {
      if (disposed || generation !== lane.generation) return STOPPED;
      try {
        const result = await action(lane, generation);
        return disposed || generation !== lane.generation ? STOPPED : result;
      } catch (error) {
        if (disposed || generation !== lane.generation) return STOPPED;
        throw error;
      }
    };
    const next = lane.tail ? lane.tail.then(execute, execute) : execute();
    const tail = next.catch(() => {});
    lane.tail = tail;
    tail.then(() => {
      if (lane.tail === tail) lane.tail = null;
    });
    return next;
  }

  function abort(key) {
    const lane = lanes.get(key);
    if (!lane) return;
    lane.generation += 1;
    lane.activeController?.abort();
  }

  async function lifecycleCommand(command, chat, key) {
    const preview = await applyCommand(command, chat);
    if (!preview?.sessionAction) return preview;
    const released = await runPrompt?.release?.(key);
    return applyCommand(command, {
      ...chat,
      sessionFile: released?.sessionFile ?? chat.sessionFile ?? null,
    });
  }

  async function release(key) {
    const lane = lanes.get(key);
    if (!lane) return;
    abort(key);
    const tail = lane.tail;
    await tail;
    if (lanes.get(key) === lane && lane.tail === null) lanes.delete(key);
  }

  async function dispose() {
    disposed = true;
    const pending = [];
    for (const [key, lane] of lanes) {
      abort(key);
      if (lane.tail) pending.push(lane.tail);
    }
    await Promise.all(pending);
    lanes.clear();
    await runPrompt?.dispose?.();
  }

  return {
    abort,
    release,
    dispose,

    async work({ inbound, chat }) {
      const command = parseFeishuCommand(inbound.text);
      if (command?.name === "stop") {
        abort(inbound.key);
        return STOPPED;
      }
      if (command) {
        return enqueue(inbound.key, () =>
          lifecycleCommand(command, chat, inbound.key),
        );
      }
      if (typeof runPrompt !== "function") {
        return { text: "已收到。改代码的能力还没接上。" };
      }
      return enqueue(inbound.key, async (lane, generation) => {
        const controller = new AbortController();
        lane.activeController = controller;
        try {
          const result = await runPrompt({
            folder: chat.folder,
            sessionFile: chat.sessionFile ?? null,
            text: inbound.text,
            inbound,
            signal: controller.signal,
            confirm: confirm ?? (async () => true),
          });
          if (controller.signal.aborted || generation !== lane.generation) {
            return STOPPED;
          }
          return result ?? { text: "没有回复。" };
        } catch (error) {
          if (controller.signal.aborted || generation !== lane.generation) {
            return STOPPED;
          }
          throw error;
        } finally {
          if (lane.activeController === controller) {
            lane.activeController = null;
          }
        }
      });
    },
  };
}
