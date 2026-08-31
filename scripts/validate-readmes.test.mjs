import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  PACKAGE_README_SECTIONS,
  ROOT_README_SECTIONS,
  readReadmeSections,
  validateReadme,
  validateReadmes
} from "./validate-readmes.mjs";

const readme = (sections) => [
  "# Project",
  ...sections.flatMap((section) => ["", `## ${section}`, "", "Useful details."])
].join("\n");

test("pins the required README section names", () => {
  assert.deepEqual(ROOT_README_SECTIONS, [
    "About", "Features", "Curated Catalog", "Repository Structure", "Development",
    "Contributing", "Security", "Roadmap", "License"
  ]);
  assert.deepEqual(PACKAGE_README_SECTIONS, [
    "About", "Installation", "Quick Start", "Commands, Tools, and Shortcuts",
    "Configuration", "Environment Variables", "Permissions and Security",
    "Known Conflicts", "Update and Rollback", "Compatibility", "License"
  ]);
});

test("reads README sections from markdown", () => {
  assert.deepEqual(readReadmeSections(readme(["About", "License"])), [
    { name: "About", body: ["", "Useful details.", ""] },
    { name: "License", body: ["", "Useful details."] }
  ]);
});

test("accepts complete root and Package README structures", () => {
  assert.deepEqual(validateReadme(readme(ROOT_README_SECTIONS), ROOT_README_SECTIONS, "README.md"), []);
  assert.deepEqual(validateReadme(readme(PACKAGE_README_SECTIONS), PACKAGE_README_SECTIONS, "Package README"), []);
});

test("rejects missing, duplicate, and empty required sections", () => {
  const markdown = "# Project\n\n## About\n\n## About\n\nDuplicate.\n";
  const errors = validateReadme(markdown, ["About", "License"], "README.md");

  assert(errors.some((error) => error.includes("duplicate section: About")));
  assert(errors.some((error) => error.includes("empty section: About")));
  assert(errors.some((error) => error.includes("missing section: License")));
});

test("validates root translations and discovered Package READMEs", async () => {
  const root = await mkdtemp(join(tmpdir(), "kedoupi-readmes-"));
  const packageDir = join(root, "packages", "pi-demo");
  await mkdir(packageDir, { recursive: true });
  await writeFile(join(root, "README.md"), readme(ROOT_README_SECTIONS));
  await writeFile(join(root, "README.zh-CN.md"), readme(ROOT_README_SECTIONS));
  await writeFile(join(packageDir, "package.json"), "{}");
  await writeFile(join(packageDir, "README.md"), readme(PACKAGE_README_SECTIONS));

  assert.deepEqual(await validateReadmes(root), []);

  await writeFile(join(packageDir, "README.md"), "# Demo\n");
  assert((await validateReadmes(root)).some((error) => error.includes("missing section: Installation")));

  await rm(join(root, "README.zh-CN.md"));
  assert((await validateReadmes(root)).some((error) => error.includes("README.zh-CN.md: missing README")));
});

test("requires suite membership and switching instructions", async () => {
  const root = await mkdtemp(join(tmpdir(), "kedoupi-suite-readme-"));
  const packageDir = join(root, "packages", "pi-suite");
  await mkdir(packageDir, { recursive: true });
  await writeFile(join(root, "README.md"), readme(ROOT_README_SECTIONS));
  await writeFile(join(root, "README.zh-CN.md"), readme(ROOT_README_SECTIONS));
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ name: "@kedoupi/pi-suite" }));
  await writeFile(join(packageDir, "README.md"), readme(PACKAGE_README_SECTIONS));

  const errors = await validateReadmes(root);
  assert(errors.some((error) => error.includes("missing section: Suite Members")));
  assert(errors.some((error) => error.includes("missing section: Switching Installation Modes")));
});
