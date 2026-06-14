import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderHtmlReport, writeHtmlReportForTrace } from "./report.ts";

const records = [
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:01.000Z",
		event: "before_agent_start",
		data: { runIndex: 1, prompt: { length: 6, sha256: "abc" } },
	},
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:01.100Z",
		event: "before_provider_request",
		data: { runIndex: 1, payload: { inputCount: 1, inputRoles: { user: 1 }, instructionsLength: 19992, toolCount: 4 } },
	},
	{
		schemaVersion: 1,
		timestamp: "2026-06-07T03:19:01.200Z",
		event: "session_compact",
		data: { runIndex: 1, compaction: { tokensBefore: 129565, summary: { length: 2765, sha256: "def" } } },
	},
] as const;

test("renderHtmlReport includes counts, timeline, provider, and compaction sections", () => {
	const html = renderHtmlReport(records, { title: "Agent Lens Test" });

	assert.match(html, /<title>Agent Lens Test<\/title>/);
	assert.match(html, /before_agent_start/);
	assert.match(html, /before_provider_request/);
	assert.match(html, /session_compact/);
	assert.match(html, /inputCount/);
	assert.match(html, /instructionsLength/);
	assert.match(html, /tokensBefore/);
	assert.match(html, /129565/);
});

test("renderHtmlReport includes trace summary cards", () => {
	const html = renderHtmlReport(records, { title: "Agent Lens Test" });

	assert.match(html, /Trace summary/);
	assert.match(html, /class="summary-card"/);
	assert.match(html, /Total records/);
	assert.match(html, /Provider requests/);
	assert.match(html, /Compactions/);
	assert.match(html, /129565 tokens/);
});

test("renderHtmlReport frames compactions as a partial memory-flow explorer", () => {
	const html = renderHtmlReport([
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:00.000Z", event: "context", data: { runIndex: 1, messages: { count: 21, roleCounts: { user: 8, assistant: 9 }, hasCompactionSummary: false } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:01.000Z", event: "session_before_compact", data: { runIndex: 1, preparation: { firstKeptEntryId: "entry-kept", tokensBefore: 129565, messagesToSummarize: { count: 12 }, turnPrefixMessages: { count: 21 } } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:02.000Z", event: "session_compact", data: { runIndex: 1, compaction: { firstKeptEntryId: "entry-kept", tokensBefore: 129565, summary: { length: 2765, sha256: "abc123", text: "RAW_SUMMARY_SHOULD_NOT_RENDER" }, detailKeys: ["settings"] } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:03.000Z", event: "context", data: { runIndex: 1, messages: { count: 8, roleCounts: { compactionSummary: 1, user: 3 }, hasCompactionSummary: true } } },
	], { title: "Agent Lens Test" });

	assert.match(html, /Memory flow explorer/);
	assert.match(html, /Partial metadata-only view/);
	assert.match(html, /What stayed recent/);
	assert.match(html, /What became summary metadata/);
	assert.match(html, /What the next observed provider request likely saw/);
	assert.match(html, /Before context/);
	assert.match(html, /After context/);
	assert.match(html, /129565 tokens/);
	assert.match(html, /summary length 2765/);
	assert.equal(html.includes("RAW_SUMMARY_SHOULD_NOT_RENDER"), false);
});

