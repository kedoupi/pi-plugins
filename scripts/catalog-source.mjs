const npmSource = /^npm:(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const gitSource = /^git:github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function catalogInstall(source) {
  if (typeof source !== "string") return null;
  if (npmSource.test(source)) return `pi install ${source}`;
  if (gitSource.test(source) && !source.endsWith(".git")) return `pi install ${source}`;
  return null;
}
