import type { AgentWorkerProtocolCapabilities, AgentWorkerProtocolData, AgentWorkerProtocolOperation } from "@gregho/pi-extension-agent-workers/protocol";

import { getSubagentDefinition, type SubagentName } from "./agents.ts";

export interface SubagentCall {
	agent: string;
	task: string;
}

export interface SubagentParams {
	calls: SubagentCall[];
	cwd?: string;
}

export interface SubagentCallResult {
	agent: SubagentName;
	task: string;
	runId?: string;
	status?: string;
	finalText?: string;
	finalTextPath?: string;
	error?: string;
}

export interface SubagentExecutionResult {
	cancelled: boolean;
	results: SubagentCallResult[];
}

export interface SubagentProtocol {
	discover(): Promise<Pick<AgentWorkerProtocolCapabilities, "versions"> & { operations: readonly string[] }>;
	request(operation: AgentWorkerProtocolOperation, payload: unknown, options?: { timeoutMs?: number }): Promise<AgentWorkerProtocolData | Record<string, unknown>>;
}

export function validateSubagentParams(params: SubagentParams): Array<SubagentCall & { agent: SubagentName }> {
	if (!Array.isArray(params.calls) || params.calls.length < 1 || params.calls.length > 4) {
		throw new Error("Subagent calls must contain between 1 and 4 entries.");
	}
	return params.calls.map((call, index) => {
		const definition = getSubagentDefinition(call.agent);
		if (!definition) throw new Error(`Unknown subagent at calls[${index}]: ${call.agent}.`);
		if (typeof call.task !== "string" || call.task.trim().length === 0) {
			throw new Error(`Subagent task at calls[${index}] must be non-empty.`);
		}
		if (call.task.length > 8000) throw new Error(`Subagent task at calls[${index}] exceeds 8000 characters.`);
		return { agent: definition.name, task: call.task.trim() };
	});
}

export async function executeSubagentCalls(
	params: SubagentParams,
	dependencies: { protocol: SubagentProtocol; confirm(): Promise<boolean>; signal?: AbortSignal },
): Promise<SubagentExecutionResult> {
	const calls = validateSubagentParams(params);
	const capabilities = await dependencies.protocol.discover();
	if (
		!capabilities.versions.includes(1) ||
		!capabilities.operations.includes("start") ||
		!capabilities.operations.includes("wait") ||
		!capabilities.operations.includes("cancel")
	) {
		throw new Error("Agent Workers runtime does not support the required protocol v1 start/wait/cancel operations.");
	}
	if (!(await dependencies.confirm())) return { cancelled: true, results: [] };

	const results = await Promise.all(calls.map(async (call): Promise<SubagentCallResult> => {
		const definition = getSubagentDefinition(call.agent)!;
		try {
			const started = asRecord(await dependencies.protocol.request("start", {
				approved: true,
				request: {
					adapter: "pi-sdk",
					mode: definition.mode,
					task: call.task,
					systemPrompt: definition.systemPrompt,
					cwd: params.cwd,
					readOnly: true,
					maxTurns: definition.maxTurns,
					timeoutMs: definition.timeoutMs,
					requireConfirmation: true,
				},
			}, { timeoutMs: 5000 }));
			const runId = typeof started?.runId === "string" ? started.runId : undefined;
			if (!runId) throw new Error("Agent Workers start response did not include runId.");
			const waited = asRecord(await waitForSubagentRun(
				dependencies.protocol,
				runId,
				definition.timeoutMs,
				dependencies.signal,
			));
			const worker = asRecord(waited?.result);
			return {
				agent: definition.name,
				task: call.task,
				runId,
				...(typeof worker?.status === "string" ? { status: worker.status } : {}),
				...(typeof worker?.finalText === "string" ? { finalText: worker.finalText } : {}),
				...(typeof worker?.finalTextPath === "string" ? { finalTextPath: worker.finalTextPath } : {}),
				...(!worker ? { error: "Agent Workers wait response did not include a result." } : {}),
			};
		} catch (error) {
			return {
				agent: definition.name,
				task: call.task,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}));

	return { cancelled: false, results };
}

async function waitForSubagentRun(
	protocol: SubagentProtocol,
	runId: string,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<AgentWorkerProtocolData | Record<string, unknown>> {
	const wait = protocol.request("wait", {
		runId,
		waitMs: timeoutMs + 5000,
	}, { timeoutMs: timeoutMs + 10_000 });
	if (!signal) return wait;

	let onAbort: (() => void) | undefined;
	const aborted = new Promise<never>((_resolve, reject) => {
		onAbort = () => {
			void protocol.request("cancel", { runId }, { timeoutMs: 5000 }).finally(() => {
				reject(new Error(`Subagent run ${runId} was aborted.`));
			});
		};
		if (signal.aborted) onAbort();
		else signal.addEventListener("abort", onAbort, { once: true });
	});

	try {
		return await Promise.race([wait, aborted]);
	} finally {
		if (onAbort) signal.removeEventListener("abort", onAbort);
	}
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}
