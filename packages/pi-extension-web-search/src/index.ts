import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerWebSearchTool } from "./tools.ts";

export default function webSearch(pi: ExtensionAPI): void {
  registerWebSearchTool(pi);
}
