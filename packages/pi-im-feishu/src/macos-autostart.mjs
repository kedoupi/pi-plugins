import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAutostart } from "./autostart.mjs";
import { assistantScriptPath, HOME_ENV } from "./paths.mjs";
import { escapeXml } from "./xml.mjs";

export const LAUNCH_LABEL = "com.kedoupi.pi-im-feishu";

export function launchAgentPath() {
  return join(homedir(), "Library", "LaunchAgents", `${LAUNCH_LABEL}.plist`);
}

export function launchAgentPlist(home) {
  const script = escapeXml(fileURLToPath(assistantScriptPath()));
  const node = escapeXml(process.execPath);
  const homeXml = escapeXml(home);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${script}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>${HOME_ENV}</key>
    <string>${homeXml}</string>
    <key>PI_IM_FEISHU_ASSISTANT</key>
    <string>1</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
`;
}

export function macosAutostart(home, {
  write = writeFile,
  remove = rm,
  mkdirFn = mkdir,
  platform = process.platform,
  plistPath,
  launchctl
} = {}) {
  if (platform !== "darwin") return createAutostart();
  const path = plistPath ?? launchAgentPath();
  const run = launchctl ?? ((args) => spawnSync("launchctl", args, { encoding: "utf8" }));
  const domain = `gui/${process.getuid?.() ?? 501}`;
  return createAutostart({
    install: async () => {
      await mkdirFn(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
      await write(path, launchAgentPlist(home), "utf8");
      run(["bootout", domain, path]);
      const loaded = run(["bootstrap", domain, path]);
      if (loaded?.status !== 0) run(["load", "-w", path]);
    },
    uninstall: async () => {
      run(["bootout", domain, path]);
      run(["unload", "-w", path]);
      await remove(path, { force: true });
    }
  });
}
