import assert from "node:assert/strict";
import test from "node:test";

import { createEventBus, type EventBus } from "@earendil-works/pi-coding-agent";

import { AgentWorkerService } from "../core/service.ts";
import type { WorkerManager } from "../core/worker-manager.ts";
import type { WorkerRun } from "../core/worker-types.ts";
import { registerAgentWorkerProtocol } from "./server.ts";
import {
	AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL,
	AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL,
	AGENT_WORKER_PROTOCOL_VERSION,
	type AgentWorkerProtocolRequest,
	type AgentWorkerProtocolResponse,
} from "./types.ts";

function request(bus: EventBus, message: AgentWorkerProtocolRequest): Promise<AgentWorkerProtocolResponse> {
	return new Promise((resolve) => {
		const unsubscribe = bus.on(AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL, (data) => {
			const response = data as AgentWorkerProtocolResponse;
			if (response.correlationId !== message.correlationId) return;
			unsubscribe();
			resolve(response);
		});
		bus.emit(AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL, message);
	});
}

function message(correlationId: string, operation: AgentWorkerProtocolRequest["operation"], payload: unknown = {}): AgentWorkerProtocolRequest {
	return { version: AGENT_WORKER_PROTOCOL_VERSION, correlationId, operation, payload };
}

test("worker protocol discovers capabilities and correlates parallel responses", async () => {
	const bus = createEventBus();
	const dispose = registerAgentWorkerProtocol(bus, new AgentWorkerService());

	const [first, second] = await Promise.all([
		request(bus, message("cap-1", "capabilities")),
		request(bus, message("cap-2", "capabilities")),
	]);

	assert.equal(first.correlationId, "cap-1");
	assert.equal(second.correlationId, "cap-2");
	assert.equal(first.ok, true);
	assert.deepEqual((first as { data: { versions: number[] } }).data.versions, [1]);
	assert.deepEqual((first as { data: { operations: string[] } }).data.operations, [
		"capabilities",
		"start",
		"status",
		"wait",
		"cancel",
		"list_profiles",
	]);
	dispose();
});

test("worker protocol start/status/wait/cancel/profile operations share one service", async () => {
	const bus = createEventBus();
	const service = new AgentWorkerService();
	const dispose = registerAgentWorkerProtocol(bus, service);

	const started = await request(bus, message("start", "start", {
		request: { adapter: "demo", task: "protocol demo", cwd: process.cwd(), durationMs: 1 },
	}));
	assert.equal(started.ok, true);
	const runId = (started as { data: { runId: string } }).data.runId;
	assert.ok(service.getRun(runId));

	const status = await request(bus, message("status", "status", { runId }));
	assert.equal((status as { data: { runId: string } }).data.runId, runId);

	const waited = await request(bus, message("wait", "wait", { runId, waitMs: 1000 }));
	assert.equal((waited as { data: { completed: boolean } }).data.completed, true);

	const cancellable = await service.start({ adapter: "demo", task: "cancel me", cwd: process.cwd(), durationMs: 5000 });
	const cancelled = await request(bus, message("cancel", "cancel", { runId: cancellable.id }));
	assert.equal((cancelled as { data: { status: string } }).data.status, "cancelled");

	const profiles = await request(bus, message("profiles", "list_profiles", { cwd: process.cwd() }));
	assert.ok((profiles as { data: unknown[] }).data.length >= 4);
	dispose();
});

test("worker protocol returns bounded complete results without mutable run records", async () => {
	const bus = createEventBus();
	const run: WorkerRun = {
		id: "run_result",
		adapter: "pi-sdk",
		taskPreview: "bounded result",
		cwd: process.cwd(),
		status: "completed",
		statusReason: "exit_zero",
		startedAt: 1,
		endedAt: 2,
		lastActivityAt: 2,
		logPath: "/private/run.log",
		finalText: "complete delegated result",
		finalTextPath: "/private/full.log",
		usage: { source: "unknown" },
		activity: ["complete"],
	};
	const manager = { getRun: () => run } as unknown as WorkerManager;
	const service = new AgentWorkerService({ manager });
	const dispose = registerAgentWorkerProtocol(bus, service);

	const response = await request(bus, message("result", "status", { runId: run.id }));
	assert.equal((response as { data: { finalText: string } }).data.finalText, "complete delegated result");
	assert.equal((response as { data: { finalTextPath: string } }).data.finalTextPath, "/private/full.log");
	(response as { data: { activity: string[] } }).data.activity.push("mutated");
	assert.deepEqual(run.activity, ["complete"]);
	dispose();
});

test("worker protocol rejects version mismatch, malformed requests, and unconfirmed real runs", async () => {
	const bus = createEventBus();
	const dispose = registerAgentWorkerProtocol(bus, new AgentWorkerService());

	const version = await request(bus, { ...message("version", "capabilities"), version: 99 });
	assert.equal(version.ok, false);
	assert.equal((version as { error: { code: string } }).error.code, "unsupported_version");

	const malformed = await request(bus, message("bad", "status", {}));
	assert.equal(malformed.ok, false);
	assert.equal((malformed as { error: { code: string } }).error.code, "invalid_request");

	const confirmation = await request(bus, message("confirm", "start", {
		request: { adapter: "pi-sdk", task: "inspect", cwd: process.cwd() },
	}));
	assert.equal(confirmation.ok, false);
	assert.equal((confirmation as { error: { code: string } }).error.code, "confirmation_required");
	dispose();
});

test("worker protocol disposal removes its request listener", async () => {
	const bus = createEventBus();
	const dispose = registerAgentWorkerProtocol(bus, new AgentWorkerService());
	dispose();

	let responseCount = 0;
	const unsubscribe = bus.on(AGENT_WORKER_PROTOCOL_RESPONSE_CHANNEL, () => responseCount++);
	bus.emit(AGENT_WORKER_PROTOCOL_REQUEST_CHANNEL, message("disposed", "capabilities"));
	await new Promise((resolve) => setTimeout(resolve, 10));
	unsubscribe();

	assert.equal(responseCount, 0);
});
