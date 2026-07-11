import { randomUUID } from "node:crypto";

import type { EventBus } from "@earendil-works/pi-coding-agent";

import {
	AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL,
	AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL,
	AGENT_WORKER_PROTOCOL_VERSION,
	type AgentWorkerProtocolCapabilities,
	type AgentWorkerProtocolData,
	type AgentWorkerProtocolOperation,
	type AgentWorkerProtocolRequest,
	type AgentWorkerProtocolResponse,
} from "./types.ts";

export class AgentWorkerProtocolError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "AgentWorkerProtocolError";
		this.code = code;
	}
}

export async function discoverAgentWorkerProtocol(
	events: EventBus,
	options: { timeoutMs?: number } = {},
): Promise<AgentWorkerProtocolCapabilities> {
	try {
		const data = await requestAgentWorkerProtocol(events, "capabilities", {}, options);
		return data as AgentWorkerProtocolCapabilities;
	} catch (error) {
		if (error instanceof AgentWorkerProtocolError && error.code === "response_timeout") {
			throw new AgentWorkerProtocolError("runtime_unavailable", "Agent Workers runtime did not respond.");
		}
		throw error;
	}
}

export function requestAgentWorkerProtocol(
	events: EventBus,
	operation: AgentWorkerProtocolOperation,
	payload: unknown,
	options: { timeoutMs?: number; correlationId?: string } = {},
): Promise<AgentWorkerProtocolData> {
	const correlationId = options.correlationId ?? randomUUID();
	const timeoutMs = options.timeoutMs ?? 5000;
	const message: AgentWorkerProtocolRequest = {
		version: AGENT_WORKER_PROTOCOL_VERSION,
		correlationId,
		operation,
		payload,
	};

	return new Promise((resolve, reject) => {
		let settled = false;
		const unsubscribe = events.on(AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL, (data) => {
			const response = data as AgentWorkerProtocolResponse;
			if (response?.correlationId !== correlationId || settled) return;
			settled = true;
			clearTimeout(timer);
			unsubscribe();
			if (response.ok) resolve(response.data);
			else reject(new AgentWorkerProtocolError(response.error.code, response.error.message));
		});
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			unsubscribe();
			reject(new AgentWorkerProtocolError("response_timeout", `Agent Workers protocol response timed out after ${timeoutMs}ms.`));
		}, timeoutMs);
		events.emit(AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL, message);
	});
}
