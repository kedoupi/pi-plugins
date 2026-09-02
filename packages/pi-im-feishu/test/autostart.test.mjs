import assert from "node:assert/strict";
import test from "node:test";
import { createAutostart } from "../src/autostart.mjs";
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
    },
  });
  await auto.enable();
  assert.match(written[0].body, /pi-im-feishu/);
  assert.ok(ctl.some((args) => args[0] === "bootstrap"));
  await auto.disable();
  assert.equal(removed.length, 1);
  assert.match(launchAgentPlist("/tmp/home & x"), /&amp;/);
});

test("launchctl fallback status is checked for enable and disable", async () => {
  const calls = [];
  const auto = macosAutostart("/tmp/home", {
    platform: "darwin",
    plistPath: "/tmp/com.kedoupi.pi-im-feishu.plist",
    mkdirFn: async () => {},
    write: async () => {},
    remove: async () => {},
    launchctl(args) {
      calls.push(args[0]);
      return { status: args[0] === "bootout" ? 1 : 7, stderr: "denied" };
    },
  });
  await assert.rejects(() => auto.enable(), /launchctl load failed.*denied/);
  await assert.rejects(() => auto.disable(), /launchctl unload failed.*denied/);
  assert.deepEqual(calls, [
    "bootout",
    "bootstrap",
    "load",
    "bootout",
    "unload",
  ]);
});

test("unsupported autostart reports explicit enable and disable status", async () => {
  const auto = createAutostart();
  assert.deepEqual(await auto.enable(), {
    enabled: false,
    reason: "unsupported",
  });
  assert.deepEqual(await auto.disable(), {
    enabled: false,
    reason: "unsupported",
  });
  assert.equal(
    (await macosAutostart("/tmp/home", { platform: "linux" }).enable()).reason,
    "unsupported",
  );
});
