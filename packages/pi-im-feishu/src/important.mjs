const DESTRUCTIVE_BASH = /\b(rm|rmdir|dd|mkfs|chmod\s+777|curl\s+[^\n]*\|\s*(ba)?sh)\b/;

export function isImportantTool(name, input = {}) {
  const tool = String(name ?? "");
  if (tool === "bash" || tool === "shell") {
    return DESTRUCTIVE_BASH.test(String(input.command ?? ""));
  }
  if (tool === "write" || tool === "edit") {
    return input.overwrite === true || input.create === false;
  }
  if (tool === "delete" || tool === "rm") return true;
  return false;
}

export function confirmText({ kind, detail }) {
  return `需要确认后才继续：${kind}${detail ? `\n${detail}` : ""}\n回复「确认」继续，其它回复将跳过。`;
}

export function userConfirmed(text) {
  const value = String(text ?? "").trim();
  return value === "确认" || /^\/?confirm$/i.test(value);
}
