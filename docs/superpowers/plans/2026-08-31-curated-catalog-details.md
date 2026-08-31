# Curated Catalog Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support npm and Git Catalog sources, add all 8 currently used public Pi Packages, and give every entry validated English and Simplified Chinese detail pages.

**Architecture:** `catalog/plugins.json` remains the objective metadata source, while hand-written bilingual pages under `catalog/details/` own narrative guidance. The validator derives installation commands from canonical Pi `source` values, checks detail-page structure and metadata consistency offline, and the renderer keeps `CATALOG.md` as a compact generated index.

**Tech Stack:** Node.js 22+, npm workspaces, Node built-in `node:test`, JSON, Markdown, GitHub Actions; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-31-curated-catalog-details-design.md`

## Global Constraints

- Cover exactly these 8 public entries: `ax-feishu-bridge`, `pi-lsp`, `pi-memory`, `pi-powerline-footer`, `pi-subagents`, `pi-web-access`, `ponytail`, and `superpowers`.
- Prefer official npm sources; use `git:github.com/obra/superpowers` because npm `superpowers@0.0.2` is unrelated.
- Replace legacy `package` and `install` metadata with one canonical, unpinned `source` field.
- Keep all 8 entries at `community`; `researchedVersion` and `researchedAt` never count as test evidence.
- Create one English and one Simplified Chinese detail page per entry, using identical required English H2 headings.
- Do not copy third-party source or large README passages; paraphrase public facts and link upstream evidence.
- Never commit user-local paths, private Package inventory, credentials, Cookie values, API keys, or scraped README copies.
- CI and all validators remain offline, deterministic, and Node-standard-library-only.
- Do not add a crawler, website, database, Markdown parser, stale-by-date CI failure, or runtime dependency.
- Keep one writer per cwd/worktree. Parallel agents are read-only researchers and return bounded evidence artifacts.
- Every code behavior change follows TDD: failing test, observed expected failure, minimal implementation, green test, then commit.

## File and Interface Map

| File | Responsibility |
|---|---|
| `scripts/catalog-source.mjs` | Validate canonical npm/Git Pi sources and derive `pi install` commands. |
| `scripts/validate-catalog.mjs` | Validate JSON metadata and bilingual detail-page pairs. |
| `scripts/validate-catalog.test.mjs` | Unit and filesystem-fixture tests for metadata and details. |
| `scripts/validate-readmes.mjs` | Expose the existing Markdown H2 parser for Catalog detail validation. |
| `scripts/validate-readmes.test.mjs` | Protect existing README behavior after parser extraction. |
| `scripts/render-catalog.mjs` | Generate compact Catalog entries and detail/upstream links. |
| `scripts/render-catalog.test.mjs` | Pin npm/Git commands, sorting, and detail links. |
| `catalog/plugins.json` | Objective metadata for all 8 entries. |
| `catalog/details/*.md` | Eight English researched detail pages. |
| `catalog/details/*.zh-CN.md` | Eight Simplified Chinese researched detail pages. |
| `CATALOG.md` | Generated index; never hand-edit. |
| `docs/catalog-policy.md` | Contributor-facing schema, evidence, and review policy. |
| `docs/testing.md` | Offline Catalog/detail validation gate. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Required Catalog metadata/detail checklist. |
| `README.md`, `README.zh-CN.md` | Advertise bilingual researched detail pages. |

## Execution Topology

1. Run Tasks 1 and 2 sequentially; both change shared validator files.
2. After Task 2, launch 8 parallel **read-only** research lanes, one per Catalog ID. Each lane returns a bounded report with: official source, version, license evidence, capabilities, quick start, commands/tools, configuration, permissions/security, compatibility, limitations, and exact upstream URLs. Save reports under ignored `.superpowers/catalog-details/research/` or managed output artifacts; do not commit them.
3. Use one content writer at a time for Tasks 3 and 4. Task 3 consumes four reports; Task 4 consumes the other four.
4. Run Task 5 only after all 16 pages exist.
5. Give every mutation task a fresh spec-compliance review and a fresh quality/factual review. Critical or Important findings return to the task implementer before proceeding.
6. Task 6 performs whole-branch review and clean-install verification.

---

### Task 1: Migrate Catalog Sources and Add the 8 Entries

**Files:**
- Create: `scripts/catalog-source.mjs`
- Modify: `scripts/validate-catalog.mjs`
- Modify: `scripts/validate-catalog.test.mjs`
- Modify: `scripts/render-catalog.mjs`
- Modify: `scripts/render-catalog.test.mjs`
- Modify: `catalog/plugins.json`
- Regenerate: `CATALOG.md`

**Interfaces:**
- Produces: `catalogInstall(source: unknown): string | null` from `scripts/catalog-source.mjs`.
- Produces: Catalog entries with `source`, `researchedVersion`, and `researchedAt`; no `package` or `install` fields.
- Preserves: `readCatalog(path)` and `validateCatalog(entries)` exports.
- Consumed later by: detail validation and rendering in Tasks 2 and 5.

- [ ] **Step 1: Replace the Catalog test fixture with the new exact schema**

Use this fixture in `scripts/validate-catalog.test.mjs`:

```js
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
```

Add focused tests:

```js
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
```

Update duplicate assertions from `duplicate package` to `duplicate source`.

- [ ] **Step 2: Write source helper tests through renderer behavior**

Change `scripts/render-catalog.test.mjs` entries to use `source`. Pin both source types:

```js
assert(markdown.includes("Source: `npm:tool-a`"));
assert(markdown.includes("Install: `pi install npm:tool-a`"));

const gitEntry = {
  ...entries[0],
  id: "git-tool",
  name: "Git Tool",
  source: "git:github.com/example/git-tool",
  repository: "https://github.com/example/git-tool"
};
assert(renderCatalog([gitEntry]).includes("`pi install git:github.com/example/git-tool`"));
```

Also assert the generated entry displays `researchedVersion` and `researchedAt`.

- [ ] **Step 3: Run tests and observe the expected red state**

Run:

```bash
node --test scripts/validate-catalog.test.mjs scripts/render-catalog.test.mjs
```

Expected: failures because `validateCatalog` still requires `package`/`install`, accepts no `source`, and the renderer prints old fields.

- [ ] **Step 4: Implement canonical source parsing**

Create `scripts/catalog-source.mjs`:

```js
const npmSource = /^npm:(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const gitSource = /^git:github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function catalogInstall(source) {
  if (typeof source !== "string") return null;
  if (npmSource.test(source)) return `pi install ${source}`;
  if (gitSource.test(source) && !source.endsWith(".git")) return `pi install ${source}`;
  return null;
}
```

Do not add version parsing, Git refs, raw URLs, or alternate hosts.

- [ ] **Step 5: Implement the new metadata validator**

In `scripts/validate-catalog.mjs`:

- Import `catalogInstall`.
- Replace `package` and `install` in `requiredStrings` with `source`, `researchedVersion`, and `researchedAt`.
- Reject own-properties named `package` or `install` with `legacy field: <name>`.
- Validate `catalogInstall(entry.source)` is non-null.
- Validate `researchedAt` with `^\d{4}-\d{2}-\d{2}$`.
- Track a `sources` set and report `duplicate source: <source>`.
- For Git sources, derive `https://${entry.source.slice("git:".length)}` and require exact equality with `repository`.
- Preserve existing `community`/`tested`/`reviewed`/`deprecated` and test-evidence rules.

- [ ] **Step 6: Update renderer metadata without detail links yet**

In `renderCatalog`, replace Package/Install lines with:

```js
`- Source: \`${entry.source}\``,
`- Install: \`${catalogInstall(entry.source)}\``,
`- License: ${entry.license}`,
`- Researched: ${entry.researchedVersion} on ${entry.researchedAt}`,
`- Tested: ${entry.testedAt ?? "not tested by @kedoupi"}`,
```

Keep title links pointed at upstream until Task 5, when all detail files exist.

- [ ] **Step 7: Migrate metadata to the exact 8-entry inventory**

For all entries, remove `package` and `install`, add `source`, `researchedVersion`, and `researchedAt: "2026-08-31"`.

| ID | Source | Researched version | Category |
|---|---|---:|---|
| `ax-feishu-bridge` | `npm:ax-feishu-bridge` | `0.4.9` | `communication` |
| `pi-lsp` | `npm:@narumitw/pi-lsp` | `0.49.6` | `developer-tools` |
| `pi-memory` | `npm:pi-memory` | `0.4.2` | `memory` |
| `pi-powerline-footer` | `npm:pi-powerline-footer` | `0.16.0` | `user-interface` |
| `pi-subagents` | `npm:pi-subagents` | `0.61.0` | `automation` |
| `pi-web-access` | `npm:pi-web-access` | `0.27.0` | `research` |
| `ponytail` | `npm:@dietrichgebert/ponytail` | `4.9.0` | `developer-tools` |
| `superpowers` | `git:github.com/obra/superpowers` | `6.3.0` | `workflow` |

Add these exact new-entry narratives:

```json
{
  "id": "pi-memory",
  "name": "Pi Memory",
  "source": "npm:pi-memory",
  "repository": "https://github.com/jayzeng/pi-memory",
  "categories": ["memory"],
  "summary": "Adds persistent long-term memory, daily logs, a scratchpad, and optional semantic search to Pi.",
  "recommendation": "Use it when decisions and context must survive sessions and local Markdown storage fits your workflow.",
  "license": "MIT",
  "status": "community",
  "researchedVersion": "0.4.2",
  "researchedAt": "2026-08-31",
  "testedVersion": null,
  "testedPiVersion": null,
  "testedAt": null,
  "conflicts": [],
  "notes": ["Semantic and deep search optionally invoke qmd and local embedding workflows."]
}
```

```json
{
  "id": "ponytail",
  "name": "Ponytail",
  "source": "npm:@dietrichgebert/ponytail",
  "repository": "https://github.com/DietrichGebert/ponytail",
  "categories": ["developer-tools"],
  "summary": "Adds an always-on minimalism discipline and focused skills for reducing over-engineering.",
  "recommendation": "Use it when you want coding agents to prefer YAGNI, standard-library solutions, and deletion over speculative abstractions.",
  "license": "MIT",
  "status": "community",
  "researchedVersion": "4.9.0",
  "researchedAt": "2026-08-31",
  "testedVersion": null,
  "testedPiVersion": null,
  "testedAt": null,
  "conflicts": [],
  "notes": ["Changes coding-agent behavior through an extension and skills rather than changing project runtime code."]
}
```

```json
{
  "id": "superpowers",
  "name": "Superpowers",
  "source": "git:github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
  "categories": ["workflow"],
  "summary": "Adds a structured software-development methodology built from composable agent skills.",
  "recommendation": "Use it when you want explicit brainstorming, TDD, debugging, planning, review, and worktree workflows.",
  "license": "MIT",
  "status": "community",
  "researchedVersion": "6.3.0",
  "researchedAt": "2026-08-31",
  "testedVersion": null,
  "testedPiVersion": null,
  "testedAt": null,
  "conflicts": [],
  "notes": ["Its behavioral skills add approval gates and process requirements to coding tasks."]
}
```

Preserve the existing five summaries, recommendations, conflicts, and notes unless public evidence collected later proves them inaccurate. Keep all statuses `community` and all test-evidence fields `null`.

- [ ] **Step 8: Regenerate and verify the Catalog**

Run:

```bash
npm run catalog:render
node --test scripts/validate-catalog.test.mjs scripts/render-catalog.test.mjs
npm run check
npm test
npm run pack:check
git diff --check
```

Expected: all commands exit 0; validator reports 8 entries; no detail links are emitted yet.

- [ ] **Step 9: Commit Task 1**

```bash
git add scripts/catalog-source.mjs scripts/validate-catalog.mjs scripts/validate-catalog.test.mjs scripts/render-catalog.mjs scripts/render-catalog.test.mjs catalog/plugins.json CATALOG.md
git commit -m "feat: support npm and git catalog sources"
```

---

### Task 2: Validate Bilingual Catalog Detail Pages

**Files:**
- Modify: `scripts/validate-readmes.mjs`
- Modify: `scripts/validate-readmes.test.mjs`
- Modify: `scripts/validate-catalog.mjs`
- Modify: `scripts/validate-catalog.test.mjs`

**Interfaces:**
- Produces: `README_SECTIONS(markdown: string): Array<{ name: string, body: string[] }>` exported from `scripts/validate-readmes.mjs` under the name `readReadmeSections`.
- Produces: `CATALOG_DETAIL_SECTIONS: string[]`.
- Produces: `validateCatalogDetails(entries: object[], detailsDir: string): Promise<string[]>`.
- Does not yet call detail validation from the CLI; Task 5 wires it after all 16 pages exist.

- [ ] **Step 1: Pin the required detail headings in tests**

In `scripts/validate-catalog.test.mjs`, import `CATALOG_DETAIL_SECTIONS` and assert exact equality:

```js
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
```

- [ ] **Step 2: Add a real filesystem fixture helper**

Add imports from `node:fs/promises`, `node:os`, and `node:path`. Create a fixture with concrete English and Chinese files:

```js
const detailMarkdown = (entry, language) => `# ${entry.name}

[English](./${entry.id}.md) | [简体中文](./${entry.id}.zh-CN.md)

> Research basis: ${entry.researchedVersion}, checked ${entry.researchedAt}.
> Documentation review only; not a security guarantee.

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
```

Use `mkdtemp`, `mkdir`, and `writeFile` to create `catalog/details/example.md` and `example.zh-CN.md` for the `valid` entry.

- [ ] **Step 3: Add failure tests for every required boundary**

Add separate tests that assert:

```js
assert.deepEqual(await validateCatalogDetails([valid], detailsDir), []);
```

Then mutate one condition per test and assert errors for:

- missing `example.zh-CN.md`;
- orphan `orphan.md`;
- missing `## Permissions and Security`;
- duplicate or empty `## Installation`;
- absent reciprocal language link;
- absent English disclaimer `Documentation review only; not a security guarantee.` or Chinese disclaimer `仅审阅公开文档；不构成安全保证。`;
- wrong `pi install npm:wrong-package`;
- wrong researched version or date;
- wrong repository URL or license in `Upstream and License`.

Each assertion must match a stable phrase and include the affected file path.

- [ ] **Step 4: Run the focused test and observe red**

Run:

```bash
node --test scripts/validate-catalog.test.mjs
```

Expected: module export failures because `CATALOG_DETAIL_SECTIONS` and `validateCatalogDetails` do not exist.

- [ ] **Step 5: Extract the existing README section parser**

In `scripts/validate-readmes.mjs`, move the current line parser into:

```js
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
```

Make `validateReadme` call `readReadmeSections`. Do not change the existing root/Package README contract.

- [ ] **Step 6: Implement async detail validation**

In `scripts/validate-catalog.mjs`:

- Import `readFile` and `readdir` from `node:fs/promises`, `join` from `node:path`, `catalogInstall`, and `readReadmeSections`/`validateReadme`.
- Export the exact `CATALOG_DETAIL_SECTIONS` array from Step 1.
- Export `validateCatalogDetails(entries, detailsDir)`.
- Build the exact expected filename set: `${id}.md` and `${id}.zh-CN.md`.
- Report every missing expected file.
- Report every `.md` file in `detailsDir` not in the expected set as orphaned.
- Run `validateReadme` for both languages.
- Require both link tokens in both files: `[English](./${id}.md)` and `[简体中文](./${id}.zh-CN.md)`.
- Require the English page to contain `Documentation review only; not a security guarantee.` and the Chinese page to contain `仅审阅公开文档；不构成安全保证。`.
- Require global text to include `researchedVersion` and `researchedAt`.
- Read the `Installation` section body with `readReadmeSections` and require `catalogInstall(entry.source)`.
- Read `Upstream and License` and require both `entry.repository` and `entry.license`.
- Aggregate all errors; do not stop at the first bad file.

Handle a missing `detailsDir` as an empty directory so every expected file receives an actionable missing-file error.

- [ ] **Step 7: Run focused and regression tests**

Run:

```bash
node --test scripts/validate-catalog.test.mjs scripts/validate-readmes.test.mjs
npm test
```

Expected: all tests pass; production CLI still validates metadata only until Task 5.

- [ ] **Step 8: Commit Task 2**

```bash
git add scripts/validate-readmes.mjs scripts/validate-readmes.test.mjs scripts/validate-catalog.mjs scripts/validate-catalog.test.mjs
git commit -m "feat: validate bilingual catalog details"
```

---

### Research Fanout: Collect 8 Read-Only Evidence Reports

This is an orchestration phase, not a tracked repository mutation. Run it after Task 2 and before Task 3.

**Inputs:**
- `catalog/plugins.json`
- Official GitHub repository and npm source for each ID
- Detail-page standard from the approved spec

**Output contract per lane:**

```text
ID and researched version
Official install source
License evidence and caveats
About and best-for summary
Capabilities with upstream section URLs
Quick-start steps
Commands/tools/shortcuts
Configuration files and defaults
File/network/credential/Cookie/subprocess/model/cost behavior
Compatibility and peer ranges
Limitations and conflicts
Exact GitHub/npm/README/Release URLs
Uncertain claims explicitly marked unknown
```

Launch exactly these independent lanes:

1. `ax-feishu-bridge` — GitHub `AX1202/ax-feishu-bridge`, npm `ax-feishu-bridge`.
2. `pi-lsp` — GitHub `narumiruna/pi-extensions`, npm `@narumitw/pi-lsp`, inspect the `packages/pi-lsp` subtree.
3. `pi-memory` — GitHub `jayzeng/pi-memory`, npm `pi-memory`.
4. `pi-powerline-footer` — GitHub `nicobailon/pi-powerline-footer`, npm `pi-powerline-footer`.
5. `pi-subagents` — GitHub `nicobailon/pi-subagents`, npm `pi-subagents`.
6. `pi-web-access` — GitHub `nicobailon/pi-web-access`, npm `pi-web-access`.
7. `ponytail` — GitHub `DietrichGebert/ponytail`, npm `@dietrichgebert/ponytail`.
8. `superpowers` — GitHub `obra/superpowers`; verify Pi installs from Git and explicitly reject npm `superpowers` as evidence.

Researchers must use public upstream content only, never inspect or report user configuration. Run lanes in parallel; writers consume the reports sequentially.

---

### Task 3: Write High-Impact and Data-Handling Detail Pages

**Files:**
- Create: `catalog/details/ax-feishu-bridge.md`
- Create: `catalog/details/ax-feishu-bridge.zh-CN.md`
- Create: `catalog/details/pi-memory.md`
- Create: `catalog/details/pi-memory.zh-CN.md`
- Create: `catalog/details/pi-powerline-footer.md`
- Create: `catalog/details/pi-powerline-footer.zh-CN.md`
- Create: `catalog/details/pi-web-access.md`
- Create: `catalog/details/pi-web-access.zh-CN.md`

**Interfaces:**
- Consumes: Task 2 detail validator and four read-only research reports.
- Produces: 8 Markdown files matching metadata exactly.
- Does not modify: `catalog/plugins.json`, renderer, or validator code.

- [ ] **Step 1: Read metadata and evidence before writing**

For each of the four IDs, read its exact JSON entry, its research report, official README, manifest/npm metadata, license evidence, and latest release. Resolve contradictions in favor of current official source and record uncertainty in `Limitations` rather than guessing.

- [ ] **Step 2: Write the Powerline pair with these mandatory facts**

Both pages must cover:

- automatic activation and `/powerline` preset/placement usage;
- model/thinking/path/Git/context/token/cost segments;
- editor stash, queued prompts, welcome overlay, working vibes, bash mode, and custom status items;
- queue/stash files written under the Pi agent directory;
- persistent managed shell and local command execution in bash mode;
- model cost/latency for generated vibes and optional FX network lookup;
- npm version `0.16.0` and upstream peer range `>=0.81.0 <0.85.0` without calling it locally tested;
- known duplicate `/reply` conflict with standalone `pi-quote-reply` from upstream docs;
- npm-declared MIT license, noting upstream links rather than claiming GitHub license detection.

Use the exact installation command:

```bash
pi install npm:pi-powerline-footer
```

- [ ] **Step 3: Write the Web Access pair with these mandatory facts**

Both pages must cover:

- `web_search`, `fetch_content`, `source_check`, and `get_search_content`;
- search-provider routing, GitHub cloning, PDFs, URLs, YouTube/local video, frames, and curator workflow;
- shortest zero-config start and optional provider configuration in `~/.pi/web-search.json` as an upstream example path, not a user path disclosure;
- API keys, provider query/URL disclosure, optional browser Cookie access, model/API costs, local clone/cache behavior, ffmpeg/yt-dlp subprocesses, credential command sources, SSRF controls, and remote curator exposure;
- browser Cookie access disabled by default and remote hosted fetch providers opt-in;
- npm version `0.27.0`, Pi requirement stated upstream, and MIT license;
- limitations for restricted videos, OCR, provider limits, and remote curator security.

Use the exact installation command:

```bash
pi install npm:pi-web-access
```

- [ ] **Step 4: Write the Memory pair with these mandatory facts**

Both pages must cover:

- long-term `MEMORY.md`, daily logs, scratchpad, read/write/forget/restore, and search/status tools;
- plain Markdown storage under the Pi agent directory;
- optional qmd keyword/semantic/deep search, collection creation, local embeddings, and first-use model download;
- filesystem writes, deletion recovery records, qmd subprocess/index behavior, and the privacy difference between plain local files and optional embedding workflows;
- npm version `0.4.2` and MIT license;
- core tools working without qmd and semantic/deep search requiring qmd.

Use:

```bash
pi install npm:pi-memory
```

- [ ] **Step 5: Write the Feishu Bridge pair with these mandatory facts**

Both pages must cover only claims supported by `AX1202/ax-feishu-bridge` public sources, including:

- bridging Pi conversations through Feishu/Lark bots;
- required bot/app setup and first-run flow;
- user-facing commands or configuration documented upstream;
- message content leaving the local Pi process for Feishu/Lark;
- bot credentials, network access, attachment/media behavior, persistent state, subprocesses, and any exposed server/listener behavior found in source;
- npm version `0.4.9` and npm-declared license evidence;
- unsupported or unclear permissions explicitly listed as unknown rather than inferred.

Use:

```bash
pi install npm:ax-feishu-bridge
```

- [ ] **Step 6: Validate only this batch**

Run a one-off module check using the existing metadata subset:

```bash
node --input-type=module <<'NODE'
import { resolve } from "node:path";
import { readCatalog, validateCatalogDetails } from "./scripts/validate-catalog.mjs";
const ids = new Set(["ax-feishu-bridge", "pi-memory", "pi-powerline-footer", "pi-web-access"]);
const entries = (await readCatalog("catalog/plugins.json")).filter((entry) => ids.has(entry.id));
const errors = await validateCatalogDetails(entries, resolve("catalog/details"));
if (errors.length) throw new Error(errors.join("\n"));
console.log("Validated Task 3 detail pages.");
NODE

git diff --check
```

Expected: `Validated Task 3 detail pages.` and exit 0.

- [ ] **Step 7: Commit Task 3**

```bash
git add catalog/details/ax-feishu-bridge.md catalog/details/ax-feishu-bridge.zh-CN.md catalog/details/pi-memory.md catalog/details/pi-memory.zh-CN.md catalog/details/pi-powerline-footer.md catalog/details/pi-powerline-footer.zh-CN.md catalog/details/pi-web-access.md catalog/details/pi-web-access.zh-CN.md
git commit -m "docs: detail high-impact Pi packages"
```

---

### Task 4: Write Development and Workflow Detail Pages

**Files:**
- Create: `catalog/details/pi-lsp.md`
- Create: `catalog/details/pi-lsp.zh-CN.md`
- Create: `catalog/details/pi-subagents.md`
- Create: `catalog/details/pi-subagents.zh-CN.md`
- Create: `catalog/details/ponytail.md`
- Create: `catalog/details/ponytail.zh-CN.md`
- Create: `catalog/details/superpowers.md`
- Create: `catalog/details/superpowers.zh-CN.md`

**Interfaces:**
- Consumes: Task 2 detail validator and four read-only research reports.
- Produces: the remaining 8 Markdown files so the full 8-entry set validates.
- Does not modify: shared JSON, renderer, or validator code.

- [ ] **Step 1: Read metadata and evidence before writing**

For each ID, use its exact JSON entry and research report. For monorepo Pi LSP, use the `packages/pi-lsp` source and npm metadata rather than treating every package in `narumiruna/pi-extensions` as Pi LSP behavior.

- [ ] **Step 2: Write the Pi LSP pair**

Both pages must cover:

- language-agnostic LSP diagnostics and source/code-action fixes actually exposed by the Package;
- server configuration, extension-to-server routing, and supported file patterns documented upstream;
- installation plus the shortest server configuration/use example;
- language-server subprocess execution, workspace/file reads, source-fix writes, and trust implications;
- failure behavior when a configured server command is unavailable;
- npm version `0.49.6`, monorepo location, MIT license, and upstream compatibility evidence.

Use:

```bash
pi install npm:@narumitw/pi-lsp
```

- [ ] **Step 3: Write the Pi Subagents pair**

Both pages must cover:

- single-agent delegation, parallel/scripted workflows, async runs, context modes, managed worktrees, reviews, steering, and status/observability supported upstream;
- minimal first use and major commands/tools;
- additional model usage/cost, child tool authority, background processes, worktree/file mutations, host command gates, and artifact/session storage;
- safe boundaries: children do not automatically inherit orchestration authority and writers require isolation;
- npm version `0.61.0`, MIT license, and declared Pi compatibility.

Use:

```bash
pi install npm:pi-subagents
```

- [ ] **Step 4: Write the Ponytail pair**

Both pages must cover:

- always-on minimalism/YAGNI behavior, the solution ladder, root-cause fixes, and its focused review/audit/debt/help skills;
- Pi activation through its extension and skills, plus the shortest enable/disable or intensity usage documented upstream;
- behavioral prompt influence rather than project runtime functionality;
- interaction with agent decisions, hooks/extension loading, and the need not to simplify away validation, security, accessibility, or data-loss handling;
- npm version `4.9.0`, official npm source, MIT license, and multi-harness scope.

Use:

```bash
pi install npm:@dietrichgebert/ponytail
```

- [ ] **Step 5: Write the Superpowers pair**

Both pages must cover:

- brainstorming, writing plans, TDD, systematic debugging, worktrees, subagent-driven development, review, verification, and branch-finishing skills;
- Pi Git installation and automatic skill/runtime bootstrap documented upstream;
- approval gates, extra process steps, possible subagent/model usage, worktree and repository mutations, and behavioral prompt influence;
- npm `superpowers@0.0.2` is unrelated and must not appear as an installation option;
- upstream release `6.3.0` and MIT license.

Use:

```bash
pi install git:github.com/obra/superpowers
```

- [ ] **Step 6: Validate all 16 pages**

Run:

```bash
node --input-type=module <<'NODE'
import { resolve } from "node:path";
import { readCatalog, validateCatalog, validateCatalogDetails } from "./scripts/validate-catalog.mjs";
const entries = await readCatalog("catalog/plugins.json");
const errors = [...validateCatalog(entries), ...await validateCatalogDetails(entries, resolve("catalog/details"))];
if (errors.length) throw new Error(errors.join("\n"));
console.log(`Validated ${entries.length} bilingual Catalog entries.`);
NODE

git diff --check
```

Expected: `Validated 8 bilingual Catalog entries.` and exit 0.

- [ ] **Step 7: Commit Task 4**

```bash
git add catalog/details/pi-lsp.md catalog/details/pi-lsp.zh-CN.md catalog/details/pi-subagents.md catalog/details/pi-subagents.zh-CN.md catalog/details/ponytail.md catalog/details/ponytail.zh-CN.md catalog/details/superpowers.md catalog/details/superpowers.zh-CN.md
git commit -m "docs: detail development Pi packages"
```

---

### Task 5: Wire Detail Validation, Links, and Contributor Policy

**Files:**
- Modify: `scripts/validate-catalog.mjs`
- Modify: `scripts/validate-catalog.test.mjs`
- Modify: `scripts/render-catalog.mjs`
- Modify: `scripts/render-catalog.test.mjs`
- Modify: `docs/catalog-policy.md`
- Modify: `docs/testing.md`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Regenerate: `CATALOG.md`

**Interfaces:**
- Consumes: 8 validated JSON entries and all 16 detail pages.
- Produces: CLI validation of metadata plus details and generated detail/upstream links.
- Preserves: `npm run check`, `npm test`, and `npm run pack:check` as the complete public gate.

- [ ] **Step 1: Add renderer link tests first**

In `scripts/render-catalog.test.mjs`, assert one entry renders:

```js
assert(markdown.includes("### [Tool A](./catalog/details/tool-a.md)"));
assert(markdown.includes("[English](./catalog/details/tool-a.md)"));
assert(markdown.includes("[简体中文](./catalog/details/tool-a.zh-CN.md)"));
assert(markdown.includes("[Upstream](https://github.com/example/tool-a)"));
```

Keep existing source/install/researched assertions.

- [ ] **Step 2: Add a CLI integration assertion**

In `scripts/validate-catalog.test.mjs`, add a test around a repository fixture or exported main-level helper showing metadata passes but a missing detail pair fails. The assertion must include `missing detail file` and the expected English path.

- [ ] **Step 3: Run focused tests and observe red**

Run:

```bash
node --test scripts/validate-catalog.test.mjs scripts/render-catalog.test.mjs
```

Expected: renderer link assertions fail; CLI/helper assertion fails because production validation does not call `validateCatalogDetails`.

- [ ] **Step 4: Wire detail validation into the production CLI**

In `scripts/validate-catalog.mjs`, have the CLI load `catalog/plugins.json`, validate metadata, then await:

```js
validateCatalogDetails(entries, new URL("../catalog/details/", import.meta.url))
```

Accept both filesystem path strings and file URLs in `validateCatalogDetails`, normalizing through Node path/URL utilities. Print `Validated 8 catalog entries and bilingual details.` on success.

Do not perform network requests.

- [ ] **Step 5: Render compact detail links**

Change each item header and links to:

```js
`### [${entry.name}](./catalog/details/${entry.id}.md)`,
// existing summary and metadata
`- Details: [English](./catalog/details/${entry.id}.md) · [简体中文](./catalog/details/${entry.id}.zh-CN.md) · [Upstream](${entry.repository})`,
```

Keep deterministic category and name sorting.

- [ ] **Step 6: Update Catalog policy with the exact new contract**

Replace the old `package`/`install` JSON example in `docs/catalog-policy.md` with the spec's `source`, `researchedVersion`, and `researchedAt` model. Add:

- npm-preferred/Git-fallback source rule;
- distinction between researched and tested evidence;
- required English/Chinese detail page paths;
- the 11 required headings;
- manual research checklist;
- no automatic crawl or stale-date CI;
- community contributors cannot self-award tested/reviewed.

Update the temporary review examples so npm uses `pi install npm:some-package`; Git reviews use `pi install git:github.com/owner/repo`.

- [ ] **Step 7: Update tests, PR checklist, and root READMEs**

In `docs/testing.md`, state that `npm run check` validates source syntax, metadata, bilingual pairs, orphan files, headings, reciprocal links, installation commands, research metadata, and generated Catalog freshness without network access.

Add these Catalog checkboxes to `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
- [ ] I used the official npm source, or documented why Git is required.
- [ ] I added matching English and Simplified Chinese detail pages.
- [ ] I recorded the researched version/date without claiming it was tested.
- [ ] I documented files, network access, credentials, subprocesses, and paid services.
- [ ] I linked current upstream documentation and license evidence.
```

In both root READMEs, update the Curated Catalog section to say every entry links bilingual, manually researched usage and security details. Do not claim every Package has been executed or security-reviewed.

- [ ] **Step 8: Regenerate and run the full gate**

Run:

```bash
npm run catalog:render
npm run check
npm test
npm run pack:check
git diff --check
```

Expected: validator reports 8 entries with bilingual details; all tests pass; `CATALOG.md` has English/Chinese/upstream links for every entry.

- [ ] **Step 9: Commit Task 5**

```bash
git add scripts/validate-catalog.mjs scripts/validate-catalog.test.mjs scripts/render-catalog.mjs scripts/render-catalog.test.mjs docs/catalog-policy.md docs/testing.md .github/PULL_REQUEST_TEMPLATE.md README.md README.zh-CN.md CATALOG.md
git commit -m "feat: link curated catalog details"
```

---

### Task 6: Integrated Verification and Review Closure

**Files:**
- Modify only when evidence requires corrections: `catalog/plugins.json`
- Modify only when evidence requires corrections: `catalog/details/*.md`
- Modify only when evidence requires corrections: `scripts/*.mjs`
- Modify only when evidence requires corrections: `docs/*.md`, `README*.md`, `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Consumes: all prior tasks and research reports.
- Produces: merge-ready branch, final review evidence, and no extra architecture.

- [ ] **Step 1: Run a clean-install gate**

```bash
rm -rf node_modules
npm ci --ignore-scripts
npm run check
npm test
npm run pack:check
git diff --check
```

Expected: every command exits 0; 8 metadata entries and 16 detail pages validate; tarball check still honestly reports 0 first-party Package tarballs.

- [ ] **Step 2: Verify inventory and file boundaries**

Run:

```bash
node --input-type=module <<'NODE'
import { readdir, readFile } from "node:fs/promises";
const entries = JSON.parse(await readFile("catalog/plugins.json", "utf8"));
const ids = entries.map((entry) => entry.id).sort();
const expected = [
  "ax-feishu-bridge", "pi-lsp", "pi-memory", "pi-powerline-footer",
  "pi-subagents", "pi-web-access", "ponytail", "superpowers"
];
if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error(`wrong ids: ${ids}`);
if (entries.some((entry) => entry.status !== "community")) throw new Error("catalog status was overclaimed");
if (entries.some((entry) => "package" in entry || "install" in entry)) throw new Error("legacy fields remain");
const files = (await readdir("catalog/details")).filter((file) => file.endsWith(".md")).sort();
if (files.length !== 16) throw new Error(`expected 16 detail pages, got ${files.length}`);
console.log("inventory boundary check passed");
NODE
```

Expected: `inventory boundary check passed`.

- [ ] **Step 3: Perform factual reviews**

Use independent read-only reviewers. Split review ownership so each plugin receives one factual pass. For every page pair verify:

- install source and researched version;
- capabilities and quick start against upstream;
- license wording and caveats;
- compatibility phrased as upstream evidence, not local testing;
- sensitive file/network/credential/Cookie/subprocess/model/cost behavior;
- English and Chinese meaning remain aligned;
- no unsupported claims, copied long passages, private paths, or secrets.

Critical or Important findings must be fixed. Minor prose preferences may remain only when they do not change factual clarity.

- [ ] **Step 4: Perform whole-branch code and spec review**

Review the complete diff against `docs/superpowers/specs/2026-08-31-curated-catalog-details-design.md`. Check source parsing, legacy rejection, Git/repository matching, orphan detection, Markdown section parsing, deterministic rendering, error aggregation, tests, YAGNI, and offline CI.

- [ ] **Step 5: Apply accepted fixes and rerun the full gate**

When reviews produce changes:

```bash
npm run catalog:render
npm run check
npm test
npm run pack:check
git diff --check
git add catalog CATALOG.md scripts docs README.md README.zh-CN.md .github/PULL_REQUEST_TEMPLATE.md
git commit -m "fix: close catalog detail review gaps"
```

If reviews produce no tracked changes, do not create an empty commit.

- [ ] **Step 6: Confirm clean final state**

```bash
git status --short
git log --oneline --decorate -8
```

Expected: empty status output and a reviewable sequence of focused commits.
