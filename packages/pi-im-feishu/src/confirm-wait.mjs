import { confirmText, userConfirmed } from "./important.mjs";

export function createConfirmWait(send) {
  const pending = new Map();

  return {
    take(key, text) {
      const waiter = pending.get(key);
      if (!waiter) return false;
      pending.delete(key);
      waiter(userConfirmed(text));
      return true;
    },

    async ask({ inbound, kind, detail }) {
      const key = inbound.key;
      const asked = new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(key);
          resolve(false);
        }, 120_000);
        pending.set(key, (value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
      await send?.({
        chatId: inbound.chatId,
        text: confirmText({ kind, detail }),
        inbound
      });
      return asked;
    }
  };
}
