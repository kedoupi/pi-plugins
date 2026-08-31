import assert from "node:assert/strict";
import test from "node:test";
import { validateCatalog } from "./validate-catalog.mjs";

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
