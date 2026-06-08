import test from "node:test";
import assert from "node:assert/strict";
import { buildCompactionExplorer } from "./report-compaction.ts";

const records = [
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T01:00:00.000Z",
		event: "context",
		data: { runIndex: 1, messages: { count: 21, roleCounts: { user: 8, assistant: 9, toolResult: 4 }, hasCompactionSummary: false } },
	},
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T01:00:01.000Z",
		event: "session_before_compact",
		data: {
			runIndex: 1,
			branchEntryCount: 42,
			preparation: {
				firstKeptEntryId: "entry-kept",
				tokensBefore: 129565,
				messagesToSummarize: { count: 12, roleCounts: { user: 5, assistant: 7 } },
				turnPrefixMessages: { count: 21, roleCounts: { user: 8, assistant: 9, toolResult: 4 } },
			},
		},
	},
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T01:00:02.000Z",
		event: "session_compact",
		data: {
			runIndex: 1,
			compaction: {
				id: "compact-1",
				firstKeptEntryId: "entry-kept",
				tokensBefore: 129565,
				summary: { length: 2765, sha256: "abc123", text: "RAW_SUMMARY_SHOULD_NOT_RENDER" },
				detailKeys: ["branch", "settings"],
			},
		},
	},
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T01:00:03.000Z",
		event: "context",
		data: { runIndex: 1, messages: { count: 8, roleCounts: { compactionSummary: 1, user: 3, assistant: 4 }, hasCompactionSummary: true } },
	},
] as const;

test("buildCompactionExplorer groups preparation, result, and nearby context snapshots", () => {
	const explorer = buildCompactionExplorer(records);

	assert.equal(explorer.groups.length, 1);
	assert.equal(explorer.groups[0].runIndex, 1);
	assert.equal(explorer.groups[0].preparation?.tokensBefore, 129565);
	assert.equal(explorer.groups[0].preparation?.messagesToSummarizeCount, 12);
	assert.equal(explorer.groups[0].result?.firstKeptEntryId, "entry-kept");
	assert.equal(explorer.groups[0].result?.summaryLength, 2765);
	assert.equal(explorer.groups[0].result?.summarySha256, "abc123");
	assert.deepEqual(explorer.groups[0].result?.detailKeys, ["branch", "settings"]);
	assert.equal(explorer.groups[0].contextBefore?.messageCount, 21);
	assert.equal(explorer.groups[0].contextAfter?.messageCount, 8);
	assert.equal(explorer.groups[0].contextAfter?.hasCompactionSummary, true);
});

test("buildCompactionExplorer has an empty state when there are no compactions", () => {
	const explorer = buildCompactionExplorer([
		{ schemaVersion: 1, timestamp: "2026-06-07T01:00:00.000Z", event: "context", data: { runIndex: 1, messages: { count: 2 } } },
	]);

	assert.deepEqual(explorer.groups, []);
});

test("buildCompactionExplorer does not expose raw summary text", () => {
	const explorerJson = JSON.stringify(buildCompactionExplorer(records));

	assert.equal(explorerJson.includes("RAW_SUMMARY_SHOULD_NOT_RENDER"), false);
	assert.match(explorerJson, /abc123/);
});
