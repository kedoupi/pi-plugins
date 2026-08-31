import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { catalogInstall } from "./catalog-source.mjs";
import { readReadmeSections, validateReadme } from "./validate-readmes.mjs";

const statuses = new Set(["community", "tested", "reviewed", "deprecated"]);
const requiredStrings = [
  "id", "name", "source", "repository", "summary",
  "recommendation", "license", "status", "researchedVersion", "researchedAt"
];

export const CATALOG_DETAIL_SECTIONS = [
  "About",
  "Best For",
  "Capabilities",
  "Installation",
  "Quick Start",
  "Commands and Tools",
  "Configuration",
  "Permissions and Security",
  "Compatibility",
  "Limitations",
  "Upstream and License"
];

export async function readCatalog(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function validateCatalog(entries) {
  if (!Array.isArray(entries)) return ["catalog must be an array"];
  const errors = [];
  const ids = new Set();
  const sources = new Set();

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
    for (const key of ["package", "install"]) {
      if (Object.hasOwn(entry, key)) errors.push(`${at}: legacy field: ${key}`);
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
    if (catalogInstall(entry.source) === null) {
      errors.push(`${at}: invalid source: ${entry.source}`);
    }
    if (typeof entry.researchedAt === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(entry.researchedAt)) {
      errors.push(`${at}: researchedAt must use YYYY-MM-DD`);
    }
    if (
      typeof entry.source === "string" &&
      entry.source.startsWith("git:") &&
      typeof entry.repository === "string" &&
      entry.repository !== `https://${entry.source.slice("git:".length)}`
    ) {
      errors.push(`${at}: Git source must match repository`);
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
    if (sources.has(entry.source)) errors.push(`duplicate source: ${entry.source}`);
    ids.add(entry.id);
    sources.add(entry.source);
  });

  return errors;
}

function findSection(sections, name) {
  const matches = sections.filter((section) => section.name === name);
  return matches.length === 1 ? matches[0] : null;
}

function validateDetailMarkdown(entry, path, markdown, language) {
  const errors = [...validateReadme(markdown, CATALOG_DETAIL_SECTIONS, path)];
  const sections = readReadmeSections(markdown);

  for (const token of [`[English](./${entry.id}.md)`, `[简体中文](./${entry.id}.zh-CN.md)`]) {
    if (!markdown.includes(token)) errors.push(`${path}: missing language link: ${token}`);
  }

  const disclaimer = language === "English"
    ? "Documentation review only; not a security guarantee."
    : "仅审阅公开文档；不构成安全保证。";
  if (!markdown.includes(disclaimer)) errors.push(`${path}: missing disclaimer: ${disclaimer}`);
  if (!markdown.includes(entry.researchedVersion)) {
    errors.push(`${path}: missing researched version: ${entry.researchedVersion}`);
  }
  if (!markdown.includes(entry.researchedAt)) {
    errors.push(`${path}: missing researched date: ${entry.researchedAt}`);
  }

  const install = catalogInstall(entry.source);
  const installation = findSection(sections, "Installation");
  if (install && installation && !installation.body.join("\n").includes(install)) {
    errors.push(`${path}: Installation must include: ${install}`);
  }

  const upstream = findSection(sections, "Upstream and License");
  const upstreamBody = upstream?.body.join("\n") ?? "";
  if (upstream && !upstreamBody.includes(entry.repository)) {
    errors.push(`${path}: Upstream and License must include repository: ${entry.repository}`);
  }
  if (upstream && !upstreamBody.includes(entry.license)) {
    errors.push(`${path}: Upstream and License must include license: ${entry.license}`);
  }

  return errors;
}

export async function validateCatalogDetails(entries, detailsDir) {
  const errors = [];
  let detailFiles = [];

  try {
    detailFiles = (await readdir(detailsDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const expectedFiles = new Set();
  for (const entry of entries) {
    for (const name of [`${entry.id}.md`, `${entry.id}.zh-CN.md`]) {
      expectedFiles.add(name);
      const path = join(detailsDir, name);
      if (!detailFiles.includes(name)) {
        errors.push(`${path}: missing catalog detail`);
        continue;
      }

      const markdown = await readFile(path, "utf8");
      const language = name.endsWith(".zh-CN.md") ? "Chinese" : "English";
      errors.push(...validateDetailMarkdown(entry, path, markdown, language));
    }
  }

  for (const name of detailFiles) {
    if (!expectedFiles.has(name)) {
      errors.push(`${join(detailsDir, name)}: orphaned catalog detail`);
    }
  }

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
