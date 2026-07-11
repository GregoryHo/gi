import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerAgentWorkerCommands } from "./commands/index.ts";
import { AgentWorkerService } from "./core/service.ts";
import { registerAgentWorkerProtocol } from "./protocol/server.ts";
import { registerAgentWorkerTools } from "./tools/index.ts";
import { registerAgentWorkerWidget } from "./ui/widget.ts";

export { getDefaultAgentWorkerConfigDir, readWorkspaceConfig, updateWorkspaceConfig } from "./config/index.ts";
export type { WorkspaceAgentWorkerConfig } from "./config/index.ts";
export { getBuiltInWorkerProfiles, getWorkerProfiles, resolveWorkerProfile, validateCustomWorkerProfiles } from "./config/profiles.ts";
export type { ResolvedWorkerRequest, WorkerMode, WorkerProfile, WorkerRequest, WorkerResult } from "./core/request-types.ts";
export { AgentWorkerService, workerResultFromRun } from "./core/service.ts";
export { registerAgentWorkerProtocol } from "./protocol/server.ts";
export * from "./protocol/types.ts";
export { registerAgentWorkerTools, workerRunSummary } from "./tools/index.ts";
export { registerAgentWorkerWidget, renderWorkerWidget } from "./ui/widget.ts";

export default function agentWorkersExtension(pi: ExtensionAPI): void {
  const service = new AgentWorkerService();
  registerAgentWorkerCommands(pi, service);
  registerAgentWorkerTools(pi, service);
  registerAgentWorkerWidget(pi, service);
	const disposeProtocol = registerAgentWorkerProtocol(pi.events, service);
	pi.on("session_shutdown", () => disposeProtocol());
}
