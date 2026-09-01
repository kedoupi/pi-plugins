import assert from "node:assert/strict";
import test from "node:test";
import { launchAgentPlist, macosAutostart } from "../src/macos-autostart.mjs";

test("stop uninstalls autostart; enable writes injected plist and launchctl", async () => {
  const written = [];
  const removed = [];
  const ctl = [];
  const auto = macosAutostart("/tmp/home", {
    platform: "darwin",
    plistPath: "/tmp/com.kedoupi.pi-im-feishu.plist",
    mkdirFn: async () => {},
    write: async (path, body) => written.push({ path, body }),
    remove: async (path) => removed.push(path),
    launchctl: (args) => {
      ctl.push(args);
      return { status: 0 };
    }
  });
  await auto.enable();
  assert.match(written[0].body, /pi-im-feishu/);
  assert.ok(ctl.some((args) => args[0] === "bootstrap"));
  await auto.disable();
  assert.equal(removed.length, 1);
  assert.match(launchAgentPlist("/tmp/home & x"), /&amp;/);
});

test("non-mac autostart is a no-op", async () => {
  const auto = macosAutostart("/tmp/home", { platform: "linux" });
  assert.equal((await auto.enable()).reason, "unsupported");
});
