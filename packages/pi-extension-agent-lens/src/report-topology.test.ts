import test from "node:test";
import assert from "node:assert/strict";
import { buildTopologyModel } from "./report-topology.ts";

const records = [
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:00.000Z", event: "before_agent_start", data: { runIndex: 1, prompt: { length: 12, sha256: "prompt-hash" } } },
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:01.000Z", event: "turn_start", data: { runIndex: 1, turnIndex: 0 } },
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:02.000Z", event: "context", data: { runIndex: 1, messages: { count: 4, roleCounts: { user: 1, assistant: 2, toolResult: 1 }, toolCallNames: ["read"], toolResultNames: ["bash"] } } },
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:03.000Z", event: "before_provider_request", data: { runIndex: 1, payload: { model: "test-model", inputCount: 3, inputRoles: { user: 1, assistant: 2 }, toolCount: 2 } } },
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:04.000Z", event: "turn_end", data: { runIndex: 1, turnIndex: 0, assistant: { count: 1, toolCallNames: ["read"] }, toolResults: { count: 1, toolResultNames: ["bash"] } } },
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:05.000Z", event: "session_before_compact", data: { runIndex: 1, branchEntryCount: 7, preparation: { firstKeptEntryId: "entry-2", tokensBefore: 1200, messagesToSummarize: { count: 3 } } } },
	{ schemaVersion: 1, timestamp: "2026-06-25T01:00:06.000Z", event: "session_compact", data: { runIndex: 1, compaction: { firstKeptEntryId: "entry-2", tokensBefore: 1200, summary: { length: 50, sha256: "summary-hash", text: "RAW_SUMMARY_SHOULD_NOT_RENDER" } } } },
] as const;

test("buildTopologyModel creates metadata-only nodes, lanes, and observed containment relationships", () => {
	const topology = buildTopologyModel(records);

	assert.equal(topology.nodes.some((node) => node.id === "trace" && node.kind === "trace"), true);
	assert.equal(topology.nodes.some((node) => node.id === "run-1" && node.kind === "run" && node.lane === "main-agent"), true);
	assert.equal(topology.nodes.some((node) => node.id === "turn-1-0" && node.kind === "turn" && node.lane === "main-agent"), true);
	assert.equal(topology.nodes.some((node) => node.kind === "provider-request" && node.lane === "provider" && node.recordIndex === 3), true);
	assert.equal(topology.nodes.some((node) => node.kind === "tool-activity" && node.lane === "tools" && node.label.includes("read")), true);
	assert.equal(topology.nodes.some((node) => node.kind === "compaction" && node.lane === "memory" && node.recordIndex === 6), true);
	assert.equal(topology.relationships.some((relationship) => relationship.from === "trace" && relationship.to === "run-1" && relationship.kind === "contains" && relationship.confidence === "observed"), true);
	assert.equal(topology.relationships.some((relationship) => relationship.from === "run-1" && relationship.to === "turn-1-0" && relationship.kind === "contains" && relationship.confidence === "observed"), true);
});

test("buildTopologyModel exposes inferred and nearby relationships for provider, tool, and compaction flow", () => {
	const topology = buildTopologyModel(records);

	assert.equal(topology.relationships.some((relationship) => relationship.kind === "triggered-by" && relationship.confidence === "inferred" && relationship.to.startsWith("provider-")), true);
	assert.equal(topology.relationships.some((relationship) => relationship.kind === "triggered-by" && relationship.confidence === "nearby observed" && relationship.to.startsWith("tool-")), true);
	assert.equal(topology.relationships.some((relationship) => relationship.kind === "summarizes" && relationship.confidence === "observed"), true);
	assert.equal(topology.relationships.some((relationship) => relationship.kind === "retains-after" && relationship.confidence === "observed"), true);
});

test("buildTopologyModel represents missing worker and branch topology safely", () => {
	const topology = buildTopologyModel(records);

	assert.equal(topology.gaps.workerMetadata, "missing");
	assert.equal(topology.gaps.sessionBranchTopology, "partial");
	assert.equal(topology.relationships.some((relationship) => relationship.kind === "parent-child-agent" && relationship.confidence === "missing"), true);
	assert.equal(topology.relationships.some((relationship) => relationship.kind === "branch-lineage" && relationship.confidence === "missing"), true);
});

test("buildTopologyModel does not expose raw summary or prompt text", () => {
	const topologyJson = JSON.stringify(buildTopologyModel(records));

	assert.equal(topologyJson.includes("RAW_SUMMARY_SHOULD_NOT_RENDER"), false);
	assert.equal(topologyJson.includes("prompt-hash"), false);
	assert.match(topologyJson, /summary-hash/);
});
