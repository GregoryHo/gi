import type { WorkerProfile, WorkerRequest, WorkerResult } from "../core/request-types.ts";

export const AGENT_WORKER_PROTOCOL_VERSION = 1 as const;
export const AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL = "agent-workers:runtime:request";
export const AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL = "agent-workers:runtime:response";
export const AGENT_WORKER_PROTOCOL_READY_CHANNEL = "agent-workers:runtime:ready";

export const AGENT_WORKER_PROTOCOL_OPERATIONS = [
	"capabilities",
	"start",
	"status",
	"wait",
	"cancel",
	"list_profiles",
] as const;

export type AgentWorkerProtocolOperation = (typeof AGENT_WORKER_PROTOCOL_OPERATIONS)[number];

export interface AgentWorkerProtocolRequest {
	version: number;
	correlationId: string;
	operation: AgentWorkerProtocolOperation;
	payload: unknown;
}

export interface AgentWorkerProtocolCapabilities {
	versions: number[];
	operations: AgentWorkerProtocolOperation[];
}

export type AgentWorkerProtocolData =
	| AgentWorkerProtocolCapabilities
	| WorkerResult
	| { completed: boolean; result: WorkerResult }
	| WorkerProfile[];

export interface AgentWorkerProtocolSuccess {
	version: typeof AGENT_WORKER_PROTOCOL_VERSION;
	correlationId: string;
	ok: true;
	data: AgentWorkerProtocolData;
}

export interface AgentWorkerProtocolFailure {
	version: typeof AGENT_WORKER_PROTOCOL_VERSION;
	correlationId: string;
	ok: false;
	error: {
		code: "unsupported_version" | "invalid_request" | "confirmation_required" | "not_found" | "handler_error";
		message: string;
	};
}

export type AgentWorkerProtocolResponse = AgentWorkerProtocolSuccess | AgentWorkerProtocolFailure;

export interface AgentWorkerProtocolStartPayload {
	request: WorkerRequest;
	approved?: boolean;
}
