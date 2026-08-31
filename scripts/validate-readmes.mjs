import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverPackageDirs } from "./package-workspaces.mjs";

export const ROOT_README_SECTIONS = [
  "About",
  "Features",
  "Curated Catalog",
  "Repository Structure",
  "Development",
  "Contributing",
  "Security",
  "Roadmap",
  "License"
];

export const PACKAGE_README_SECTIONS = [
  "About",
  "Installation",
  "Quick Start",
  "Commands, Tools, and Shortcuts",
  "Configuration",
  "Environment Variables",
  "Permissions and Security",
  "Known Conflicts",
  "Update and Rollback",
  "Compatibility",
  "License"
];

export const SUITE_README_SECTIONS = [
  "Suite Members",
  "Switching Installation Modes"
];

export function readReadmeSections(markdown) {
  const sections = [];
  let current;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##[ \t]+(.+?)[ \t]*$/);
    if (heading) {
      current = { name: heading[1], body: [] };
      sections.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }
  return sections;
}

export function validateReadme(markdown, requiredSections, label) {
  const sections = readReadmeSections(markdown);
  const errors = [];
  for (const name of requiredSections) {
    const matches = sections.filter((section) => section.name === name);
    if (matches.length === 0) errors.push(`${label}: missing section: ${name}`);
    if (matches.length > 1) errors.push(`${label}: duplicate section: ${name}`);
    if (matches.some((section) => section.body.join("\n").trim() === "")) {
      errors.push(`${label}: empty section: ${name}`);
    }
  }
  return errors;
}

async function validateFile(path, sections) {
  try {
    return validateReadme(await readFile(path, "utf8"), sections, path);
  } catch (error) {
    if (error.code === "ENOENT") return [`${path}: missing README`];
    throw error;
  }
}

export async function validateReadmes(root) {
  const errors = [];
  for (const file of ["README.md", "README.zh-CN.md"]) {
    errors.push(...await validateFile(join(root, file), ROOT_README_SECTIONS));
  }
  for (const dir of await discoverPackageDirs(root)) {
    const manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    const sections = manifest.name === "@kedoupi/pi-suite"
      ? [...PACKAGE_README_SECTIONS, ...SUITE_README_SECTIONS]
      : PACKAGE_README_SECTIONS;
    errors.push(...await validateFile(join(dir, "README.md"), sections));
  }
  return errors;
}

async function main() {
  const errors = await validateReadmes(process.cwd());
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Validated README standards.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
