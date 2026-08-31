import assert from "node:assert/strict";
import test from "node:test";
import { renderCatalog } from "./render-catalog.mjs";

const entries = [{
  id: "tool-a",
  name: "Tool A",
  source: "npm:tool-a",
  repository: "https://github.com/example/tool-a",
  categories: ["workflow"],
  summary: "Does useful work.",
  recommendation: "Small and focused.",
  license: "MIT",
  status: "tested",
  researchedVersion: "1.0.0",
  researchedAt: "2026-08-31",
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
  assert(markdown.includes("Source: `npm:tool-a`"));
  assert(markdown.includes("Install: `pi install npm:tool-a`"));
  assert(markdown.includes("Researched: 1.0.0 on 2026-08-31"));

  const gitEntry = {
    ...entries[0],
    id: "git-tool",
    name: "Git Tool",
    source: "git:github.com/example/git-tool",
    repository: "https://github.com/example/git-tool"
  };
  assert(renderCatalog([gitEntry]).includes("`pi install git:github.com/example/git-tool`"));
  assert(markdown.endsWith("\n"));
});

test("sorts categories and entries", () => {
  const second = { ...entries[0], id: "alpha", name: "Alpha", source: "npm:alpha", categories: ["coding"] };
  const markdown = renderCatalog([entries[0], second]);
  assert(markdown.indexOf("## Coding") < markdown.indexOf("## Workflow"));
});
