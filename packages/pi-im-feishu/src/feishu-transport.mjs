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
  logger = console,
  readyTimeoutMs = 15_000
}) {
  if (!lark) {
    throw Object.assign(new Error("飞书 SDK 未安装，无法上线。"), { code: "sdk-missing" });
  }
  if (!credentials?.appId || !credentials?.appSecret) {
    throw Object.assign(new Error("缺少飞书凭据。"), { code: "not-configured" });
  }

  const domain = credentials.domain === "lark" ? lark.Domain.Lark : lark.Domain.Feishu;
  const client = new lark.Client({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
    domain
  });

  let wsClient;
  let ready = false;

  async function sendText(chatId, text) {
    if (!chatId || typeof text !== "string" || text.trim() === "") return;
    await client.im.v1.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text })
      }
    });
  }

  async function sendFile(chatId, file) {
    const path = file.path ?? file;
    const type = file.kind === "image" ? "image" : "file";
    const buffer = await readFile(path);
    const uploaded = await client.im.v1.file.create({
      data: {
        file_type: type === "image" ? "image" : "stream",
        file_name: basename(path),
        file: buffer
      }
    });
    const key = uploaded?.data?.file_key ?? uploaded?.file_key;
    if (!key) throw new Error("Feishu file upload returned no key");
    await client.im.v1.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        msg_type: type,
        content: JSON.stringify(type === "image" ? { image_key: key } : { file_key: key })
      }
    });
  }

  async function download(file) {
    const type = file.kind === "image" ? "image" : "file";
    const response = await client.im.v1.messageResource.get({
      path: { message_id: file.messageId, file_key: file.key },
      params: { type }
    });
    if (Buffer.isBuffer(response) || response instanceof Uint8Array) return response;
    if (response?.data) return response.data;
    throw Object.assign(new Error("飞书文件下载失败。"), { code: "download-failed" });
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
        "card.action.trigger": async () => ({})
      });
      let settleReady;
      let settleError;
      const handshake = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(Object.assign(new Error("飞书长连接超时。"), { code: "ws-not-ready" }));
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
          ready = false;
          settleError?.(error ?? new Error("飞书长连接失败"));
        }
      });
      await wsClient.start({ eventDispatcher: dispatcher });
      await handshake;
    },
    async stop() {
      ready = false;
      await wsClient?.stop?.();
      wsClient = undefined;
    },
    async send({ chatId, text, files } = {}) {
      if (text) await sendText(chatId, text);
      if (files?.length) {
        await sendOutboundFiles(files, {
          sendFile: (file) => sendFile(chatId, file)
        });
      }
    },
    download
  };
}
