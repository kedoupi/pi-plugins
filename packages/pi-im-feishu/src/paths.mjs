import { homedir } from "node:os";
import { join } from "node:path";

export const HOME_ENV = "PI_IM_FEISHU_HOME";
export const STALE_MS = 30_000;
export const HEARTBEAT_MS = 5_000;

export function defaultHome() {
  const override = process.env[HOME_ENV]?.trim();
  if (override) return override;
  return join(homedir(), ".pi", "agent", "pi-im-feishu");
}

export function configPath(home) {
  return join(home, "config.json");
}

export function secretsPath(home) {
  return join(home, "secrets.json");
}

export function lockPath(home) {
  return join(home, "assistant.lock");
}

export function logPath(home) {
  return join(home, "assistant.log");
}

export function assistantScriptPath() {
  return new URL("../bin/assistant.mjs", import.meta.url);
}
