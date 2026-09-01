import createFeishuExtension from "../src/tui.mjs";

export default function (pi) {
  if (process.env.PI_IM_FEISHU_ASSISTANT === "1") return;
  return createFeishuExtension(pi);
}
