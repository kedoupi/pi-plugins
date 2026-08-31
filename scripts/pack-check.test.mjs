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
