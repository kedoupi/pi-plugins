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
async function verifyCandidate(
  { appId, appSecret, domain = "feishu", boundVia = "manual" },
  { verifyApp = verifyFeishuApp } = {},
) {
  const errors = validateBinding({ appId, appSecret, domain });
  if (errors.length) {
    throw Object.assign(new Error(errors.join("; ")), {
      code: "invalid-binding",
    });
  }
  const candidate = {
    appId: appId.trim(),
    appSecret: appSecret.trim(),
    domain,
    boundVia,
  };
  const verified = await verifyApp(candidate);
  return { ...candidate, botOpenId: verifiedBotOpenId(verified) };
}

export async function bindManual(store, input, options = {}) {
  return store.bindBot(await verifyCandidate(input, options));
}

/**
 * QR bind: `registerApp` is injectable and must match official SDK semantics
 * (onQRCodeReady, client_id/client_secret, tenant_brand). No live SDK in Task 1.
 */
async function qrCandidate({
  registerApp = registerFeishuApp,
  onQRCodeReady,
  onStatusChange,
  signal,
} = {}) {
  if (typeof registerApp !== "function") {
    throw Object.assign(new Error("当前不能扫码开通。请改用手动填写。"), {
      code: "qr-unavailable",
    });
  }
  const result = await registerApp({
    source: "pi-im-feishu",
    onQRCodeReady,
    onStatusChange,
    signal,
  });
  return {
    appId: result?.client_id,
    appSecret: result?.client_secret,
    domain: domainFromTenantBrand(result?.user_info?.tenant_brand),
    boundVia: "qr",
  };
}

export async function bindQr(store, options = {}) {
  const candidate = await qrCandidate(options);
  return store.bindBot(await verifyCandidate(candidate, options));
}

export function createBind(home, hooks = {}) {
  const store = createStore(home);
  return {
    store,
    qrCandidate: (options) => qrCandidate({ ...hooks, ...options }),
    verify: (input, extra = {}) =>
      verifyCandidate(input, { ...hooks, ...extra }),
    writeVerified: (candidate) => store.bindBot(candidate),
    bindManual: (input, extra = {}) =>
      bindManual(store, input, { ...hooks, ...extra }),
    bindQr: (options) => bindQr(store, { ...hooks, ...options }),
  };
}
