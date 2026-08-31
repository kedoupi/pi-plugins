# Kedoupi Pi Plugins Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the non-installable `kedoupi/pi-plugins` npm workspace, deterministic package/catalog validation, generated curated catalog, repository governance, CI, and the first catalog entries sourced from the user's installed Pi packages.

**Architecture:** The repository root is a private npm workspace with no Pi manifest. Node.js standard-library scripts validate JSON metadata and future first-party workspaces; Markdown is generated from the catalog source of truth. This plan deliberately stops before creating a first-party package, Suite, or publish workflow because no real first-party package has been selected.

**Tech Stack:** Node.js 22, npm workspaces, Node built-in test runner, GitHub Actions, JSON, Markdown

**Spec:** `docs/superpowers/specs/2026-08-31-kedoupi-pi-plugins-design.md`

## Global Constraints

- GitHub brand is `@kedoupi`; candidate repository is `kedoupi/pi-plugins`; candidate npm scope is `@kedoupi`.
- Root `package.json` must be private and must not contain a `pi` manifest.
- Use npm workspaces with `packages/*`; do not require pnpm or Bun.
- Node.js minimum is 22.
- Do not create an empty example package, empty Suite, package-development Skill, or publish workflow before a real first-party package exists.
- Third-party source code must not be copied into this repository.
- Catalog inclusion is manual; automation validates submissions but does not grant `tested` or `reviewed` status.
- No database, crawler, custom installer, backend service, or website in this plan.
- Use only Node.js standard-library code for repository validation and catalog rendering.
- Never commit API keys, auth files, `.env` files, private local paths, or private Package names discovered during inventory.
- Every mutation lane uses its own Git worktree; one writer per worktree.

## Deliverable File Map

| Path | Responsibility |
|---|---|
| `package.json` | Private npm workspace and root verification commands |
| `package-lock.json` | Reproducible npm metadata |
| `.gitignore` | Exclude dependencies, build output, secrets, and editor files |
| `LICENSE` | MIT license for repository-authored material |
| `README.md` | Brand landing page and contributor/user entry points |
| `AGENTS.md` | Always-on repository boundaries and verification commands |
| `.pi/settings.json` | Committed, secret-free project Pi configuration with no fake Package paths |
| `docs/package-standard.md` | Contract future first-party Packages must satisfy |
| `docs/development.md` | Isolated local development and global dogfood lifecycle |
| `docs/testing.md` | Automated and manual test gates |
| `docs/publishing.md` | Independent-version release policy and phase-two prerequisites |
| `docs/catalog-policy.md` | Third-party acceptance, status, and review policy |
| `catalog/plugins.json` | Source of truth for accepted public third-party entries |
| `CATALOG.md` | Generated human-readable catalog |
| `scripts/validate-catalog.mjs` | Catalog schema and cross-entry validation |
| `scripts/validate-catalog.test.mjs` | Catalog validator tests |
| `scripts/render-catalog.mjs` | Deterministic JSON-to-Markdown renderer and drift check |
| `scripts/render-catalog.test.mjs` | Renderer tests |
| `scripts/package-workspaces.mjs` | Discover future `packages/*/package.json` files |
| `scripts/validate-packages.mjs` | Validate future first-party Package manifests |
| `scripts/validate-packages.test.mjs` | Package validator tests using temporary fixtures |
| `scripts/pack-check.mjs` | Run `npm pack --dry-run --json` and reject forbidden tarball files |
| `scripts/pack-check.test.mjs` | Pure tarball-file policy tests |
| `.github/PULL_REQUEST_TEMPLATE.md` | General and catalog review checklist |
| `.github/workflows/ci.yml` | Pull-request and main-branch gates |

## Parallelization Map

