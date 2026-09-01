export function createAutostart({ install, uninstall } = {}) {
  return {
    async enable() {
      if (typeof install !== "function") {
        return { enabled: false, reason: "unsupported" };
      }
      await install();
      return { enabled: true };
    },
    async disable() {
      if (typeof uninstall !== "function") {
        return { enabled: false, reason: "unsupported" };
      }
      await uninstall();
      return { enabled: false };
    },
  };
}
