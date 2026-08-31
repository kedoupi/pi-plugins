import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = [
  new URL("../docs/development.md", import.meta.url),
  new URL("../docs/publishing.md", import.meta.url)
];
const forbidden = ["pi-example", "pi-suite"];

test("foundation docs do not reference placeholder packages or suite names", async () => {
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const value of forbidden) {
      assert.equal(
        text.includes(value),
        false,
        `${file.pathname} still references ${value}`
      );
    }
  }
});
