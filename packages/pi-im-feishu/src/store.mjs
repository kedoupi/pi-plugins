import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { atomicWriteJson } from "./atomic-json.mjs";
import { withFileLock } from "./file-lock.mjs";
import { pidIsAlive } from "./lock.mjs";
import {
  configPath,
  defaultHome,
  secretsPath,
  storeLockPath,
} from "./paths.mjs";

export const DOMAINS = new Set(["feishu", "lark"]);

const DELIVERY_LIMIT = 1_000;
const DELIVERY_CLAIM_TTL_MS = 5 * 60_000;

const emptyConfig = () => ({
  version: 1,
  bot: null,
  chats: {},
  stopped: false,
});

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(path, value, mode = 0o600) {
  await atomicWriteJson(path, value, { mode });
}

export function publicBot(bot) {
  if (!bot) return null;
  const appId = bot.appId;
  const appIdMasked =
    appId.length > 12
      ? `${appId.slice(0, 8)}••••${appId.slice(-4)}`
      : "cli_••••";
  return {
    domain: bot.domain,
    appIdMasked,
    boundVia: bot.boundVia ?? null,
    bindingId: bot.bindingId ?? null,
    botOpenId: bot.botOpenId ?? null,
  };
}

export function validateBinding({ appId, appSecret, domain }) {
  const errors = [];
  if (!nonEmpty(appId) || !appId.trim().startsWith("cli_"))
    errors.push("appId must start with cli_");
  if (!nonEmpty(appSecret) || appSecret.trim().length < 8)
    errors.push("appSecret is too short");
  if (domain !== undefined && !DOMAINS.has(domain))
    errors.push("domain must be feishu or lark");
  return errors;
}

export function validateFolder(folder) {
  if (!nonEmpty(folder) || !isAbsolute(folder))
    return "folder must be an absolute path";
  return null;
}

export function chatKey({ kind, chatId, threadId }) {
  if (!nonEmpty(kind) || !nonEmpty(chatId))
    throw new Error("chat key needs kind and chatId");
  if (kind === "topic") {
    if (!nonEmpty(threadId)) throw new Error("topic chats need a threadId");
    return `topic:${chatId}:${threadId}`;
  }
  if (kind !== "p2p" && kind !== "group")
    throw new Error(`unknown chat kind: ${kind}`);
  return `${kind}:${chatId}`;
}

export function parseChatKey(key) {
  if (typeof key !== "string") return null;
  if (key.startsWith("topic:")) {
    const rest = key.slice("topic:".length);
    const split = rest.indexOf(":");
    if (split <= 0 || split === rest.length - 1) return null;
    return {
      kind: "topic",
      chatId: rest.slice(0, split),
      threadId: rest.slice(split + 1),
    };
  }
  const split = key.indexOf(":");
  if (split <= 0) return null;
  const kind = key.slice(0, split);
  const chatId = key.slice(split + 1);
  if ((kind !== "p2p" && kind !== "group") || !chatId) return null;
  return { kind, chatId };
}

export function titleForChat(key, fallback) {
  if (nonEmpty(fallback)) return fallback.trim();
  const parsed = parseChatKey(key);
  if (!parsed) return key;
  if (parsed.kind === "p2p") return "私聊";
  if (parsed.kind === "topic") return "话题";
  return "群";
}

