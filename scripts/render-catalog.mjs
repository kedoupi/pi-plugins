import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { catalogInstall } from "./catalog-source.mjs";
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

  const sortedCategories = [...categories.keys()].sort();
  if (sortedCategories.length) {
    lines.push("## Contents", "");
    for (const category of sortedCategories) {
      lines.push(`- [${title(category)}](#${category})`);
      for (const entry of [...categories.get(category)].sort((a, b) => a.name.localeCompare(b.name, "en"))) {
        lines.push(`  - [${entry.name}](#${category}--${entry.id})`);
      }
    }
    lines.push("");
  }

  for (const category of sortedCategories) {
    lines.push(`## ${title(category)}`, "");
    const items = [...categories.get(category)].sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of items) {
      lines.push(
        `<a id="${category}--${entry.id}"></a>`,
        `### [${entry.name}](./catalog/details/${entry.id}.md)`,
        "",
        `${entry.summary} ${entry.recommendation}`,
        "",
        `- Status: \`${entry.status}\``,
        `- Source: \`${entry.source}\``,
        `- Install: \`${catalogInstall(entry.source)}\``,
        `- License: ${entry.license}`,
        `- Researched: ${entry.researchedVersion} on ${entry.researchedAt}`,
        `- Tested: ${entry.testedAt ?? "not tested by @kedoupi"}`,
        `- Details: [English](./catalog/details/${entry.id}.md) · [简体中文](./catalog/details/${entry.id}.zh-CN.md) · [Upstream](${entry.repository})`,
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
