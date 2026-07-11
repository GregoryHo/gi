import type { EventBus } from "@earendil-works/pi-coding-agent";

import { workerResultFromRun, type AgentWorkerService } from "../core/service.ts";
import type { WorkerRequest } from "../core/request-types.ts";
import {
	AGENT_WORKER_PROTOCOL_OPERATIONS,
	AGENT_WORKER_PROTOCOL_READY_CHANNEL,
	AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL,
	AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL,
	AGENT_WORKER_PROTOCOL_VERSION,
	type AgentWorkerProtocolFailure,
	type AgentWorkerProtocolOperation,
	type AgentWorkerProtocolRequest,
	type AgentWorkerProtocolResponse,
	type AgentWorkerProtocolStartPayload,
} from "./types.ts";

export function registerAgentWorkerProtocol(events: EventBus, service: AgentWorkerService): () => void {
	const unsubscribe = events.on(AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL, (data) => {
		void handleRequest(data, service).then((response) => events.emit(AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL, response));
	});
	events.emit(AGENT_WORKER_PROTOCOL_READY_CHANNEL, {
		version: AGENT_WORKER_PROTOCOL_VERSION,
		operations: [...AGENT_WORKER_PROTOCOL_OPERATIONS],
	});
	return unsubscribe;
}

async function handleRequest(data: unknown, service: AgentWorkerService): Promise<AgentWorkerProtocolResponse> {
	const record = asRecord(data);
	const correlationId = typeof record?.correlationId === "string" ? record.correlationId : "unknown";
	if (record?.version !== AGENT_WORKER_PROTOCOL_VERSION) {
		return failure(correlationId, "unsupported_version", `Unsupported Agent Workers protocol version: ${String(record?.version)}.`);
	}
	if (!isOperation(record.operation) || typeof record.correlationId !== "string" || record.correlationId.length === 0) {
		return failure(correlationId, "invalid_request", "Malformed Agent Workers protocol request.");
	}
	const request = record as unknown as AgentWorkerProtocolRequest;
	try {
		return await dispatch(request, service);
	} catch (error) {
		return failure(correlationId, "handler_error", error instanceof Error ? error.message : String(error));
	}
}

async function dispatch(request: AgentWorkerProtocolRequest, service: AgentWorkerService): Promise<AgentWorkerProtocolResponse> {
	const payload = asRecord(request.payload);
	switch (request.operation) {
		case "capabilities":
			return success(request.correlationId, {
				versions: [AGENT_WORKER_PROTOCOL_VERSION],
				operations: [...AGENT_WORKER_PROTOCOL_OPERATIONS],
			});
		case "start": {
			const start = parseStartPayload(payload);
			if (!start) return failure(request.correlationId, "invalid_request", "start requires a valid worker request.");
			const resolved = await service.resolveRequestWithConfig(start.request);
			if (resolved.requireConfirmation && start.approved !== true) {
				return failure(request.correlationId, "confirmation_required", "This worker run requires explicit confirmation.");
			}
			return success(request.correlationId, workerResultFromRun(await service.start(start.request)));
		}
		case "status": {
			const runId = parseRunId(payload);
			if (!runId) return failure(request.correlationId, "invalid_request", "status requires runId.");
			const run = service.getRun(runId);
			return run
				? success(request.correlationId, workerResultFromRun(run))
				: failure(request.correlationId, "not_found", `Unknown worker run: ${runId}.`);
		}
		case "wait": {
			const runId = parseRunId(payload);
			if (!runId) return failure(request.correlationId, "invalid_request", "wait requires runId.");
			if (!service.getRun(runId)) return failure(request.correlationId, "not_found", `Unknown worker run: ${runId}.`);
			const waitMs = typeof payload?.waitMs === "number" && payload.waitMs >= 0 ? payload.waitMs : undefined;
			const waited = await service.waitForRun(runId, waitMs);
			return success(request.correlationId, { completed: waited.completed, result: workerResultFromRun(waited.run) });
		}
		case "cancel": {
			const runId = parseRunId(payload);
			if (!runId) return failure(request.correlationId, "invalid_request", "cancel requires runId.");
			if (!service.getRun(runId)) return failure(request.correlationId, "not_found", `Unknown worker run: ${runId}.`);
			return success(request.correlationId, workerResultFromRun(service.cancelRun(runId)));
		}
		case "list_profiles": {
			const cwd = typeof payload?.cwd === "string" ? payload.cwd : undefined;
			const profiles = await service.listProfiles(cwd);
			return success(request.correlationId, profiles.map((profile) => ({ ...profile })));
		}
	}
}

function parseStartPayload(payload: Record<string, unknown> | undefined): AgentWorkerProtocolStartPayload | undefined {
	const request = asRecord(payload?.request);
	if (!request || typeof request.task !== "string" || request.task.trim().length === 0) return undefined;
	return {
		request: { ...request } as unknown as WorkerRequest,
		...(payload?.approved === true ? { approved: true } : {}),
	};
}

function parseRunId(payload: Record<string, unknown> | undefined): string | undefined {
	return typeof payload?.runId === "string" && payload.runId.length > 0 ? payload.runId : undefined;
}

function success(correlationId: string, data: Parameters<typeof makeSuccess>[1]): AgentWorkerProtocolResponse {
	return makeSuccess(correlationId, data);
}

function makeSuccess(correlationId: string, data: import("./types.ts").AgentWorkerProtocolData) {
	return { version: AGENT_WORKER_PROTOCOL_VERSION, correlationId, ok: true as const, data };
}

function failure(correlationId: string, code: AgentWorkerProtocolFailure["error"]["code"], message: string): AgentWorkerProtocolFailure {
	return { version: AGENT_WORKER_PROTOCOL_VERSION, correlationId, ok: false, error: { code, message } };
}

function isOperation(value: unknown): value is AgentWorkerProtocolOperation {
	return typeof value === "string" && (AGENT_WORKER_PROTOCOL_OPERATIONS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}
