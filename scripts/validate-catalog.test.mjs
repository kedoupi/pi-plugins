import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CATALOG_DETAIL_SECTIONS,
  validateCatalog,
  validateCatalogDetails
} from "./validate-catalog.mjs";

const valid = {
  id: "example",
  name: "Example",
  source: "npm:example-pi-package",
  repository: "https://github.com/example/project",
  categories: ["workflow"],
  summary: "A concise summary.",
  recommendation: "A concrete recommendation.",
  license: "MIT",
  status: "tested",
  researchedVersion: "1.2.3",
  researchedAt: "2026-08-31",
  testedVersion: "1.2.3",
  testedPiVersion: "0.84.4",
  testedAt: "2026-08-31",
  conflicts: [],
  notes: []
};

const detailValid = {
  ...valid,
  status: "community",
  testedVersion: null,
  testedPiVersion: null,
  testedAt: null
};

const detailMarkdown = (entry, language) => `# ${entry.name}

[English](./${entry.id}.md) | [简体中文](./${entry.id}.zh-CN.md)

> Research basis: ${entry.researchedVersion}, checked ${entry.researchedAt}.
> ${language === "English" ? "Documentation review only; not a security guarantee." : "仅审阅公开文档；不构成安全保证。"}

## About
${language} about.

## Best For
${language} audience.

## Capabilities
- Capability.

## Installation
\`\`\`bash
pi install ${entry.source}
\`\`\`

## Quick Start
Run one command.

## Commands and Tools
Use the main tool.

## Configuration
No required configuration.

## Permissions and Security
Review permissions.

## Compatibility
See upstream compatibility.

## Limitations
No additional limitations documented.

## Upstream and License
- Repository: ${entry.repository}
- License: ${entry.license}
`;

async function createDetailFixture(t, mutate) {
  const root = await mkdtemp(join(tmpdir(), "kedoupi-catalog-details-"));
  const detailsDir = join(root, "catalog", "details");
  const englishPath = join(detailsDir, `${detailValid.id}.md`);
  const chinesePath = join(detailsDir, `${detailValid.id}.zh-CN.md`);

  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(detailsDir, { recursive: true });
  await writeFile(englishPath, detailMarkdown(detailValid, "English"));
  await writeFile(chinesePath, detailMarkdown(detailValid, "Chinese"));

  const context = { detailsDir, englishPath, chinesePath, valid: detailValid };
  if (mutate) await mutate(context);
  return context;
}

test("pins the required detail section names", () => {
  assert.deepEqual(CATALOG_DETAIL_SECTIONS, [
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
  ]);
});

test("accepts canonical npm and Git sources", () => {
  assert.deepEqual(validateCatalog([valid]), []);
  assert.deepEqual(validateCatalog([{
    ...valid,
    id: "git-example",
    source: "git:github.com/example/project"
  }]), []);
});

test("rejects pinned, malformed, duplicate, and legacy sources", () => {
  const errors = validateCatalog([
    { ...valid, id: "pinned", source: "npm:example-pi-package@1.2.3", package: "example-pi-package" },
    { ...valid, id: "malformed", source: "https://github.com/example/project" },
    { ...valid, id: "duplicate-a" },
    { ...valid, id: "duplicate-b", install: "pi install npm:example-pi-package" }
  ]);
  assert(errors.some((error) => error.includes("invalid source")));
  assert(errors.some((error) => error.includes("duplicate source")));
  assert(errors.some((error) => error.includes("legacy field: package")));
  assert(errors.some((error) => error.includes("legacy field: install")));
});

test("requires researched metadata and matching Git repository", () => {
  const errors = validateCatalog([{
    ...valid,
    source: "git:github.com/other/project",
    researchedVersion: "",
    researchedAt: "31-08-2026"
  }]);
  assert(errors.some((error) => error.includes("researchedVersion")));
  assert(errors.some((error) => error.includes("researchedAt")));
  assert(errors.some((error) => error.includes("Git source must match repository")));
});