1. Task 1 establishes shared root files and must merge first.
2. Tasks 2 and 4 are independent after Task 1 and may run in parallel worktrees.
3. Task 3 depends on Task 2's `validateCatalog(entries)` contract.
4. Task 5 depends on Tasks 2–4 because CI invokes their scripts.
5. Task 6 depends on Tasks 2 and 3; it may run in parallel with Task 5 after those dependencies merge.
6. Task 7 runs only after all prior tasks are integrated.

---

### Task 1: Private Workspace, Brand Landing Page, and Human Rules

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `.pi/settings.json`
- Create: `docs/package-standard.md`
- Create: `docs/development.md`
- Create: `docs/testing.md`
- Create: `docs/publishing.md`
- Create: `docs/catalog-policy.md`

**Interfaces:**
- Produces: root npm scripts named `check`, `test`, `pack:check`, `catalog:render`, and `catalog:check`.
- Produces: human rules consumed by every later task and executor.
- Consumes: approved design spec only.

- [ ] **Step 1: Create the private root manifest**

Create `package.json` exactly with the root boundaries and script names later tasks will implement:

```json
{
  "name": "kedoupi-pi-plugins",
  "version": "0.0.0",
  "private": true,
  "description": "Kedoupi first-party Pi Packages, development standards, and curated community catalog.",
  "license": "MIT",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "check": "node scripts/validate-packages.mjs && node scripts/validate-catalog.mjs && npm run catalog:check",
    "test": "node --test scripts/*.test.mjs",
    "pack:check": "node scripts/pack-check.mjs",
    "catalog:render": "node scripts/render-catalog.mjs",
    "catalog:check": "node scripts/render-catalog.mjs --check"
  }
}
```

Do not add a `pi` key or publish configuration.

- [ ] **Step 2: Create secret-safe repository defaults**

Create `.gitignore`:

```gitignore
node_modules/
*.tgz
coverage/
dist/
.env
.env.*
!.env.example
.DS_Store
.idea/
.vscode/
```

Create `.pi/settings.json` without fake local Package paths:

```json
{
  "packages": []
}
```

Copy the standard MIT license text into `LICENSE` with copyright holder `KeDouPi` and year `2026`.

- [ ] **Step 3: Generate the lockfile and verify the root is non-installable**

Run:

```bash
npm install --package-lock-only --ignore-scripts
node -e 'const p=require("./package.json"); if (!p.private || p.pi) process.exit(1)'
```

Expected: both commands exit 0; `package-lock.json` exists; root manifest has no `pi` key.

- [ ] **Step 4: Write the brand landing page**

Create `README.md` with these exact top-level sections and messages:

```markdown
# Kedoupi Pi Plugins

`@kedoupi` 的第一方 Pi Package、开发规范与人工精选目录。

> 非官方 Pi 生态项目。第三方条目保留原作者、许可证和上游链接；收录不构成绝对安全保证。

## First-party Packages

首个真实 Package 尚未加入。这里不会用空示例冒充可安装产品。

## Curated Catalog

浏览 [CATALOG.md](./CATALOG.md)。

## Development

- [Package standard](./docs/package-standard.md)
- [Development workflow](./docs/development.md)
- [Testing](./docs/testing.md)
- [Publishing](./docs/publishing.md)
- [Catalog policy](./docs/catalog-policy.md)

## Contributing

第三方推荐接受 Pull Request，但 `tested` 和 `reviewed` 状态只能由维护者授予。

## Security

Pi Extensions 以当前用户权限执行。安装任何第三方 Package 前都应检查源码和发布内容。
```

- [ ] **Step 5: Write always-on agent rules**

Create `AGENTS.md` containing these enforceable rules:

```markdown
# Repository Rules

- The root repository is private workspace infrastructure, never a Pi Package.
- First-party packages live only under `packages/` and use `@kedoupi/pi-*` names.
- Never vendor unmodified third-party source; catalog entries contain metadata and upstream links only.
- Do not create an example package, Suite, package-development Skill, or publish workflow until a real first-party package is selected.
- Do not add dependencies when Node.js standard-library code is sufficient.
- Never commit secrets, `.env` files, private local paths, or private inventory results.
- Run `npm run check`, `npm test`, and `npm run pack:check` before claiming completion.
- Publishing always requires explicit maintainer confirmation.
```

