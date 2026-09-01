import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createPiRunPrompt,
  interceptToolCalls,
  loadPiSdk,
} from "../src/pi-session.mjs";

const packageJson = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
const tools = ["read", "grep", "find", "ls", "edit", "write", "bash"];

function fakePi() {
  const pi = {
    loaderOptions: null,
    sessionOptions: null,
    sessions: [],
  };
  pi.getAgentDir = () => "/agent";
  pi.DefaultResourceLoader = class {
    constructor(options) {
      pi.loaderOptions = options;
    }

    async reload() {}
  };
  pi.SessionManager = class {
    static create(folder) {
      return { sessionFile: null, folder };
    }

    static open(sessionFile) {
      return { sessionFile };
    }
  };
  pi.createAgentSession = async (options) => {
    pi.sessionOptions = options;
    const sequence = pi.sessions.length + 1;
    const session = {
      sessionFile: options.sessionManager.sessionFile ?? `/workspace/session-${sequence}.jsonl`,
      messages: [],
      tools: [],
      disposed: false,
      async prompt(text) {
        this.messages.push({ role: "assistant", content: `reply:${text}` });
      },
      dispose() {
        this.disposed = true;
      },
    };
    pi.sessions.push(session);
    return { session };
  };
  return pi;
}

const message = {
  folder: "/workspace",
  sessionFile: null,
  text: "hello",
  inbound: { key: "p2p:a" },
  confirm: async () => true,
};

test("does not treat the Pi SDK peer as optional", async () => {
  const pkg = JSON.parse(await readFile(packageJson, "utf8"));
  assert.equal(pkg.peerDependencies["@earendil-works/pi-coding-agent"], "*");
  assert.equal(pkg.peerDependenciesMeta?.["@earendil-works/pi-coding-agent"], undefined);
  const sdk = await loadPiSdk();
  assert.equal(typeof sdk.createAgentSession, "function");
});

test("disables ambient extensions and allowlists coding tools", async () => {
  const pi = fakePi();
  const run = createPiRunPrompt(pi);
  await run(message);
  assert.equal(pi.loaderOptions.cwd, "/workspace");
  assert.equal(pi.loaderOptions.agentDir, "/agent");
  assert.equal(pi.loaderOptions.noExtensions, true);
  assert.equal(pi.loaderOptions.noPromptTemplates, true);
  assert.equal(pi.loaderOptions.noThemes, true);
  assert.deepEqual(pi.sessionOptions.tools, tools);
});

test("rejects an unavailable session factory instead of reducing capability", () => {
  assert.throws(
    () => createPiRunPrompt({}),
    (error) => error.code === "pi-sdk-missing",
  );
});

test("uses exact session-file matching and releases cached sessions", async () => {
  const pi = fakePi();
  const run = createPiRunPrompt(pi);
  await run({ ...message, sessionFile: "/workspace/one.jsonl" });
  await run({ ...message, sessionFile: "/workspace/one.jsonl", text: "again" });
  assert.equal(pi.sessions.length, 1);
  await run({ ...message, sessionFile: null, text: "fresh" });
  assert.equal(pi.sessions.length, 2);
  assert.equal(pi.sessions[0].disposed, true);
  await run.release("p2p:a");
  assert.equal(pi.sessions[1].disposed, true);
  run.dispose();
});

test("interceptToolCalls classifies real input and skips blocked or denied calls", async () => {
  const calls = [];
  const bash = {
    name: "bash",
    execute: async () => {
      calls.push("bash");
      return { ok: true };
    },
  };
  const read = {
    name: "read",
    execute: async () => {
      calls.push("read");
      return { ok: true };
    },
  };
  const restore = interceptToolCalls(
    { tools: [bash, read] },
    async () => false,
    { key: "p2p:a" },
    { folder: "/workspace" },
  );
  const denied = await bash.execute("id", { command: "rm -rf build" });
  assert.deepEqual(calls, []);
  assert.match(denied.content[0].text, /未确认/);
  const blocked = await read.execute("id", { path: "../secret" });
  assert.deepEqual(calls, []);
  assert.match(blocked.content[0].text, /超出工作区/);
  restore();
  await bash.execute("id", { command: "rm -rf build" });
  assert.deepEqual(calls, ["bash"]);
});
