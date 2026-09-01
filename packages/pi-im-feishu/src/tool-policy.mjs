import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const FILE_TOOLS = new Set(["read", "grep", "find", "ls", "edit", "write"]);

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

async function inspectToolPath(folder, inputPath) {
  if (typeof folder !== "string" || !folder || typeof inputPath !== "string" || !inputPath) {
    return { inside: false, exists: false };
  }

  let root;
  try {
    root = await realpath(folder);
  } catch {
    return { inside: false, exists: false };
  }

  const target = resolve(folder, inputPath);
  if (!inside(resolve(folder), target)) return { inside: false, exists: false };

  let current = target;
  let targetExists = false;
  while (true) {
    try {
      await lstat(current);
      const actual = await realpath(current);
      return { inside: inside(root, actual), exists: current === target };
    } catch (error) {
      if (error.code !== "ENOENT") return { inside: false, exists: false };
      if (current === target) targetExists = false;
      const parent = dirname(current);
      if (parent === current) return { inside: false, exists: targetExists };
      current = parent;
    }
  }
}

function isPathOutsideFolder(token, folder) {
  const value = token.includes("=") ? token.slice(token.indexOf("=") + 1) : token;
  if (!value || value.startsWith("-") || value === ".") return false;
  if (value === "~" || value.startsWith("~/")) return true;
  if (!isAbsolute(value) && !value.startsWith("..") && !value.includes("/")) return false;
  return !inside(resolve(folder), resolve(folder, value));
}

function clearlyReadOnlyBash(command, folder) {
  if (/[|;&><`$()\\\n]/.test(command)) return false;
  const tokens = command.trim().split(/\s+/);
  if (tokens.some((token) => isPathOutsideFolder(token, folder))) return false;
  if (tokens.length === 1 && tokens[0] === "pwd") return true;
  if (tokens[0] === "ls" || tokens[0] === "grep") return true;
  if (tokens[0] === "rg") {
    return !tokens.some((token) => token === "--pre" || token.startsWith("--pre="));
  }
  if (tokens[0] !== "git") return false;
  const gitCommand = tokens[1];
  if (!["status", "diff", "log", "show"].includes(gitCommand)) return false;
  const flags = {
    status: new Set(["--short", "-s", "--porcelain", "--branch", "-b"]),
    diff: new Set([
      "--stat", "--shortstat", "--numstat", "--name-only", "--name-status",
      "--summary", "--check", "--cached", "--staged", "--patch", "-p", "--raw",
      "--no-index", "--", "--color", "--no-color",
    ]),
    log: new Set(["--oneline", "--stat", "--shortstat", "--name-only", "--name-status", "--patch", "-p", "--", "--color", "--no-color"]),
    show: new Set(["--stat", "--shortstat", "--name-only", "--name-status", "--patch", "-p", "--", "--color", "--no-color"]),
  }[gitCommand];
  return tokens.slice(2).every((token) => {
    if (!token.startsWith("-") || flags.has(token)) return true;
    return /^-\d+$/.test(token) || /^-U\d+$/.test(token) || /^(--format|--pretty|--max-count|--since|--until|--color)=/.test(token);
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSensitive(value, secrets = []) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const secret of secrets) {
    const normalized = String(secret ?? "");
    if (normalized) text = text.replace(new RegExp(escapeRegExp(normalized), "g"), "[REDACTED]");
  }
  text = text.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]");
  text = text.replace(
    /((?:app[_-]?secret|api[_-]?key|access[_-]?token|password)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,
    "$1[REDACTED]",
  );
  return text;
}

function detailFor(name, input, secrets) {
  const raw = name === "bash" ? String(input.command ?? "") : JSON.stringify(input ?? {});
  return redactSensitive(raw, secrets).slice(0, 500);
}

export async function classifyToolCall(name, input = {}, { folder, secrets = [] } = {}) {
  const tool = String(name ?? "");
  const detail = detailFor(tool, input, secrets);

  if (tool === "bash") {
    const command = String(input.command ?? "");
    return {
      blocked: false,
      confirm: !clearlyReadOnlyBash(command, folder),
      detail,
      ...(command ? {} : { reason: "missing-command" }),
    };
  }

  if (!FILE_TOOLS.has(tool)) {
    return { blocked: false, confirm: true, detail, reason: "unknown-tool" };
  }

  const defaultPath = ["grep", "find", "ls"].includes(tool) ? "." : undefined;
  const checked = await inspectToolPath(folder, input.path ?? defaultPath);
  if (!checked.inside) {
    return { blocked: true, confirm: false, detail, reason: "outside-workspace" };
  }
  if (tool === "edit") return { blocked: false, confirm: true, detail };
  if (tool === "write") return { blocked: false, confirm: checked.exists, detail };
  return { blocked: false, confirm: false, detail };
}
