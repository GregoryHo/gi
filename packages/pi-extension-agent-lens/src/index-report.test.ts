import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderIndexReport, writeIndexReport } from "./index-report.ts";
import type { TraceSummary } from "./traces.ts";

const summaries: TraceSummary[] = [
	{
		traceFile: "/repo/.pi-agent-lens/agent-lens-new.jsonl",
		recordCount: 2,
		lastEvent: "context",
		lastTimestamp: "2026-06-07T02:00:01.000Z",
		sizeBytes: 20,
		modifiedAt: "2026-06-07T02:00:02.000Z",
	},
	{
		traceFile: "/repo/.pi-agent-lens/agent-lens-old.jsonl",
		recordCount: 1,
		lastEvent: "agent_start",
		lastTimestamp: "2026-06-07T01:00:00.000Z",
		sizeBytes: 10,
		modifiedAt: "2026-06-07T01:00:02.000Z",
	},
];

test("renderIndexReport renders trace table, report links, and active marker", () => {
	const html = renderIndexReport(summaries, {
		artifactRoot: "/repo/.pi-agent-lens",
		activeTraceFile: "/repo/.pi-agent-lens/agent-lens-new.jsonl",
		reportFiles: new Set(["/repo/.pi-agent-lens/agent-lens-new.html"]),
		generatedAt: "2026-06-07T03:00:00.000Z",
	});

	assert.match(html, /Agent Lens Index/);
	assert.match(html, /agent-lens-new.jsonl/);
	assert.match(html, /active/);
	assert.match(html, /href="agent-lens-new.html"/);
	assert.match(html, /No report/);
	assert.match(html, /20 B/);
	assert.match(html, /2026-06-07T03:00:00.000Z/);
});

test("renderIndexReport renders local index controls and row metadata", () => {
	const html = renderIndexReport([
		...summaries,
		{ traceFile: "/repo/.pi-agent-lens/agent-lens-empty.jsonl", recordCount: 0 },
	], {
		artifactRoot: "/repo/.pi-agent-lens",
		activeTraceFile: "/repo/.pi-agent-lens/agent-lens-new.jsonl",
		reportFiles: new Set(["/repo/.pi-agent-lens/agent-lens-new.html"]),
		generatedAt: "2026-06-07T03:00:00.000Z",
	});

	assert.match(html, /id="trace-search"/);
	assert.match(html, /id="active-filter"/);
	assert.match(html, /id="event-filter"/);
	assert.match(html, /id="report-filter"/);
	assert.match(html, /id="sort-traces"/);
	assert.match(html, /id="empty-trace-message"/);
	assert.match(html, /data-active="true"/);
	assert.match(html, /data-report="available"/);
	assert.match(html, /data-report="missing"/);
	assert.match(html, /data-trace-search="agent-lens-empty.jsonl/);
	assert.match(html, /<td>missing<\/td>/);
	assert.match(html, /<option value="context">context<\/option>/);
});

test("renderIndexReport escapes dynamic values", () => {
	const html = renderIndexReport([
		{ traceFile: "/repo/.pi-agent-lens/<script>.jsonl", recordCount: 1, lastEvent: "x<script>", lastTimestamp: "<bad>", sizeBytes: 1, modifiedAt: "<bad>" },
	], { artifactRoot: "/repo/.pi-agent-lens" });

	assert.equal(html.includes("<script>.jsonl"), false);
	assert.equal(html.includes("x<script>"), false);
	assert.match(html, /&lt;script&gt;.jsonl/);
	assert.match(html, /x&lt;script&gt;/);
});

test("writeIndexReport writes index.html under artifact root", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-index-report-"));
	try {
		const traceFile = join(dir, "agent-lens-one.jsonl");
		const reportFile = join(dir, "agent-lens-one.html");
		await writeFile(traceFile, JSON.stringify({ timestamp: "2026-06-07T02:00:00.000Z", event: "context" }) + "\n", "utf8");
		await writeFile(reportFile, "<html></html>", "utf8");

		const indexFile = await writeIndexReport({ artifactRoot: dir, activeTraceFile: traceFile });
		const html = await readFile(indexFile, "utf8");

		assert.equal(indexFile, join(dir, "index.html"));
		assert.match(html, /agent-lens-one.jsonl/);
		assert.match(html, /href="agent-lens-one.html"/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
