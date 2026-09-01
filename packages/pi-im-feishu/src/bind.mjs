import { registerFeishuApp, verifyFeishuApp } from "./live-bind.mjs";
import { createStore, validateBinding } from "./store.mjs";

export function domainFromTenantBrand(brand) {
  return brand === "lark" ? "lark" : "feishu";
}

function verifiedBotOpenId(verified) {
  const openId = verified?.bot?.open_id;
  if (typeof openId !== "string" || !openId.trim()) {
    throw Object.assign(new Error("飞书机器人无法验证。"), {
      code: "verify-failed",
    });
  }
  return openId.trim();
}

/**
 * Manual bind: verify then write the same machine-level store QR uses.
 * `verifyApp` is injectable. The real Feishu HTTP check lands in Task 2.
 */
export async function bindManual(
  store,
  { appId, appSecret, domain = "feishu" },
  { verifyApp = verifyFeishuApp } = {},
) {
  const errors = validateBinding({ appId, appSecret, domain });
  if (errors.length) {
    throw Object.assign(new Error(errors.join("; ")), {
      code: "invalid-binding",
    });
  }
  const verified = await verifyApp({
    appId: appId.trim(),
    appSecret: appSecret.trim(),
    domain,
  });
  return store.bindBot({
    appId,
    appSecret,
    domain,
    boundVia: "manual",
    botOpenId: verifiedBotOpenId(verified),
  });
}

/**
 * QR bind: `registerApp` is injectable and must match official SDK semantics
 * (onQRCodeReady, client_id/client_secret, tenant_brand). No live SDK in Task 1.
 */
export async function bindQr(
  store,
  {
    registerApp = registerFeishuApp,
    verifyApp = verifyFeishuApp,
    onQRCodeReady,
    onStatusChange,
  } = {},
) {
  if (typeof registerApp !== "function") {
    throw Object.assign(new Error("当前不能扫码开通。请改用手动填写。"), {
      code: "qr-unavailable",
    });
  }
  const result = await registerApp({
    source: "pi-im-feishu",
    onQRCodeReady,
    onStatusChange,
  });
  const appId = result?.client_id;
  const appSecret = result?.client_secret;
  const domain = domainFromTenantBrand(result?.user_info?.tenant_brand);
  const errors = validateBinding({ appId, appSecret, domain });
  if (errors.length) {
    throw Object.assign(new Error(errors.join("; ")), {
      code: "invalid-binding",
    });
  }
  const verified = await verifyApp({
    appId: appId.trim(),
    appSecret: appSecret.trim(),
    domain,
  });
  return store.bindBot({
    appId,
    appSecret,
    domain,
    boundVia: "qr",
    botOpenId: verifiedBotOpenId(verified),
  });
}

export function createBind(home, hooks = {}) {
  const store = createStore(home);
  return {
    store,
    bindManual: (input, extra = {}) =>
      bindManual(store, input, { ...hooks, ...extra }),
    bindQr: (options) => bindQr(store, { ...hooks, ...options }),
  };
}
