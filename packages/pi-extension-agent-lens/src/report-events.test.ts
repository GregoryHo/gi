import test from "node:test";
import assert from "node:assert/strict";
import { classifyTraceRecord } from "./report-events.ts";

test("classifyTraceRecord creates provider chips and summary from redacted metadata", () => {
	const event = classifyTraceRecord({
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:01.100Z",
		event: "before_provider_request",
		data: { runIndex: 2, payload: { model: "gpt-4.1", inputCount: 1, inputRoles: { user: 1 }, toolCount: 4, instructionsLength: 19992 } },
	}, 0);

	assert.equal(event.category, "provider");
	assert.equal(event.label, "Provider request");
	assert.equal(event.runIndex, 2);
	assert.equal(event.chips.includes("provider"), false);
	assert.equal(event.chips.includes("run:2"), false);
	assert.deepEqual(event.chips.includes("model:gpt-4.1"), true);
	assert.deepEqual(event.chips.includes("tools:4"), true);
	assert.match(event.summary, /model gpt-4\.1/);
	assert.match(event.searchText, /instructionsLength/);
});

test("classifyTraceRecord creates context role chips without raw content", () => {
	const event = classifyTraceRecord({
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:02.000Z",
		event: "context",
		data: { runIndex: 1, messages: { count: 3, roleCounts: { user: 1, assistant: 2 }, contentChars: 1234, toolCallNames: ["bash"] } },
	}, 1);

	assert.equal(event.category, "context");
	assert.equal(event.chips.includes("context"), false);
	assert.equal(event.chips.includes("run:1"), false);
	assert.deepEqual(event.chips.includes("messages:3"), true);
	assert.deepEqual(event.chips.includes("user:1"), true);
	assert.deepEqual(event.chips.includes("assistant:2"), true);
	assert.deepEqual(event.chips.includes("tool:bash"), true);
	assert.match(event.summary, /3 messages/);
});

test("classifyTraceRecord keeps run and turn identifiers out of noisy chips", () => {
	const event = classifyTraceRecord({
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:02.500Z",
		event: "turn_start",
		data: { runIndex: 1, turnIndex: 0 },
	}, 2);

	assert.equal(event.category, "turn");
	assert.equal(event.runIndex, 1);
	assert.equal(event.turnIndex, 0);
	assert.deepEqual(event.chips, ["start"]);
});

test("classifyTraceRecord creates turn/tool chips from turn_end summaries", () => {
	const event = classifyTraceRecord({
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:03.000Z",
		event: "turn_end",
		data: { runIndex: 1, turnIndex: 4, assistant: { count: 1, toolCallNames: ["read"] }, toolResults: { count: 1, toolResultNames: ["read"] } },
	}, 2);

	assert.equal(event.category, "turn");
	assert.equal(event.turnIndex, 4);
	assert.equal(event.chips.includes("turn"), false);
	assert.equal(event.chips.includes("turn:4"), false);
	assert.equal(event.chips.includes("run:1"), false);
	assert.deepEqual(event.chips.includes("tool:read"), true);
	assert.match(event.summary, /tool result/);
});

test("classifyTraceRecord creates compaction chips", () => {
	const event = classifyTraceRecord({
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:04.000Z",
		event: "session_compact",
		data: { runIndex: 1, compaction: { tokensBefore: 129565, firstKeptEntryId: "abc", summary: { length: 2765, sha256: "def" } } },
	}, 3);

	assert.equal(event.category, "compaction");
	assert.equal(event.chips.includes("compaction"), false);
	assert.equal(event.chips.includes("run:1"), false);
	assert.deepEqual(event.chips.includes("tokens:129565"), true);
	assert.deepEqual(event.chips.includes("summary:2765"), true);
	assert.match(event.summary, /129565 tokens/);
});
