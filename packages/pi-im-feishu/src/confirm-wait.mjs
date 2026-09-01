import { confirmText, userConfirmed } from "./important.mjs";

const WAIT_MS = 120_000;

function decisionFor(text) {
  if (userConfirmed(text)) return "confirmed";
  const value = String(text ?? "").trim();
  return value === "拒绝" || /^\/?reject$/i.test(value) ? "rejected" : null;
}

export function createConfirmWait(send) {
  const pending = new Map();

  return {
    take(inbound) {
      const waiter = pending.get(inbound?.key);
      if (!waiter) return null;
      if (Date.now() > waiter.expiresAt) {
        clearTimeout(waiter.timer);
        pending.delete(inbound.key);
        waiter.resolve(false);
        return null;
      }
      if (!waiter.senderOpenId || inbound.senderOpenId !== waiter.senderOpenId)
        return null;
      if (waiter.kind !== "p2p" && inbound.mentioned !== true) return null;
      const decision = decisionFor(inbound.text);
      if (!decision) return null;
      clearTimeout(waiter.timer);
      pending.delete(inbound.key);
      waiter.resolve(decision === "confirmed");
      return decision;
    },

    async ask({ inbound, kind, detail }) {
      const previous = pending.get(inbound.key);
      if (previous) {
        clearTimeout(previous.timer);
        previous.resolve(false);
      }

      let waiter;
      const asked = new Promise((resolve) => {
        waiter = {
          senderOpenId: inbound.senderOpenId,
          sourceMessageId: inbound.messageId,
          kind: inbound.kind,
          expiresAt: Date.now() + WAIT_MS,
          resolve,
          timer: setTimeout(() => {
            if (pending.get(inbound.key) === waiter)
              pending.delete(inbound.key);
            resolve(false);
          }, WAIT_MS),
        };
        pending.set(inbound.key, waiter);
      });
      try {
        await send?.({
          chatId: inbound.chatId,
          text: confirmText({ kind, detail }),
          inbound,
        });
      } catch (error) {
        if (pending.get(inbound.key) === waiter) pending.delete(inbound.key);
        clearTimeout(waiter.timer);
        waiter.resolve(false);
        throw error;
      }
      return asked;
    },
  };
}