export function createStore(home = defaultHome(), hooks = {}) {
  const configFile = configPath(home);
  const secretFile = secretsPath(home);
  const mutationLock = storeLockPath(home);
  const deliveryLimit = hooks.deliveryLimit ?? DELIVERY_LIMIT;

  async function loadConfig() {
    const raw = await readJson(configFile, emptyConfig());
    return {
      version: 1,
      bot: raw.bot && typeof raw.bot === "object" ? raw.bot : null,
      chats: raw.chats && typeof raw.chats === "object" ? raw.chats : {},
      stopped: raw.stopped === true,
    };
  }

  async function saveConfig(config) {
    await writeJson(configFile, {
      version: 1,
      bot: config.bot,
      chats: config.chats,
      stopped: config.stopped === true,
    });
  }

  async function mutateConfig(fn) {
    return withFileLock(mutationLock, async () => {
      const config = await loadConfig();
      const result = await fn(config);
      await saveConfig(config);
      return result;
    });
  }

  const store = {
    home,
    configFile,
    secretFile,

    async status() {
      const config = await loadConfig();
      const chats = Object.entries(config.chats)
        .map(([key, chat]) => ({
          key,
          kind: parseChatKey(key)?.kind ?? "unknown",
          title: titleForChat(key, chat.title),
          folder: chat.folder ?? null,
          sessionFile: chat.sessionFile ?? null,
          archives: Array.isArray(chat.archives) ? chat.archives : [],
          ownership: chat.ownership ?? null,
          updatedAt: chat.updatedAt ?? null,
        }))
        .sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
      return {
        configured: Boolean(config.bot),
        bot: publicBot(config.bot),
        chats,
        stopped: config.stopped === true,
      };
    },

    async bindBot({
      appId,
      appSecret,
      domain = "feishu",
      boundVia = "manual",
      botOpenId,
    }) {
      const errors = validateBinding({ appId, appSecret, domain });
      if (errors.length) {
        throw Object.assign(new Error(errors.join("; ")), {
          code: "invalid-binding",
        });
      }
      return withFileLock(mutationLock, async () => {
        const config = await loadConfig();
        const bindingId = randomUUID();
        const bot = {
          appId: appId.trim(),
          domain,
          boundVia,
          bindingId,
          ...(nonEmpty(botOpenId) ? { botOpenId: botOpenId.trim() } : {}),
        };
        await writeJson(
          secretFile,
          { appSecret: appSecret.trim(), bindingId },
          0o600,
        );
        await hooks.afterSecretWrite?.();
        config.bot = bot;
        config.stopped = false;
        await saveConfig(config);
        return publicBot(bot);
      });
    },

    async loadSecrets() {
      const secrets = await readJson(secretFile, null);
      const value = secrets?.appSecret;
      return nonEmpty(value) ? value : null;
    },

    async loadCredentials() {
      const config = await loadConfig();
      if (!config.bot || !nonEmpty(config.bot.bindingId)) return null;
      const secrets = await readJson(secretFile, null);
      if (
        !nonEmpty(secrets?.appSecret) ||
        secrets.bindingId !== config.bot.bindingId
      )
        return null;
      return { ...config.bot, appSecret: secrets.appSecret };
    },

    async setStopped(stopped) {
      return mutateConfig((config) => {
        config.stopped = stopped === true;
        return config.stopped;
      });
    },

    async getChat(key) {
      const config = await loadConfig();
      return config.chats[key] ?? null;
    },

    async updateChat(key, updater) {
      if (!parseChatKey(key)) {
        throw Object.assign(new Error(`invalid chat key: ${key}`), {
          code: "invalid-chat",
        });
      }
      return mutateConfig(async (config) => {
        const replacement = await updater(config.chats[key] ?? null);
        if (
          !replacement ||
          typeof replacement !== "object" ||
          Array.isArray(replacement)
        ) {
          throw Object.assign(
            new Error("chat updater must return a chat record"),
            { code: "invalid-chat" },
          );
        }
        config.chats[key] = replacement;
        return replacement;
      });
    },

    async requestOwnership(key, request) {
      return this.updateOwnership(key, request);
    },

    async readOwnership(key) {
      return (await this.getChat(key))?.ownership ?? null;
    },

    async updateOwnership(key, updater) {
      return this.updateChat(key, async (current) => {
        if (!current) {
          throw Object.assign(new Error(`unknown chat: ${key}`), {
            code: "unknown-chat",
          });
        }
        const replacement =
          typeof updater === "function"
            ? await updater(current.ownership ?? null, current)
            : updater;
        if (replacement === null || replacement === undefined) {
          delete current.ownership;
          return current;
        }
        if (typeof replacement !== "object" || Array.isArray(replacement)) {
          throw Object.assign(
            new Error("ownership updater must return a lease record"),
            { code: "invalid-ownership" },
          );
        }
        current.ownership = replacement;
        return current;
      }).then((chat) => chat.ownership ?? null);
    },

    async findChatBySession(sessionFile) {
      if (!nonEmpty(sessionFile)) return null;
      const config = await loadConfig();
      for (const [key, chat] of Object.entries(config.chats)) {
        if (chat?.sessionFile !== sessionFile) continue;
        const { ownership: _ownership, ...record } = chat;
        return { key, ...record };
      }
      return null;
    },

    async upsertChat(key, patch) {
      if (patch.folder !== undefined) {
        const folderError = validateFolder(patch.folder);
        if (folderError)
          throw Object.assign(new Error(folderError), {
            code: "invalid-folder",
          });
      }
      return this.updateChat(key, (current) => ({
        ...(current ?? {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      }));
    },

    async claimDelivery(key, messageId) {
      if (!nonEmpty(messageId)) {
        throw Object.assign(new Error("delivery needs a message id"), {
          code: "invalid-delivery",
        });
      }
      let claimed = false;
      const now = Date.now();
      await this.updateChat(key, (current) => {
        const deliveries = { ...(current?.deliveries ?? {}) };
        const existing = deliveries[messageId];
        const updatedAt = Date.parse(existing?.updatedAt);
        const activeClaim = Number.isInteger(existing?.ownerPid)
          ? pidIsAlive(existing.ownerPid)
          : Number.isFinite(updatedAt) &&
            now - updatedAt <= DELIVERY_CLAIM_TTL_MS;
        if (
          existing?.state === "complete" ||
          (existing?.state === "in-progress" && activeClaim)
        ) {
          return { ...(current ?? {}), deliveries };
        }
        deliveries[messageId] = {
          state: "in-progress",
          ownerPid: process.pid,
          updatedAt: new Date(now).toISOString(),
        };
        claimed = true;
        return { ...(current ?? {}), deliveries };
      });
      return claimed;
    },

    async completeDelivery(key, messageId) {
      let completed = false;
      await this.updateChat(key, (current) => {
        const deliveries = { ...(current?.deliveries ?? {}) };
        if (deliveries[messageId]?.state !== "in-progress") {
          return { ...(current ?? {}), deliveries };
        }
        deliveries[messageId] = {
          state: "complete",
          updatedAt: new Date().toISOString(),
        };
        const completedIds = Object.entries(deliveries)
          .filter(([, delivery]) => delivery?.state === "complete")
          .sort(([, a], [, b]) =>
            String(a.updatedAt).localeCompare(String(b.updatedAt)),
          )
          .map(([id]) => id);
        for (const id of completedIds.slice(0, -deliveryLimit))
          delete deliveries[id];
        completed = true;
        return { ...(current ?? {}), deliveries };
      });
      return completed;
    },

    async releaseDelivery(key, messageId) {
      let released = false;
      await this.updateChat(key, (current) => {
        const deliveries = { ...(current?.deliveries ?? {}) };
        if (deliveries[messageId]?.state === "in-progress") {
          delete deliveries[messageId];
          released = true;
        }
        return { ...(current ?? {}), deliveries };
      });
      return released;
    },

    async bindFolder(key, folder) {
      return this.upsertChat(key, { folder });
    },
  };

  return store;
}
