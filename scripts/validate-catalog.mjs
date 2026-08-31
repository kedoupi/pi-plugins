import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const statuses = new Set(["community", "tested", "reviewed", "deprecated"]);
const requiredStrings = [
  "id", "name", "package", "repository", "install", "summary",
  "recommendation", "license", "status"
];

export async function readCatalog(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function validateCatalog(entries) {
  if (!Array.isArray(entries)) return ["catalog must be an array"];
  const errors = [];
  const ids = new Set();
  const packages = new Set();

  entries.forEach((entry, index) => {
    const at = `entry ${index}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${at}: must be an object`);
      return;
    }
    for (const key of requiredStrings) {
      if (typeof entry[key] !== "string" || entry[key].trim() === "") {
        errors.push(`${at}: ${key} must be a non-empty string`);
      }
    }
    for (const key of ["categories", "conflicts", "notes"]) {
      if (!Array.isArray(entry[key]) || entry[key].some((value) => typeof value !== "string")) {
        errors.push(`${at}: ${key} must be an array of strings`);
      }
    }
    if (typeof entry.id === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) {
      errors.push(`${at}: id must be lowercase kebab-case`);
    }
    if (typeof entry.repository === "string" && !entry.repository.startsWith("https://github.com/")) {
      errors.push(`${at}: repository must be an https://github.com URL`);
    }
    if (typeof entry.package === "string" && entry.install !== `pi install npm:${entry.package}`) {
      errors.push(`${at}: install must match package`);
    }
    if (!statuses.has(entry.status)) errors.push(`${at}: invalid status`);

    const evidence = ["testedVersion", "testedPiVersion", "testedAt"];
    if (entry.status === "tested" || entry.status === "reviewed") {
      for (const key of evidence) {
        if (typeof entry[key] !== "string" || entry[key].trim() === "") {
          errors.push(`${at}: ${key} is required for ${entry.status}`);
        }
      }
    } else {
      for (const key of evidence) {
        if (entry[key] !== null && typeof entry[key] !== "string") {
          errors.push(`${at}: ${key} must be a string or null`);
        }
      }
    }
    if (typeof entry.testedAt === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(entry.testedAt)) {
      errors.push(`${at}: testedAt must use YYYY-MM-DD`);
    }
    if (ids.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
    if (packages.has(entry.package)) errors.push(`duplicate package: ${entry.package}`);
    ids.add(entry.id);
    packages.add(entry.package);
  });

  return errors;
}

async function main() {
  const entries = await readCatalog(new URL("../catalog/plugins.json", import.meta.url));
  const errors = validateCatalog(entries);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${entries.length} catalog entries.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
