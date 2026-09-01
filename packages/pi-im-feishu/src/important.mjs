export function isImportantTool(name, input = {}) {
  const tool = String(name ?? "");
  if (tool === "bash" || tool === "shell") {
    const command = String(input.command ?? "").trim();
    return command !== "pwd" && command !== "ls";
  }
  return ["write", "edit", "delete", "rm"].includes(tool);
}

export function confirmText({ kind, detail }) {
  return `需要确认后才继续：${kind}${detail ? `\n${detail}` : ""}\n回复「确认」继续，回复「拒绝」跳过。`;
}

export function userConfirmed(text) {
  const value = String(text ?? "").trim();
  return value === "确认" || /^\/?confirm$/i.test(value);
}
