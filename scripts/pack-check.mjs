import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { discoverPackageDirs } from "./package-workspaces.mjs";

const forbidden = [
  /(^|\/)\.env(?:\.|$)/,
  /\.(?:pem|key)$/,
  /(^|\/)test\//,
  /(^|\/)coverage\//
];

const bundledPrefix = (name) => `package/node_modules/${name}/`;

export function findForbiddenTarballFiles(files, bundledDependencies = []) {
  return files.filter((file) => {
    if (forbidden.some((pattern) => pattern.test(file))) return true;
    if (!file.startsWith("package/node_modules/")) return false;
    return !bundledDependencies.some((name) => file.startsWith(bundledPrefix(name)));
  }).sort();
}

export function findUntrackedTarballFiles(files, trackedFiles) {
  const tracked = new Set(trackedFiles);
  return files
    .map((file) => file.replace(/^package\//, ""))
    .filter((file) => !file.startsWith("node_modules/") && !tracked.has(file))
    .sort();
}

async function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dirs = await discoverPackageDirs(root);

  for (const dir of dirs) {
    const manifest = JSON.parse(await readFile(`${dir}/package.json`, "utf8"));
    const bundled = manifest.bundledDependencies ?? manifest.bundleDependencies ?? [];
    const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: dir,
      encoding: "utf8"
    });

    if (result.status !== 0) throw new Error(result.stderr || result.stdout);

    const report = JSON.parse(result.stdout)[0];
    const files = report.files.map(({ path }) => `package/${path}`);
    const rejected = findForbiddenTarballFiles(files, bundled);
    if (rejected.length) throw new Error(`${report.name}: forbidden tarball files\n${rejected.join("\n")}`);

    const git = spawnSync("git", ["ls-files", "-z", "--cached", "--", "."], {
      cwd: dir,
      encoding: "utf8"
    });
    if (git.status !== 0) throw new Error(git.stderr || git.stdout);
    const untracked = findUntrackedTarballFiles(files, git.stdout.split("\0").filter(Boolean));
    if (untracked.length) throw new Error(`${report.name}: untracked tarball files\n${untracked.join("\n")}`);
  }

  console.log(`Checked ${dirs.length} package tarballs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
