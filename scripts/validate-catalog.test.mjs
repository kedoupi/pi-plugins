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
