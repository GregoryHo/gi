import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerApiAuditCommands } from "./commands.ts";
import { registerApiAuditTools } from "./tools.ts";

export default function apiBehaviorAuditExtension(pi: ExtensionAPI): void {
  registerApiAuditCommands(pi);
  registerApiAuditTools(pi);
}