test("requires test evidence for tested and reviewed entries", () => {
  const errors = validateCatalog([{ ...valid, testedAt: null }]);
  assert(errors.some((error) => error.includes("testedAt")));
});

test("community entries use null test evidence", () => {
  const entry = {
    ...valid,
    status: "community",
    testedVersion: null,
    testedPiVersion: null,
    testedAt: null
  };
  assert.deepEqual(validateCatalog([entry]), []);
});

test("rejects self-awarded reviewed entries without evidence", () => {
  const errors = validateCatalog([{ ...valid, status: "reviewed", testedVersion: null }]);
  assert(errors.some((error) => error.includes("testedVersion")));
});

test("accepts matching bilingual detail pages", async (t) => {
  const { detailsDir, valid: entry } = await createDetailFixture(t);
  assert.deepEqual(await validateCatalogDetails([entry], detailsDir), []);
});

test("reports missing Chinese detail pages", async (t) => {
  const { detailsDir, chinesePath, valid: entry } = await createDetailFixture(t, ({ chinesePath }) => rm(chinesePath));
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(chinesePath) && error.includes("missing catalog detail")));
});

test("reports orphan detail files", async (t) => {
  const { detailsDir, valid: entry } = await createDetailFixture(t, ({ detailsDir }) => writeFile(join(detailsDir, "orphan.md"), "# Orphan\n"));
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(join(detailsDir, "orphan.md")) && error.includes("orphaned catalog detail")));
});

test("reports missing Permissions and Security sections", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(englishPath, detailMarkdown(valid, "English").replace("## Permissions and Security", "## Permissions"));
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("missing section: Permissions and Security")));
});

test("reports duplicate Installation sections", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace(
        "## Installation\n```bash\npi install npm:example-pi-package\n```\n\n## Quick Start",
        "## Installation\n```bash\npi install npm:example-pi-package\n```\n\n## Installation\nSecond install block.\n\n## Quick Start"
      )
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("duplicate section: Installation")));
});

test("reports empty Installation sections", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace(
        "## Installation\n```bash\npi install npm:example-pi-package\n```\n\n",
        "## Installation\n\n"
      )
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("empty section: Installation")));
});

test("reports missing reciprocal language links", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace(" | [简体中文](./example.zh-CN.md)", "")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("missing language link")));
});

test("reports missing English disclaimers", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace("Documentation review only; not a security guarantee.", "")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("missing disclaimer")));
});

test("reports missing Chinese disclaimers", async (t) => {
  const { detailsDir, chinesePath, valid: entry } = await createDetailFixture(t, async ({ chinesePath, valid }) => {
    await writeFile(
      chinesePath,
      detailMarkdown(valid, "Chinese").replace("仅审阅公开文档；不构成安全保证。", "")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(chinesePath) && error.includes("missing disclaimer")));
});

test("reports wrong installation commands", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace("pi install npm:example-pi-package", "pi install npm:wrong-package")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("Installation must include")));
});

test("reports wrong researched versions", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace("Research basis: 1.2.3", "Research basis: 9.9.9")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("missing researched version")));
});

test("reports wrong researched dates", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace("checked 2026-08-31", "checked 2026-09-01")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("missing researched date")));
});

test("reports wrong upstream repository URLs", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(
      englishPath,
      detailMarkdown(valid, "English").replace(valid.repository, "https://github.com/example/wrong")
    );
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("must include repository")));
});

test("reports wrong upstream licenses", async (t) => {
  const { detailsDir, englishPath, valid: entry } = await createDetailFixture(t, async ({ englishPath, valid }) => {
    await writeFile(englishPath, detailMarkdown(valid, "English").replace("- License: MIT", "- License: Apache-2.0"));
  });
  const errors = await validateCatalogDetails([entry], detailsDir);
  assert(errors.some((error) => error.includes(englishPath) && error.includes("must include license")));
});
