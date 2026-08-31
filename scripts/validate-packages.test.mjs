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
