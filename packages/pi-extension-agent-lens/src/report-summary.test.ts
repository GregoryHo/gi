import test from "node:test";
import assert from "node:assert/strict";
import { summarizeTraceForReport } from "./report-summary.ts";

const records = [
	{ schemaVersion: 1, timestamp: "2026-06-07T01:00:00.000Z", event: "before_agent_start", data: { runIndex: 1 } },
	{ schemaVersion: 1, timestamp: "2026-06-07T01:00:01.000Z", event: "turn_start", data: { runIndex: 1, turnIndex: 0 } },
	{ schemaVersion: 1, timestamp: "2026-06-07T01:00:02.000Z", event: "context", data: { runIndex: 1, messages: { count: 4, roleCounts: { user: 1, assistant: 2, toolResult: 1 }, contentChars: 1234, toolCallNames: ["read"] } } },
	{ schemaVersion: 1, timestamp: "2026-06-07T01:00:03.000Z", event: "before_provider_request", data: { runIndex: 1, payload: { model: "gpt-4.1", inputCount: 2, toolCount: 4 } } },
	{ schemaVersion: 1, timestamp: "2026-06-07T01:00:04.000Z", event: "turn_end", data: { runIndex: 1, turnIndex: 0, assistant: { count: 1, toolCallNames: ["read", "bash"] }, toolResults: { count: 2, toolResultNames: ["read", "bash"] } } },
	{ schemaVersion: 1, timestamp: "2026-06-07T01:00:05.000Z", event: "session_compact", data: { runIndex: 1, compaction: { tokensBefore: 129565, summary: { length: 2765, sha256: "abc" } } } },
] as const;

test("summarizeTraceForReport extracts high-signal trace metrics", () => {
	const summary = summarizeTraceForReport(records);

	assert.equal(summary.totalRecords, 6);
	assert.equal(summary.runCount, 1);
	assert.equal(summary.turnCount, 1);
	assert.equal(summary.providerRequestCount, 1);
	assert.deepEqual(summary.models, ["gpt-4.1"]);
	assert.equal(summary.maxContextMessages, 4);
	assert.equal(summary.lastContextMessages, 4);
	assert.deepEqual(summary.contextRoleCounts, { user: 1, assistant: 2, toolResult: 1 });
	assert.deepEqual(summary.toolNames, ["bash", "read"]);
	assert.equal(summary.compactionCount, 1);
	assert.equal(summary.maxCompactionTokensBefore, 129565);
	assert.equal(summary.firstTimestamp, "2026-06-07T01:00:00.000Z");
	assert.equal(summary.lastTimestamp, "2026-06-07T01:00:05.000Z");
});

test("summarizeTraceForReport handles missing optional fields", () => {
	const summary = summarizeTraceForReport([
		{ schemaVersion: 1, timestamp: "2026-06-07T01:00:00.000Z", event: "custom", data: {} },
	]);

	assert.equal(summary.totalRecords, 1);
	assert.equal(summary.runCount, 0);
	assert.equal(summary.turnCount, 0);
	assert.deepEqual(summary.models, []);
	assert.equal(summary.maxContextMessages, undefined);
	assert.deepEqual(summary.toolNames, []);
	assert.equal(summary.compactionCount, 0);
});