test("renderHtmlReport links memory-flow cards and related observable-log rows", () => {
	const html = renderHtmlReport([
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:00.000Z", event: "context", data: { runIndex: 1, messages: { count: 21, roleCounts: { user: 8, assistant: 9 }, hasCompactionSummary: false } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:01.000Z", event: "session_before_compact", data: { runIndex: 1, preparation: { firstKeptEntryId: "entry-kept", tokensBefore: 129565, messagesToSummarize: { count: 12 }, turnPrefixMessages: { count: 21 } } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:02.000Z", event: "session_compact", data: { runIndex: 1, compaction: { firstKeptEntryId: "entry-kept", tokensBefore: 129565, summary: { length: 2765, sha256: "abc123" }, detailKeys: ["settings"] } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:03.000Z", event: "context", data: { runIndex: 1, messages: { count: 8, roleCounts: { compactionSummary: 1, user: 3 }, hasCompactionSummary: true } } },
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:04.000Z", event: "before_provider_request", data: { runIndex: 1, payload: { model: "test-model", inputCount: 8, inputRoles: { system: 1, user: 3, assistant: 4 }, toolCount: 2, instructionsLength: 1000 } } },
	], { title: "Agent Lens Test" });

	assert.match(html, /id="memory-flow-1"/);
	assert.match(html, /id="memory-flow-1-before-context"/);
	assert.match(html, /href="#record-1">View record #1/);
	assert.match(html, /id="record-1"/);
	assert.match(html, /data-memory-flow="1"/);
	assert.match(html, /data-memory-role="before-context"/);
	assert.match(html, /href="#memory-flow-1">Memory flow #1/);
	assert.match(html, /next observed provider request/);
	assert.match(html, /href="#memory-flow-1">View memory flow/);
});

test("renderHtmlReport includes compaction explorer empty state", () => {
	const html = renderHtmlReport([
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:00.000Z", event: "context", data: { runIndex: 1, messages: { count: 2 } } },
	], { title: "Agent Lens Test" });

	assert.match(html, /Memory flow explorer/);
	assert.match(html, /No compaction records found/);
	assert.equal(html.includes('href="#memory-flow-1">View memory flow'), false);
});

test("renderHtmlReport shows run and turn identifiers as metadata instead of duplicate chips", () => {
	const html = renderHtmlReport([
		{ schemaVersion: 1, timestamp: "2026-06-07T03:19:00.000Z", event: "turn_start", data: { runIndex: 1, turnIndex: 0 } },
	], { title: "Agent Lens Test" });

	assert.match(html, /Run 1 · Turn 0/);
	assert.equal(html.includes('<span class="chip">run:1</span>'), false);
	assert.equal(html.includes('<span class="chip">turn</span>'), false);
	assert.equal(html.includes('<span class="chip">turn:0</span>'), false);
	assert.match(html, /<span class="chip">start<\/span>/);
});

test("renderHtmlReport includes section navigation, density controls, and visible-count metadata", () => {
	const html = renderHtmlReport(records, { title: "Agent Lens Test" });

	assert.match(html, /class="report-nav"/);
	assert.match(html, /href="#trace-summary"/);
	assert.match(html, /href="#memory-flow-explorer"/);
	assert.match(html, /href="#observable-log"/);
	assert.match(html, /id="density-comfortable"/);
	assert.match(html, /id="density-compact"/);
	assert.match(html, /agentLensSetDensity/);
	assert.match(html, /id="visible-log-count"/);
	assert.match(html, /3 visible/);
	assert.match(html, /data-total-log-rows="3"/);
	assert.match(html, /id="trace-summary"/);
	assert.match(html, /id="event-counts"/);
});

test("renderHtmlReport includes observable log chips, filters, search, and expandable details", () => {
	const html = renderHtmlReport(records, { title: "Agent Lens Test" });

	assert.match(html, /Observable log/);
	assert.match(html, /data-category="provider"/);
	assert.match(html, /class="chip category provider"/);
	assert.match(html, /model|provider|tools/);
	assert.match(html, /id="agent-lens-log-search"/);
	assert.match(html, /data-filter-category="provider"/);
	assert.match(html, /<details/);
	assert.match(html, /agentLensFilterLog/);
});

test("renderHtmlReport can include auto-refresh for live reports", () => {
	const html = renderHtmlReport(records, { title: "Live Agent Lens", refreshSeconds: 2 });

	assert.match(html, /<meta http-equiv="refresh" content="2">/);
	assert.match(html, /Live report refreshes every 2 seconds/);
});

test("renderHtmlReport escapes dynamic values", () => {
	const html = renderHtmlReport([
		{ schemaVersion: 1, timestamp: "<script>alert(1)</script>", event: "custom<script>", data: { value: "<img src=x onerror=alert(1)>" } },
	], { title: "<b>bad</b>" });

	assert.equal(html.includes("<script>alert(1)</script>"), false);
	assert.equal(html.includes("<img src=x onerror=alert(1)>"), false);
	assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("renderHtmlReport includes escaped source trace metadata", () => {
	const html = renderHtmlReport(records, {
		title: "Agent Lens Test",
		sourceTraceFile: "/repo/.pi-agent-lens/<trace>.jsonl",
		generatedAt: "2026-06-07T04:20:00.000Z",
	});

	assert.match(html, /Source trace/);
	assert.match(html, /\/repo\/.pi-agent-lens\/&lt;trace&gt;.jsonl/);
	assert.match(html, /2026-06-07T04:20:00.000Z/);
	assert.equal(html.includes("<trace>.jsonl"), false);
});

test("writeHtmlReportForTrace reads JSONL and writes adjacent plus latest HTML files", async () => {
	const dir = await mkdtemp(join(tmpdir(), "agent-lens-report-"));
	try {
		const traceFile = join(dir, "agent-lens-test.jsonl");
		await writeFile(traceFile, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");

		const reportFile = await writeHtmlReportForTrace(traceFile, { refreshSeconds: 2, writeLatestAlias: true });
		const html = await readFile(reportFile, "utf8");
		const latestHtml = await readFile(join(dir, "latest.html"), "utf8");

		assert.equal(reportFile, join(dir, "agent-lens-test.html"));
		assert.match(html, /Agent Lens Report/);
		assert.match(html, /before_provider_request/);
		assert.match(html, /<meta http-equiv="refresh" content="2">/);
		assert.match(html, /agent-lens-test.jsonl/);
		assert.equal(latestHtml, html);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
