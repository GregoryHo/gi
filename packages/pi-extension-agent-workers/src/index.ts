import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerAgentWorkerCommands } from "./commands.ts";
import { AgentWorkerService } from "./service.ts";
import { registerAgentWorkerTools } from "./tools.ts";
import { registerAgentWorkerWidget } from "./widget.ts";

export { getDefaultAgentWorkerConfigDir, readWorkspaceConfig, updateWorkspaceConfig } from "./config.ts";
export type { WorkspaceAgentWorkerConfig } from "./config.ts";
export { getBuiltInWorkerProfiles, getWorkerProfiles, resolveWorkerProfile, validateCustomWorkerProfiles } from "./profiles.ts";
export type { ResolvedWorkerRequest, WorkerMode, WorkerProfile, WorkerRequest, WorkerResult } from "./request-types.ts";
export { AgentWorkerService, workerResultFromRun } from "./service.ts";
export { registerAgentWorkerTools, workerRunSummary } from "./tools.ts";
export { registerAgentWorkerWidget, renderWorkerWidget } from "./widget.ts";

export default function agentWorkersExtension(pi: ExtensionAPI): void {
  const service = new AgentWorkerService();
  registerAgentWorkerCommands(pi, service);
  registerAgentWorkerTools(pi, service);
  registerAgentWorkerWidget(pi, service);
}
