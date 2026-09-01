/**
 * Login autostart is injectable so tests never write a real launchd plist.
 * Production installer is Task 2 macOS-only and must no-op when the user stopped.
 */
export function createAutostart({ install, uninstall } = {}) {
  return {
    async enable() {
      if (typeof install !== "function") return { enabled: false, reason: "unsupported" };
      await install();
      return { enabled: true };
    },
    async disable() {
      if (typeof uninstall !== "function") return { enabled: false, reason: "unsupported" };
      await uninstall();
      return { enabled: false };
    }
  };
}
