import { randomUUID } from "node:crypto";

import type { EventBus } from "@earendil-works/pi-coding-agent";

const PROTOCOL_VERSION = 1;
const REQUEST_CHANNEL = "agent-workers:runtime:request";
const RESPONSE_CHANNEL = "agent-workers:runtime:response";

type ProtocolOperation = "capabilities" | "start" | "status" | "wait" | "cancel" | "list_profiles";

export interface AgentWorkerProtocolCapabilities {
	versions: number[];
	operations: string[];
}

export class AgentWorkerProtocolError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "AgentWorkerProtocolError";
		this.code = code;
	}
}

export async function discoverAgentWorkerProtocol(events: EventBus, options: { timeoutMs?: number } = {}): Promise<AgentWorkerProtocolCapabilities> {
	try {
		return await requestAgentWorkerProtocol(events, "capabilities", {}, options) as unknown as AgentWorkerProtocolCapabilities;
	} catch (error) {
		if (error instanceof AgentWorkerProtocolError && error.code === "response_timeout") {
			throw new AgentWorkerProtocolError("runtime_unavailable", "Agent Workers runtime did not respond.");
		}
		throw error;
	}
}

export function requestAgentWorkerProtocol(
	events: EventBus,
	operation: ProtocolOperation,
	payload: unknown,
	options: { timeoutMs?: number } = {},
): Promise<Record<string, unknown>> {
	const correlationId = randomUUID();
	const timeoutMs = options.timeoutMs ?? 5_000;

	return new Promise((resolve, reject) => {
		let settled = false;
		const unsubscribe = events.on(RESPONSE_CHANNEL, (data) => {
			const response = data as Record<string, unknown>;
			if (settled || response.correlationId !== correlationId) return;
			settled = true;
			clearTimeout(timer);
			unsubscribe();
			if (response.ok === true) {
				resolve(response.data as Record<string, unknown>);
				return;
			}
			const failure = response.error as { code?: string; message?: string } | undefined;
			reject(new AgentWorkerProtocolError(failure?.code ?? "handler_error", failure?.message ?? "Agent Workers protocol request failed."));
		});
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			unsubscribe();
			reject(new AgentWorkerProtocolError("response_timeout", `Agent Workers protocol response timed out after ${timeoutMs}ms.`));
		}, timeoutMs);
		events.emit(REQUEST_CHANNEL, { version: PROTOCOL_VERSION, correlationId, operation, payload });
	});
}
