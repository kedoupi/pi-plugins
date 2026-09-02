import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import createFeishuExtension from "../src/tui.mjs";

export default function (pi: ExtensionAPI) {
  if (process.env.PI_IM_FEISHU_ASSISTANT === "1") return;
  return createFeishuExtension(pi);
}
