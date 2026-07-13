import assert from "node:assert/strict";
import test from "node:test";

import { AgentWorkerProtocolError } from "./protocol.ts";
import { executeSubagentCalls, validateSubagentParams, type SubagentProtocol } from "./subagent.ts";

test("subagent validation rejects invalid calls before delegation", () => {
	assert.throws(() => validateSubagentParams({ calls: [] }), /between 1 and 4/);
	assert.throws(() => validateSubagentParams({ calls: Array.from({ length: 5 }, () => ({ agent: "explorer", task: "x" })) }), /between 1 and 4/);
	assert.throws(() => validateSubagentParams({ calls: [{ agent: "unknown", task: "x" }] }), /Unknown subagent/);
	assert.throws(() => validateSubagentParams({ calls: [{ agent: "reviewer", task: "   " }] }), /non-empty/);
	assert.throws(() => validateSubagentParams({ calls: [{ agent: "reviewer", task: "x".repeat(8001) }] }), /8000/);
});

test("subagent fails clearly when Agent Workers runtime is missing before confirmation", async () => {
	let confirmCount = 0;
	const protocol: SubagentProtocol = {
		discover: async () => {
			throw new AgentWorkerProtocolError("runtime_unavailable", "Agent Workers runtime did not respond.");
		},
		request: async () => {
			throw new Error("must not start");
		},
	};

	await assert.rejects(
		executeSubagentCalls({ calls: [{ agent: "explorer", task: "inspect" }] }, {
			protocol,
			confirm: async () => {
				confirmCount++;
				return true;
			},
		}),
		/Agent Workers runtime/,
	);
	assert.equal(confirmCount, 0);
});

test("subagent rejection starts no workers", async () => {
	let requestCount = 0;
	const protocol: SubagentProtocol = {
		discover: async () => ({ versions: [1], operations: ["start", "wait", "cancel"] }),
		request: async () => {
			requestCount++;
			return {};
		},
	};

	const result = await executeSubagentCalls({ calls: [{ agent: "planner", task: "plan" }] }, {
		protocol,
		confirm: async () => false,
	});

	assert.equal(result.cancelled, true);
	assert.equal(requestCount, 0);
});

test("subagent abort cancels every started run", async () => {
	const controller = new AbortController();
	const cancelled: string[] = [];
	let started = 0;
	const protocol: SubagentProtocol = {
		discover: async () => ({ versions: [1], operations: ["start", "wait", "cancel"] }),
		request: async (operation, payload) => {
			if (operation === "start") return { runId: `run-${++started}` };
			if (operation === "cancel") {
				cancelled.push((payload as { runId: string }).runId);
				return { runId: (payload as { runId: string }).runId, status: "cancelled" };
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
			return { completed: false, result: { runId: (payload as { runId: string }).runId, status: "running" } };
		},
	};

	const execution = executeSubagentCalls({
		calls: [
			{ agent: "explorer", task: "first" },
			{ agent: "reviewer", task: "second" },
		],
	}, { protocol, confirm: async () => true, signal: controller.signal });
	await new Promise((resolve) => setTimeout(resolve, 5));
	controller.abort();
	const result = await execution;

	assert.deepEqual(cancelled.sort(), ["run-1", "run-2"]);
	assert.ok(result.results.every((item) => item.error?.includes("aborted")));
});

test("subagent reports bounded foreground progress without changing result order", async () => {
	const progress: Array<{ phase: string; completed: number; total: number; agent?: string }> = [];
	const protocol: SubagentProtocol = {
		discover: async () => ({ versions: [1], operations: ["start", "wait", "cancel"] }),
		request: async (operation, payload) => {
			if (operation === "start") return { runId: "run-1" };
			return { completed: true, result: { runId: (payload as { runId: string }).runId, status: "completed", finalText: "complete" } };
		},
	};

	const result = await executeSubagentCalls({ calls: [{ agent: "reviewer", task: "review" }] }, {
		protocol,
		confirm: async () => true,
		onProgress: (update) => progress.push(update),
	});

	assert.equal(result.results[0]?.finalText, "complete");
	assert.deepEqual(progress, [
		{ phase: "started", completed: 0, total: 1, agent: "reviewer" },
		{ phase: "completed", completed: 1, total: 1, agent: "reviewer" },
	]);
});

test("subagent starts calls in parallel, narrows authority, preserves order, and isolates failures", async () => {
	const starts: Array<Record<string, unknown>> = [];
	let startCount = 0;
	const protocol: SubagentProtocol = {
		discover: async () => ({ versions: [1], operations: ["start", "wait", "cancel"] }),
		request: async (operation, payload) => {
			if (operation === "start") {
				starts.push(payload as Record<string, unknown>);
				const runNumber = ++startCount;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return { runId: `run-${runNumber}` };
			}
			const runId = (payload as { runId: string }).runId;
			if (runId === "run-2") throw new Error("child failed");
			await new Promise((resolve) => setTimeout(resolve, runId === "run-1" ? 10 : 1));
			return { completed: true, result: { runId, status: "completed", finalText: `result ${runId}` } };
		},
	};

	const result = await executeSubagentCalls({
		cwd: "/tmp/project",
		calls: [
			{ agent: "explorer", task: "first" },
			{ agent: "reviewer", task: "second" },
			{ agent: "planner", task: "third" },
		],
	}, { protocol, confirm: async () => true });

	assert.equal(starts.length, 3);
	for (const start of starts) {
		const worker = start.request as Record<string, unknown>;
		assert.equal(worker.adapter, "pi-sdk");
		assert.equal(worker.readOnly, true);
		assert.equal(worker.maxTurns, 8);
		assert.equal(worker.timeoutMs, 120_000);
		assert.equal(worker.cwd, "/tmp/project");
		assert.equal(start.approved, true);
	}
	assert.deepEqual(result.results.map((item) => item.agent), ["explorer", "reviewer", "planner"]);
	assert.equal(result.results[0]?.finalText, "result run-1");
	assert.match(result.results[1]?.error ?? "", /child failed/);
	assert.equal(result.results[2]?.finalText, "result run-3");
});