- [ ] **Step 6: Write the five human-facing policy documents**

Each file must use the design spec as canonical input and include the listed headings:

```text
docs/package-standard.md
  # First-party Package Standard
  ## Naming and ownership
  ## Required manifest fields
  ## Dependencies
  ## Documentation
  ## Security
  ## Definition of done

docs/development.md
  # Development Workflow
  ## Project trust
  ## Project-local loading
  ## Single-Package isolation
  ## Global dogfood
  ## Switching to the npm release

docs/testing.md
  # Testing Policy
  ## Type and unit checks
  ## Extension registration
  ## Package contents
  ## Manual lifecycle checks
  ## CI gates

docs/publishing.md
  # Publishing Policy
  ## Independent versions and tags
  ## Trusted Publishing
  ## Rollback
  ## First-package prerequisites

docs/catalog-policy.md
  # Catalog Policy
  ## Scope
  ## Required metadata
  ## Status definitions
  ## Manual review
  ## Security language
  ## Removal and deprecation
```

Use the exact commands and status meanings from the spec. State explicitly in `docs/publishing.md` that the publish workflow is created with the first real Package, not in the foundation phase.

- [ ] **Step 7: Verify and commit Task 1**

Run:

```bash
node -e 'JSON.parse(require("node:fs").readFileSync(".pi/settings.json", "utf8"))'
node -e 'const p=require("./package.json"); if (p.private !== true || p.pi || p.workspaces[0] !== "packages/*") process.exit(1)'
git diff --check
```

Expected: all commands exit 0.

Commit:

```bash
git add package.json package-lock.json .gitignore LICENSE README.md AGENTS.md .pi/settings.json docs/
git commit -m "chore: establish plugin hub foundation"
```

---

### Task 2: Catalog Schema Validator

**Files:**
- Create: `catalog/plugins.json`
- Create: `scripts/validate-catalog.mjs`
- Create: `scripts/validate-catalog.test.mjs`

**Interfaces:**
- Produces: `validateCatalog(entries: unknown): string[]`.
- Produces: `readCatalog(path: string | URL): Promise<unknown>`.
- Catalog entry fields: `id`, `name`, `package`, `repository`, `install`, `categories`, `summary`, `recommendation`, `license`, `status`, `testedVersion`, `testedPiVersion`, `testedAt`, `conflicts`, `notes`.
- Status values: `community | tested | reviewed | deprecated`.

- [ ] **Step 1: Add an empty source-of-truth catalog**

Create `catalog/plugins.json`:

```json
[]
```

An empty list is valid until Task 6 finishes evidence-based inventory.

- [ ] **Step 2: Write failing validator tests**

Create `scripts/validate-catalog.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { validateCatalog } from "./validate-catalog.mjs";

const valid = {
  id: "example",
  name: "Example",
  package: "example-pi-package",
  repository: "https://github.com/example/project",
  install: "pi install npm:example-pi-package",
  categories: ["workflow"],
  summary: "A concise summary.",
  recommendation: "A concrete recommendation.",
  license: "MIT",
  status: "tested",
  testedVersion: "1.2.3",
  testedPiVersion: "0.84.4",
  testedAt: "2026-08-31",
  conflicts: [],
  notes: []
};

test("accepts a valid tested entry", () => {
  assert.deepEqual(validateCatalog([valid]), []);
});

test("rejects duplicate ids and packages", () => {
  const errors = validateCatalog([valid, { ...valid, name: "Duplicate" }]);
  assert(errors.some((error) => error.includes("duplicate id: example")));
  assert(errors.some((error) => error.includes("duplicate package: example-pi-package")));
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
```

