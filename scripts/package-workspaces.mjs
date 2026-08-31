import { access, readFile, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const resourceKeys = ["extensions", "skills", "prompts", "themes"];
const lifecycleScripts = ["preinstall", "install", "postinstall"];
const exists = (path) => access(path).then(() => true, () => false);
const nonEmpty = (value) => typeof value === "string" && value.trim() !== "";

export async function discoverPackageDirs(root) {
  const packagesDir = join(root, "packages");
  const entries = await readdir(packagesDir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  return (await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const dir = join(packagesDir, entry.name);
      return (await exists(join(dir, "package.json"))) ? dir : null;
    })))
    .filter(Boolean)
    .sort();
}

export async function validatePackageDir(dir) {
  const errors = [];
  let manifest;

  try {
    manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  } catch (error) {
    return [`${dir}: invalid package.json: ${error.message}`];
  }

  if (!/^@kedoupi\/pi-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name ?? "")) {
    errors.push(`${dir}: invalid @kedoupi/pi-* name`);
  }

  for (const key of ["version", "license"]) {
    if (!nonEmpty(manifest[key])) errors.push(`${dir}: ${key} must be a non-empty string`);
  }

  if (!Array.isArray(manifest.keywords) || !manifest.keywords.includes("pi-package")) {
    errors.push(`${dir}: keywords must include pi-package`);
  }

  const declared = resourceKeys.filter((key) => Array.isArray(manifest.pi?.[key]) && manifest.pi[key].length > 0);
  if (declared.length === 0) errors.push(`${dir}: pi must declare at least one resource type`);

  const rawBundled = manifest.bundledDependencies ?? manifest.bundleDependencies ?? [];
  const bundled = Array.isArray(rawBundled) ? rawBundled : [];
  if (!Array.isArray(rawBundled) || bundled.some((name) => !nonEmpty(name))) {
    errors.push(`${dir}: bundledDependencies must be an array of package names`);
  }

  for (const key of declared) {
    for (const resource of manifest.pi[key]) {
      if (!nonEmpty(resource) || /[*?![\]]/.test(resource)) {
        errors.push(`${dir}: ${key} resources must use literal paths: ${resource}`);
        continue;
      }

      const normalized = resource.replace(/^\.\//, "");
      const bundledResource = bundled.some((name) => (
        normalized === `node_modules/${name}` || normalized.startsWith(`node_modules/${name}/`)
      ));

      if (normalized.startsWith("node_modules/") && !bundledResource) {
        errors.push(`${dir}: undeclared bundled Pi resource: ${resource}`);
        continue;
      }

      if (bundledResource) continue;

      const fullPath = resolve(dir, normalized);
      if (!fullPath.startsWith(`${resolve(dir)}${sep}`) || !(await exists(fullPath))) {
        errors.push(`${dir}: missing Pi resource: ${resource}`);
      }
    }
  }

  for (const file of ["README.md", "CHANGELOG.md"]) {
    if (!(await exists(join(dir, file)))) errors.push(`${dir}: missing ${file}`);
  }

  for (const script of lifecycleScripts) {
    if (manifest.scripts?.[script]) errors.push(`${dir}: forbidden lifecycle script: ${script}`);
  }

  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (name.startsWith("@earendil-works/pi-") && range !== "*") {
      errors.push(`${dir}: ${name} peer dependency must use *`);
    }
  }

  for (const name of bundled) {
    const range = manifest.dependencies?.[name];
    if (typeof range !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(range)) {
      errors.push(`${dir}: bundled dependency ${name} must use an exact version in dependencies`);
    }
  }

  return errors;
}
