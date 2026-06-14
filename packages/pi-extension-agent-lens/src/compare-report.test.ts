import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderTraceComparisonReport, writeTraceComparisonReport } from "./compare-report.ts";

test("renderTraceComparisonReport renders metadata-only trace comparison with report links", () => {
	const html = renderTraceComparisonReport([
		{
			traceFile: "/repo/.pi-agent-lens/agent-lens-a.jsonl",
			reportFile: "/repo/.pi-agent-lens/agent-lens-a.html",
			sizeBytes: 120,
			modifiedAt: "2026-06-14T01:00:00.000Z",
			summary: {
				totalRecords: 4,
				runCount: 1,
				turnCount: 1,
				providerRequestCount: 2,
				models: ["gpt-test"],
				maxContextMessages: 10,
				lastContextMessages: 8,
				contextRoleCounts: { user: 3 },
				toolNames: ["read"],
				compactionCount: 1,
				maxCompactionTokensBefore: 1200,
				firstTimestamp: "2026-06-14T00:00:00.000Z",
				lastTimestamp: "2026-06-14T00:02:00.000Z",
			},
		},
		{
			traceFile: "/repo/.pi-agent-lens/<trace-b>.jsonl",
			sizeBytes: undefined,
			modifiedAt: undefined,
			summary: {
				totalRecords: 1,
				runCount: 0,
				turnCount: 0,
				providerRequestCount: 0,
				models: [],
				contextRoleCounts: {},
				toolNames: [],
				compactionCount: 0,
			},
		},
	], { artifactRoot: "/repo/.pi-agent-lens", generatedAt: "2026-06-14T02:00:00.000Z" });

	assert.match(html, /Agent Lens Trace Comparison/);
	assert.match(html, /Metadata-only comparison/);
	assert.match(html, /No correctness or quality judgment/);
	assert.match(html, /agent-lens-a.jsonl/);
	assert.match(html, /href="agent-lens-a.html"/);
	assert.match(html, /gpt-test/);
	assert.match(html, /1200/);
	assert.match(html, /missing/);
	assert.equal(html.includes("<trace-b>.jsonl"), false);
	assert.match(html, /&lt;trace-b&gt;.jsonl/);
});

test("writeTraceComparisonReport reads local traces and writes compare.html", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-compare-report-"));
	try {
		const traceA = join(dir, "agent-lens-a.jsonl");
		const traceB = join(dir, "agent-lens-b.jsonl");
		await writeFile(traceA, [
			JSON.stringify({ schemaVersion: 1, timestamp: "2026-06-14T00:00:00.000Z", event: "before_agent_start", data: { runIndex: 1 } }),
			JSON.stringify({ schemaVersion: 1, timestamp: "2026-06-14T00:01:00.000Z", event: "before_provider_request", data: { runIndex: 1, payload: { model: "gpt-test" } } }),
		].join("\n") + "\n", "utf8");
		await writeFile(traceB, JSON.stringify({ schemaVersion: 1, timestamp: "2026-06-14T00:02:00.000Z", event: "context", data: { runIndex: 1, messages: { count: 3 } } }) + "\n", "utf8");
		await writeFile(join(dir, "agent-lens-a.html"), "<html></html>", "utf8");

		const compareFile = await writeTraceComparisonReport({ artifactRoot: dir, generatedAt: "2026-06-14T03:00:00.000Z" });
		const html = await readFile(compareFile, "utf8");

		assert.equal(compareFile, join(dir, "compare.html"));
		assert.match(html, /agent-lens-a.jsonl/);
		assert.match(html, /agent-lens-b.jsonl/);
		assert.match(html, /gpt-test/);
		assert.match(html, /href="agent-lens-a.html"/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