- [ ] **Step 3: Run tests and verify the intended failure**

Run:

```bash
node --test scripts/validate-catalog.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/validate-catalog.mjs`.

- [ ] **Step 4: Implement the validator**

Create `scripts/validate-catalog.mjs` with these exact public exports and policies:

```js
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
```

- [ ] **Step 5: Run focused and root tests**

Run:

```bash
node --test scripts/validate-catalog.test.mjs
node scripts/validate-catalog.mjs
```

Expected: 5 tests PASS; CLI prints `Validated 0 catalog entries.`

- [ ] **Step 6: Commit Task 2**

```bash
git add catalog/plugins.json scripts/validate-catalog.mjs scripts/validate-catalog.test.mjs
git commit -m "feat: validate curated catalog metadata"
```

---

### Task 3: Deterministic Catalog Markdown

**Files:**
- Create: `CATALOG.md`
- Create: `scripts/render-catalog.mjs`
- Create: `scripts/render-catalog.test.mjs`

**Interfaces:**
- Consumes: `readCatalog(path)` and `validateCatalog(entries)` from Task 2.
- Produces: `renderCatalog(entries: object[]): string`.
- Produces: CLI default write mode and `--check` drift mode.

- [ ] **Step 1: Write failing renderer tests**

Create `scripts/render-catalog.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { renderCatalog } from "./render-catalog.mjs";

const entries = [{
  id: "tool-a",
  name: "Tool A",
  package: "tool-a",
  repository: "https://github.com/example/tool-a",
  install: "pi install npm:tool-a",
  categories: ["workflow"],
  summary: "Does useful work.",
  recommendation: "Small and focused.",
  license: "MIT",
  status: "tested",
  testedVersion: "1.0.0",
  testedPiVersion: "0.84.4",
  testedAt: "2026-08-31",
  conflicts: [],
  notes: []
}];

test("renders stable catalog markdown", () => {
  const markdown = renderCatalog(entries);
  assert(markdown.startsWith("# Curated Pi Package Catalog\n"));
  assert(markdown.includes("## Workflow"));
  assert(markdown.includes("[Tool A](https://github.com/example/tool-a)"));
  assert(markdown.includes("`pi install npm:tool-a`"));
  assert(markdown.endsWith("\n"));
});

test("sorts categories and entries", () => {
  const second = { ...entries[0], id: "alpha", name: "Alpha", package: "alpha", install: "pi install npm:alpha", categories: ["coding"] };
  const markdown = renderCatalog([entries[0], second]);
  assert(markdown.indexOf("## Coding") < markdown.indexOf("## Workflow"));
});
```

- [ ] **Step 2: Run tests and verify the intended failure**

Run:

```bash
node --test scripts/render-catalog.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/render-catalog.mjs`.

- [ ] **Step 3: Implement deterministic rendering and drift checking**

Create `scripts/render-catalog.mjs`:

```js
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { readCatalog, validateCatalog } from "./validate-catalog.mjs";

const title = (value) => value.replace(/(^|-)([a-z])/g, (_match, dash, letter) => `${dash ? " " : ""}${letter.toUpperCase()}`);

export function renderCatalog(entries) {
  const categories = new Map();
  for (const entry of entries) {
    for (const category of entry.categories) {
      const items = categories.get(category) ?? [];
      items.push(entry);
      categories.set(category, items);
    }
  }

  const lines = [
    "# Curated Pi Package Catalog",
    "",
    "> Generated from `catalog/plugins.json`. Edit the JSON source, then run `npm run catalog:render`.",
    "",
    "Status: `community` metadata checked · `tested` used by @kedoupi · `reviewed` source and sensitive operations additionally inspected · `deprecated` no longer recommended.",
    ""
  ];

  for (const category of [...categories.keys()].sort()) {
    lines.push(`## ${title(category)}`, "");
    const items = categories.get(category).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of items) {
      lines.push(
        `### [${entry.name}](${entry.repository})`,
        "",
        `${entry.summary} ${entry.recommendation}`,
        "",
        `- Status: \`${entry.status}\``,
        `- Package: \`${entry.package}\``,
        `- Install: \`${entry.install}\``,
        `- License: ${entry.license}`,
        `- Tested: ${entry.testedAt ?? "not tested by @kedoupi"}`,
        ""
      );
    }
  }

  if (entries.length === 0) lines.push("No entries have completed review yet.", "");
  return `${lines.join("\n").trimEnd()}\n`;
}

