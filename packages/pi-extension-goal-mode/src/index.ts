import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { createGoalCommandRuntime, registerGoalCommands } from "./commands.ts";
import { registerGoalLoop } from "./loop.ts";
import { registerGoalPersistenceAndUi } from "./persistence.ts";
import { registerGoalSafety } from "./safety.ts";
import { registerGoalReportTool } from "./tools.ts";

export default function goalMode(pi: ExtensionAPI): void {
  const runtime = createGoalCommandRuntime();
  registerGoalCommands(pi, runtime);
  registerGoalReportTool(pi, runtime);
  registerGoalLoop(pi, runtime);
  registerGoalSafety(pi, runtime);
  registerGoalPersistenceAndUi(pi, runtime);
}
