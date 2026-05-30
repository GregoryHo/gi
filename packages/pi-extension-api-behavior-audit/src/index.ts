import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerApiAuditCommands } from "./commands/index.ts";
import { registerApiAuditTools } from "./tools/index.ts";

export default function apiBehaviorAuditExtension(pi: ExtensionAPI): void {
  registerApiAuditCommands(pi);
  registerApiAuditTools(pi);
}