async function main() {
  const source = new URL("../catalog/plugins.json", import.meta.url);
  const output = new URL("../CATALOG.md", import.meta.url);
  const entries = await readCatalog(source);
  const errors = validateCatalog(entries);
  if (errors.length) throw new Error(errors.join("\n"));
  const rendered = renderCatalog(entries);
  if (process.argv.includes("--check")) {
    const current = await readFile(output, "utf8").catch(() => "");
    if (current !== rendered) {
      console.error("CATALOG.md is stale; run npm run catalog:render");
      process.exitCode = 1;
    }
    return;
  }
  await writeFile(output, rendered);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 4: Generate and verify `CATALOG.md`**

Run:

```bash
npm run catalog:render
node --test scripts/render-catalog.test.mjs
npm run catalog:check
```

Expected: 2 tests PASS; drift check exits 0; empty catalog says `No entries have completed review yet.`

- [ ] **Step 5: Commit Task 3**

```bash
git add CATALOG.md scripts/render-catalog.mjs scripts/render-catalog.test.mjs
git commit -m "feat: render curated package catalog"
```

---

### Task 4: Future First-party Package and Tarball Validation

**Files:**
- Create: `scripts/package-workspaces.mjs`
- Create: `scripts/validate-packages.mjs`
- Create: `scripts/validate-packages.test.mjs`
- Create: `scripts/pack-check.mjs`
- Create: `scripts/pack-check.test.mjs`

**Interfaces:**
- Produces: `discoverPackageDirs(root: string): Promise<string[]>`.
- Produces: `validatePackageDir(dir: string): Promise<string[]>`.
- Produces: `findForbiddenTarballFiles(files: string[], bundledDependencies?: string[]): string[]`.
- Declared bundled dependencies are allowed under `package/node_modules/`; undeclared `node_modules` content is rejected so the future Suite remains compatible with the spec.
- Root Package validation succeeds with zero workspaces and does not create fake packages.

- [ ] **Step 1: Write failing package validation tests**

Create `scripts/validate-packages.test.mjs` using temporary directories:

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverPackageDirs, validatePackageDir } from "./package-workspaces.mjs";

async function fixture(manifest) {
  const root = await mkdtemp(join(tmpdir(), "kedoupi-package-"));
  const dir = join(root, "packages", "pi-demo");
  await mkdir(join(dir, "extensions"), { recursive: true });
  await writeFile(join(dir, "extensions", "index.ts"), "export default function () {}\n");
  await writeFile(join(dir, "README.md"), "# Demo\n");
  await writeFile(join(dir, "CHANGELOG.md"), "# Changelog\n");
  await writeFile(join(dir, "package.json"), JSON.stringify(manifest));
  return { root, dir };
}

const valid = {
  name: "@kedoupi/pi-demo",
  version: "0.1.0",
  license: "MIT",
  keywords: ["pi-package"],
  pi: { extensions: ["./extensions/index.ts"] },
  peerDependencies: { "@earendil-works/pi-coding-agent": "*" }
};

test("discovers package workspaces", async () => {
  const { root, dir } = await fixture(valid);
  assert.deepEqual(await discoverPackageDirs(root), [dir]);
});

test("accepts a conforming package", async () => {
  const { dir } = await fixture(valid);
  assert.deepEqual(await validatePackageDir(dir), []);
});

