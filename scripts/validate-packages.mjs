import { fileURLToPath } from "node:url";
import { discoverPackageDirs, validatePackageDir } from "./package-workspaces.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dirs = await discoverPackageDirs(root);
const errors = (await Promise.all(dirs.map(validatePackageDir))).flat();

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${dirs.length} first-party packages.`);
}
