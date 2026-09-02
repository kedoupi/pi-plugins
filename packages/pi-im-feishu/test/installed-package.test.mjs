import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = join(import.meta.dirname, "..");
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

async function packageRoot(specifier) {
  let current = dirname(fileURLToPath(import.meta.resolve(specifier)));
  while (true) {
    const manifestPath = join(current, "package.json");
    if (await exists(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest.name === specifier) return current;
    }
    const parent = dirname(current);
    if (parent === current) throw new Error(`Cannot locate ${specifier}`);
    current = parent;
  }
}

function checked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

async function extractTarball(tarball, installed, linkedPackages) {
  await rm(installed, { recursive: true, force: true });
  await mkdir(installed, { recursive: true });
  checked("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"]);
  const modules = dirname(dirname(installed));
  for (const [name, target] of Object.entries(linkedPackages)) {
    const link = join(modules, ...name.split("/"));
    await mkdir(dirname(link), { recursive: true });
    await rm(link, { recursive: true, force: true });
    await symlink(target, link, "dir");
  }
}

async function textFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await textFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

test("installed tarball works offline and preserves machine state", async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), "pi-im-feishu-installed-"));
  const modules = join(fixture, "node_modules");
  const installed = join(modules, "@kedoupi", "pi-im-feishu");
  const stateHome = join(fixture, "machine-state");
  const linkedPackages = {
    "@earendil-works/pi-coding-agent": await packageRoot(
      "@earendil-works/pi-coding-agent",
    ),
    "qrcode-terminal": await packageRoot("qrcode-terminal"),
  };
  const packed = checked(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", fixture],
    { cwd: packageDir },
  );
  const report = JSON.parse(packed.stdout)[0];
  const tarball = join(fixture, report.filename);
  const paths = report.files.map(({ path }) => path).sort();

  await t.test("contains only runtime and manifest files", async () => {
    for (const required of [
      "package.json",
      "README.md",
      "CHANGELOG.md",
      "bin/assistant.mjs",
      "extensions/index.ts",
      "src/pi-session.mjs",
    ]) {
      assert(paths.includes(required), `${required} missing from tarball`);
    }
    assert.equal(
      paths.some(
        (path) =>
          path.startsWith("test/") ||
          path.includes(".pi/") ||
          path.includes(".env") ||
          path.endsWith("tsconfig.json") ||
          path.includes("task-8"),
      ),
      false,
      paths.join("\n"),
    );
  });

  await extractTarball(tarball, installed, linkedPackages);

  await t.test("resolves the real local Pi peer", () => {
    const result = checked(process.execPath, [
      "--input-type=module",
      "-e",
      `const mod = await import(${JSON.stringify(
        pathToFileURL(join(installed, "src/pi-session.mjs")).href,
      )}); const sdk = await mod.loadPiSdk(); console.log(typeof sdk.createAgentSession);`,
    ]);
    assert.equal(result.stdout.trim(), "function");
  });

  await t.test(
    "loads with no UI and print or JSON commands do nothing",
    async () => {
      const previousHome = process.env.PI_IM_FEISHU_HOME;
      process.env.PI_IM_FEISHU_HOME = stateHome;
      try {
        const { loadPiSdk } = await import(
          pathToFileURL(join(installed, "src/pi-session.mjs")).href
        );
        const sdk = await loadPiSdk();
        const loaded = await sdk.discoverAndLoadExtensions(
          [join(installed, "extensions/index.ts")],
          fixture,
          join(fixture, "agent"),
        );
        assert.deepEqual(loaded.errors, []);
        assert.equal(loaded.extensions.length, 1);
        const extension = loaded.extensions[0];
        assert.equal(extension.handlers.has("session_start"), true);
        const commandDefinition = extension.commands.get("feishu");
        assert.equal(typeof commandDefinition.handler, "function");
        const notifications = [];
        for (const mode of ["print", "json"]) {
          for (const command of [
            "setup",
            "start",
            "stop",
            "folder p2p:fixture /tmp/project",
            "attach p2p:fixture",
          ]) {
            await commandDefinition.handler(command, {
              hasUI: false,
              mode,
              ui: { notify: (message) => notifications.push(message) },
            });
          }
        }
        assert.equal(notifications.length, 10);
        assert.equal(await exists(stateHome), false);
      } finally {
        if (previousHome === undefined) delete process.env.PI_IM_FEISHU_HOME;
        else process.env.PI_IM_FEISHU_HOME = previousHome;
      }
    },
  );

  await t.test("starts and stops using installed runtime modules", async () => {
    const [{ createAssistantControl }, { createAutostart }] = await Promise.all(
      [
        import(
          pathToFileURL(join(installed, "src/assistant-control.mjs")).href
        ),
        import(pathToFileURL(join(installed, "src/autostart.mjs")).href),
      ],
    );
    const control = createAssistantControl(stateHome, {
      autostart: createAutostart(),
      runner: async ({ lock }) => {
        await lock.acquire({ appId: "cli_fixtureabcdefghijkl" });
        await lock.heartbeat("online");
        return { shutdown: () => lock.release() };
      },
    });
    await control.store.bindBot({
      appId: "cli_fixtureabcdefghijkl",
      appSecret: "fixture-secret-not-real",
      botOpenId: "ou_fixture",
    });
    assert.equal((await control.start()).status, "online");
    assert.equal((await control.stop()).status, "offline");
  });

  await t.test(
    "update, uninstall, and rollback leave machine state intact",
    async () => {
      const configBefore = await readFile(
        join(stateHome, "config.json"),
        "utf8",
      );

      await rm(installed, { recursive: true, force: true });
      await mkdir(installed, { recursive: true });
      await mkdir(join(installed, "simulated-update"));
      assert.equal(
        await readFile(join(stateHome, "config.json"), "utf8"),
        configBefore,
      );

      await extractTarball(tarball, installed, linkedPackages);
      const { createStore } = await import(
        `${pathToFileURL(join(installed, "src/store.mjs")).href}?rollback=1`
      );
      assert.equal((await createStore(stateHome).status()).configured, true);

      await rm(installed, { recursive: true, force: true });
      assert.equal(
        await readFile(join(stateHome, "config.json"), "utf8"),
        configBefore,
      );
      assert.equal((await lstat(stateHome)).isDirectory(), true);
    },
  );

  await t.test(
    "contains no private checkout path or fixture credential",
    async () => {
      await extractTarball(tarball, installed, linkedPackages);
      for (const file of await textFiles(installed)) {
        const text = await readFile(file, "utf8").catch(() => "");
        assert.equal(text.includes(packageDir), false, file);
        assert.equal(text.includes("fixture-secret-not-real"), false, file);
      }
    },
  );
});
