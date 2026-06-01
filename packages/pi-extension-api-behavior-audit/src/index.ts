import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerApiAuditCommands } from "./commands/index.ts";
import { registerApiAuditTools, stopAllActiveApiAuditCaptures } from "./tools/index.ts";

export default function apiBehaviorAuditExtension(pi: ExtensionAPI): void {
  registerApiAuditCommands(pi);
  registerApiAuditTools(pi);
  pi.on("session_shutdown", async () => {
    await stopAllActiveApiAuditCaptures();
  });
}
