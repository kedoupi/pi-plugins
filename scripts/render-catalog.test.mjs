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
