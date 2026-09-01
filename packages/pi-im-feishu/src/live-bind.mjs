import { loadLarkSdk } from "./feishu-transport.mjs";

function originFor(domain) {
  return domain === "lark"
    ? "https://open.larksuite.com"
    : "https://open.feishu.cn";
}

export async function verifyFeishuApp({
  appId,
  appSecret,
  domain = "feishu",
  fetchImpl = fetch,
} = {}) {
  const tokenResponse = await fetchImpl(
    `${originFor(domain)}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );
  const tokenBody = await tokenResponse.json();
  if (!tokenBody?.tenant_access_token) {
    throw Object.assign(new Error("飞书应用无法验证。"), {
      code: "verify-failed",
    });
  }
  const botResponse = await fetchImpl(
    `${originFor(domain)}/open-apis/bot/v3/info/`,
    {
      headers: { authorization: `Bearer ${tokenBody.tenant_access_token}` },
    },
  );
  const botBody = await botResponse.json();
  if (botBody?.code && botBody.code !== 0) {
    throw Object.assign(new Error("飞书机器人无法验证。"), {
      code: "verify-failed",
    });
  }
  if (
    typeof botBody?.bot?.open_id !== "string" ||
    !botBody.bot.open_id.trim()
  ) {
    throw Object.assign(new Error("飞书机器人无法验证。"), {
      code: "verify-failed",
    });
  }
  return { ok: true, bot: botBody.bot };
}

export async function registerFeishuApp(options = {}) {
  const lark = await loadLarkSdk();
  if (typeof lark?.registerApp !== "function") {
    throw Object.assign(
      new Error("当前飞书 SDK 不能扫码开通。请改用手动填写。"),
      { code: "qr-unavailable" },
    );
  }
  return lark.registerApp({
    source: "pi-im-feishu",
    onQRCodeReady: options.onQRCodeReady,
    onStatusChange: options.onStatusChange,
  });
}