test("rejects lifecycle scripts and missing files", async () => {
  const { dir } = await fixture({
    ...valid,
    scripts: { install: "node install.js" },
    pi: { extensions: ["./extensions/missing.ts"] }
  });
  const errors = await validatePackageDir(dir);
  assert(errors.some((error) => error.includes("lifecycle script: install")));
  assert(errors.some((error) => error.includes("missing Pi resource")));
});
```

- [ ] **Step 2: Run tests and verify the intended failure**

Run:

```bash
node --test scripts/validate-packages.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/package-workspaces.mjs`.

- [ ] **Step 3: Implement workspace discovery and Package validation**

Create `scripts/package-workspaces.mjs`:

```js
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
      const bundledResource = bundled.some((name) =>
        normalized === `node_modules/${name}` || normalized.startsWith(`node_modules/${name}/`)
      );
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
```

Literal manifest paths are the first-party convention for this phase; this avoids adding a glob dependency. Pi itself still supports globs for third-party Packages.

Create `scripts/validate-packages.mjs`:

```js
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
```

Root with no `packages/` directory must print `Validated 0 first-party packages.` and exit 0.

- [ ] **Step 4: Run Package tests and CLI**

Run:

```bash
node --test scripts/validate-packages.test.mjs
node scripts/validate-packages.mjs
```

Expected: 3 tests PASS; CLI prints `Validated 0 first-party packages.`

- [ ] **Step 5: Write failing tarball policy tests**

Create `scripts/pack-check.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { findForbiddenTarballFiles } from "./pack-check.mjs";

test("accepts normal package files", () => {
  assert.deepEqual(findForbiddenTarballFiles(["package/package.json", "package/extensions/index.ts"]), []);
});

test("allows explicitly bundled dependencies", () => {
  assert.deepEqual(
    findForbiddenTarballFiles(
      ["package/node_modules/@kedoupi/pi-demo/extensions/index.ts"],
      ["@kedoupi/pi-demo"]
    ),
    []
  );
});

