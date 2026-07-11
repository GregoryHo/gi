import assert from "node:assert/strict";
import test from "node:test";

import { createEventBus } from "@earendil-works/pi-coding-agent";

import { AgentWorkerService } from "../core/service.ts";
import { discoverAgentWorkerProtocol, requestAgentWorkerProtocol } from "./client.ts";
import { registerAgentWorkerProtocol } from "./server.ts";

async function expectProtocolError(promise: Promise<unknown>, code: string): Promise<void> {
	await assert.rejects(promise, (error: unknown) => {
		return error instanceof Error && "code" in error && (error as Error & { code: string }).code === code;
	});
}

test("protocol client reports a missing runtime deterministically", async () => {
	const bus = createEventBus();

	await expectProtocolError(discoverAgentWorkerProtocol(bus, { timeoutMs: 5 }), "runtime_unavailable");
});

test("protocol client reports a caller response timeout without cancelling worker state", async () => {
	const bus = createEventBus();

	await expectProtocolError(requestAgentWorkerProtocol(bus, "status", { runId: "run_late" }, { timeoutMs: 5 }), "response_timeout");
});

test("protocol client correlates concurrent requests and exposes server errors", async () => {
	const bus = createEventBus();
	const dispose = registerAgentWorkerProtocol(bus, new AgentWorkerService());

	const [capabilities, profiles] = await Promise.all([
		discoverAgentWorkerProtocol(bus, { timeoutMs: 100 }),
		requestAgentWorkerProtocol(bus, "list_profiles", { cwd: process.cwd() }, { timeoutMs: 100 }),
	]);
	assert.deepEqual(capabilities.versions, [1]);
	assert.ok(Array.isArray(profiles));

	await expectProtocolError(requestAgentWorkerProtocol(bus, "status", {}, { timeoutMs: 100 }), "invalid_request");
	dispose();
});
