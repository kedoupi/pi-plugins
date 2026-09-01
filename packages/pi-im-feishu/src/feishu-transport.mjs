import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sendOutboundFiles } from "./files.mjs";

export async function loadLarkSdk() {
  try {
    return await import("@larksuiteoapi/node-sdk");
  } catch {
    return null;
  }
}

export function createFeishuTransport({
  lark,
  credentials,
  onMessage,
  onDisconnect,
  logger = console,
  readyTimeoutMs = 15_000,
}) {
  if (!lark) {
    throw Object.assign(new Error("飞书 SDK 未安装，无法上线。"), {
      code: "sdk-missing",
    });
  }
  if (!credentials?.appId || !credentials?.appSecret) {
    throw Object.assign(new Error("缺少飞书凭据。"), {
      code: "not-configured",
    });
  }

  const domain =
    credentials.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu;
  const client = new lark.Client({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
    domain,
  });

  let wsClient;
  let ready = false;

  function disconnected(error) {
    ready = false;
    try {
      Promise.resolve(onDisconnect?.(error)).catch((failure) =>
        logger.error?.(failure),
      );
    } catch (failure) {
      logger.error?.(failure);
    }
  }

  async function sendMessage(inbound, chatId, data) {
    if (inbound?.kind === "topic" && inbound.messageId) {
      await client.im.v1.message.reply({
        path: { message_id: inbound.messageId },
        data: { ...data, reply_in_thread: true },
      });
      return;
    }
    if (!chatId) return;
    await client.im.v1.message.create({
      params: { receive_id_type: "chat_id" },
      data: { receive_id: chatId, ...data },
    });
  }

  async function sendText(inbound, chatId, text) {
    if (typeof text !== "string" || text.trim() === "") return;
    await sendMessage(inbound, chatId, {
      msg_type: "text",
      content: JSON.stringify({ text }),
    });
  }

  async function sendFile(inbound, chatId, file) {
    const path = file.path ?? file;
    const image = file.kind === "image";
    const buffer = await readFile(path);
    let key;
    if (image) {
      const uploaded = await client.im.v1.image.create({
        data: { image: buffer },
      });
      key = uploaded?.data?.image_key ?? uploaded?.image_key;
    } else {
      const uploaded = await client.im.v1.file.create({
        data: {
          file_type: "stream",
          file_name: basename(path),
          file: buffer,
        },
      });
      key = uploaded?.data?.file_key ?? uploaded?.file_key;
    }
    if (!key)
      throw new Error(
        `Feishu ${image ? "image" : "file"} upload returned no key`,
      );
    await sendMessage(inbound, chatId, {
      msg_type: image ? "image" : "file",
      content: JSON.stringify(image ? { image_key: key } : { file_key: key }),
    });
  }

  async function download(file) {
    const type = file.kind === "image" ? "image" : "file";
    const response = await client.im.v1.messageResource.get({
      path: { message_id: file.messageId, file_key: file.key },
      params: { type },
    });
    if (Buffer.isBuffer(response) || response instanceof Uint8Array)
      return response;
    if (response?.data) return response.data;
    throw Object.assign(new Error("飞书文件下载失败。"), {
      code: "download-failed",
    });
  }

  return {
    client,
    isReady() {
      return ready;
    },
    async start() {
      if (wsClient) return;
      const dispatcher = new lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (event) => {
          try {
            await onMessage?.(event);
          } catch (error) {
            logger.error?.("[pi-im-feishu] inbound failed", error);
          }
          return {};
        },
        "card.action.trigger": async () => ({}),
      });
      let settleReady;
      let settleError;
      const handshake = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            Object.assign(new Error("飞书长连接超时。"), {
              code: "ws-not-ready",
            }),
          );
        }, readyTimeoutMs);
        settleReady = () => {
          clearTimeout(timer);
          resolve();
        };
        settleError = (error) => {
          clearTimeout(timer);
          reject(error);
        };
      });
      wsClient = new lark.WSClient({
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        domain,
        loggerLevel: lark.LoggerLevel?.error,
        onReady: () => {
          ready = true;
          settleReady?.();
        },
        onError: (error) => {
          const failure = error ?? new Error("飞书长连接失败");
          disconnected(failure);
          settleError?.(failure);
        },
        onClose: () => disconnected(),
        onReconnecting: () => disconnected(),
        onReconnected: () => {
          ready = true;
        },
      });
      await wsClient.start({ eventDispatcher: dispatcher });
      await handshake;
    },
    async stop() {
      ready = false;
      await wsClient?.stop?.();
      wsClient = undefined;
    },
    async send({ inbound, chatId = inbound?.chatId, text, files } = {}) {
      if (text) await sendText(inbound, chatId, text);
      if (files?.length) {
        await sendOutboundFiles(files, {
          sendFile: (file) => sendFile(inbound, chatId, file),
        });
      }
    },
    download,
  };
}