test("rejects secrets, undeclared dependencies, and development artifacts", () => {
  const errors = findForbiddenTarballFiles([
    "package/.env",
    "package/node_modules/x/index.js",
    "package/secret.pem",
    "package/test/index.test.ts"
  ]);
  assert.deepEqual(errors, [
    "package/.env",
    "package/node_modules/x/index.js",
    "package/secret.pem",
    "package/test/index.test.ts"
  ]);
});
```

- [ ] **Step 6: Run the tarball tests and verify the intended failure**

Run:

```bash
node --test scripts/pack-check.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/pack-check.mjs`.

- [ ] **Step 7: Implement tarball inspection**

Create `scripts/pack-check.mjs` with:

```js
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
  }
  console.log(`Checked ${dirs.length} package tarballs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
```

- [ ] **Step 8: Run all Task 4 checks**

Run:

```bash
node --test scripts/validate-packages.test.mjs scripts/pack-check.test.mjs
node scripts/validate-packages.mjs
node scripts/pack-check.mjs
```

Expected: 6 tests PASS; both CLIs report zero Package workspaces and exit 0.

- [ ] **Step 9: Commit Task 4**

```bash
git add scripts/package-workspaces.mjs scripts/validate-packages.mjs scripts/validate-packages.test.mjs scripts/pack-check.mjs scripts/pack-check.test.mjs
git commit -m "feat: validate first-party package workspaces"
```

---

### Task 5: Pull-request Governance and CI

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/workflows/ci.yml`
- Modify: `docs/catalog-policy.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: root npm scripts from Task 1 and scripts from Tasks 2–4.
- Produces: CI gate `npm ci → npm run check → npm test → npm run pack:check`.

- [ ] **Step 1: Create the PR template**

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

Describe the user-visible or repository-level change.

## Verification

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run pack:check`

## Catalog submission

Complete this section only when adding or changing a third-party entry.

- [ ] I linked the upstream repository and npm Package.
- [ ] I stated whether I am the author.
- [ ] I checked the license.
- [ ] I described system permissions and sensitive behavior.
- [ ] I listed known conflicts.
- [ ] I did not claim `tested` or `reviewed` without maintainer evidence.
- [ ] I did not copy third-party source code.
```

- [ ] **Step 2: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run check
      - run: npm test
      - run: npm run pack:check
```

Do not add secrets, publishing permissions, scheduled jobs, or a Node matrix.

- [ ] **Step 3: Align human policy with automated gates**

Update `docs/catalog-policy.md` to state that CI checks structure, uniqueness, generated Markdown, URL shape, and installation syntax, while maintainers decide inclusion and status.

Update `docs/testing.md` to show the exact CI sequence and explain why CI does not use model credentials or paid APIs.

- [ ] **Step 4: Run the complete local CI equivalent**

Run:

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
git diff --check
```

Expected: all commands exit 0; catalog and Package counts may still be zero.

- [ ] **Step 5: Commit Task 5**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md .github/workflows/ci.yml docs/catalog-policy.md docs/testing.md
git commit -m "ci: enforce repository quality gates"
```

---

### Task 6: Inventory Installed Pi Packages and Seed the Catalog

**Files:**
- Modify: `catalog/plugins.json`
- Modify: `CATALOG.md`

**Interfaces:**
- Consumes: current `pi list`, public npm metadata, public GitHub repositories, Task 2 catalog schema, and Task 3 renderer.
- Produces: accepted public catalog entries with evidence-backed statuses.
- Produces no committed list of rejected, private, local-path, or credential-bearing packages.

- [ ] **Step 1: Capture installed Package sources to a temporary file**

Run:

```bash
pi list > /tmp/kedoupi-pi-list.txt
```

Read the temporary file and classify every source as npm, Git, or local path. Do not paste private paths or private Package names into repository files, commits, or public reports.

- [ ] **Step 2: Build a public-candidate list**

Keep only candidates whose source is already public or whose public upstream can be proven. For npm candidates, collect metadata without running install scripts:

```bash
mkdir -p /tmp/kedoupi-pi-review
while IFS= read -r pkg; do
  npm view "$pkg" --json > "/tmp/kedoupi-pi-review/$(printf '%s' "$pkg" | tr '/@' '__').npm.json"
done < /tmp/kedoupi-public-npm-packages.txt
```

The worker must create `/tmp/kedoupi-public-npm-packages.txt` from the classified `pi list` output; one npm Package name per line.

- [ ] **Step 3: Inspect provenance, license, and actual tarballs**

For each candidate `$pkg`:

```bash
npm pack "$pkg" --ignore-scripts --pack-destination /tmp/kedoupi-pi-review
npm view "$pkg" name version license repository dist.tarball scripts dependencies peerDependencies --json
```

Inspect tarball paths and Package entrypoints. Reject candidates that have no verifiable public source, no usable license, suspicious lifecycle scripts, unrelated `pi-package` tagging, or behavior inappropriate for recommendation.

When repository or community research is needed, use the `agent-reach` GitHub/search workflow and preserve only public upstream URLs in catalog metadata.

- [ ] **Step 4: Assign statuses conservatively**

Apply these deterministic rules:

```text
community = metadata, public source, license, and Pi relevance checked
tested    = community checks + primary behavior personally exercised on recorded versions
reviewed  = tested checks + entrypoint, runtime dependencies, lifecycle scripts, and sensitive operations read
deprecated = previously listed but upstream or compatibility evidence now advises against use
```

Do not convert “already installed” into `tested` unless the primary behavior and exact installed version were actually exercised. Do not use `reviewed` as a security guarantee.

- [ ] **Step 5: Add accepted entries and generate Markdown**

Add one object per accepted Package to `catalog/plugins.json`, using every field required by Task 2. Sort source objects by `id`. Run:

```bash
npm run catalog:render
npm run check
npm test
```

Expected: catalog validation passes and `CATALOG.md` contains every accepted entry.

- [ ] **Step 6: Commit only public accepted metadata**

Before committing, run:

```bash
git diff -- catalog/plugins.json CATALOG.md
git grep -nE '(/Users/|/home/|API[_-]?KEY|AUTH[_-]?TOKEN|\.env)' -- catalog CATALOG.md && exit 1 || true
```

Expected: diff contains only public metadata; secret/private-path scan finds nothing.

Commit:

```bash
git add catalog/plugins.json CATALOG.md
git commit -m "docs: seed curated Pi package catalog"
```

---

### Task 7: Integrated Verification and Phase-two Handoff

**Files:**
- Modify if evidence requires corrections: `README.md`
- Modify if evidence requires corrections: `docs/*.md`
- Modify if evidence requires corrections: `scripts/*.mjs`
- Do not create: `packages/pi-example/`
- Do not create: `packages/pi-suite/`
- Do not create: `.github/workflows/publish.yml`
- Do not create: `.pi/skills/pi-package-development/`

**Interfaces:**
- Consumes: all prior deliverables.
- Produces: verified foundation commit and a concrete request to select the first real first-party Package for the next plan.

- [ ] **Step 1: Run the full clean-install gate**

Run:

```bash
rm -rf node_modules
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
git diff --check
```

Expected: all commands exit 0; test output reports zero failures; Package validation honestly reports zero until a real first-party Package is selected.

- [ ] **Step 2: Verify repository boundaries**

Run:

```bash
node - <<'NODE'
const fs = require("node:fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (!p.private) throw new Error("root must be private");
if (p.pi) throw new Error("root must not be a Pi Package");
for (const path of [
  "packages/pi-example",
  "packages/pi-suite",
  ".github/workflows/publish.yml",
  ".pi/skills/pi-package-development"
]) {
  if (fs.existsSync(path)) throw new Error(`premature artifact: ${path}`);
}
NODE
```

Expected: exit 0.

- [ ] **Step 3: Review design-spec coverage for this phase**

Confirm with file evidence:

```text
Root workspace and non-installable boundary  → package.json, AGENTS.md
Local development policy                    → .pi/settings.json, docs/development.md
Automated checks                            → scripts/*.mjs, scripts/*.test.mjs
Catalog source and rendering                → catalog/plugins.json, CATALOG.md
Community governance                        → docs/catalog-policy.md, PR template
CI                                           → .github/workflows/ci.yml
Installed Package inventory                 → accepted public entries only
Deferred first Package/Suite/publish/Skill  → absent by explicit design rule
```

Correct any mismatch before continuing and rerun Step 1 after corrections.

- [ ] **Step 4: Obtain a correctness-focused code review**

Request review of the complete foundation diff against the approved spec. The reviewer must report correctness, security, drift, and missing-gate findings, not style preferences. Apply accepted fixes and rerun Step 1.

- [ ] **Step 5: Commit final corrections, if any**

If review produced changes:

```bash
git add README.md AGENTS.md .pi catalog CATALOG.md docs scripts .github package.json package-lock.json LICENSE .gitignore
git commit -m "fix: close plugin hub foundation review gaps"
```

If no corrections were required, do not create an empty commit.

- [ ] **Step 6: Record the next-plan entry decision in the execution report**

The execution report must ask the maintainer to choose one real first-party Pi Package by user-visible purpose and name. The next implementation plan will then cover:

```text
real Package code and TDD
→ project-local Pi loading
→ global dogfood
→ package-development Skill extracted from proven commands
→ tag-driven Trusted Publishing workflow
→ @kedoupi/pi-suite with exact bundled member version
→ npm install, update, rollback, and duplicate-registration checks
```

Do not substitute a fake demonstration Package for this decision.
