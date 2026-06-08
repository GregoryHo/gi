import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildCompactionExplorer, type CompactionExplorer, type CompactionExplorerGroup, type ContextSnapshotView } from "./report-compaction.ts";
import { classifyTraceRecord, sanitizeReportValue, type ObservableLogEvent } from "./report-events.ts";
import { summarizeTraceForReport, type ReportTraceSummary } from "./report-summary.ts";

export interface AgentLensTraceRecord {
	schemaVersion: number;
	timestamp: string;
	event: string;
	data: unknown;
}

export interface HtmlReportOptions {
	title?: string;
	refreshSeconds?: number;
	sourceTraceFile?: string;
	generatedAt?: string;
	writeLatestAlias?: boolean;
}

export function renderHtmlReport(records: readonly AgentLensTraceRecord[], options: HtmlReportOptions = {}): string {
	const title = options.title ?? "Agent Lens Report";
	const eventCounts = countEvents(records);
	const providerRecords = records.filter((record) => record.event === "before_provider_request");
	const compactionRecords = records.filter(
		(record) => record.event === "session_before_compact" || record.event === "session_compact",
	);
	const contextRecords = records.filter((record) => record.event === "context");

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${renderRefreshMeta(options.refreshSeconds)}<title>${escapeHtml(title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.45; color: #17202a; }
section { margin: 2rem 0; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #d5d8dc; padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; }
th { background: #f4f6f7; }
pre { background: #f8f9f9; border: 1px solid #d5d8dc; padding: 0.75rem; overflow: auto; }
.badge, .chip { display: inline-block; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 999px; padding: 0.1rem 0.5rem; margin: 0.1rem; font-size: 0.85rem; }
.observable-log-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 1rem 0; }
.observable-log-controls input { min-width: 18rem; padding: 0.35rem 0.5rem; }
.filter-chip { border: 1px solid #bfc9ca; border-radius: 999px; background: #fff; padding: 0.25rem 0.6rem; cursor: pointer; }
.filter-chip.active { background: #17202a; color: #fff; }
.log-row { border: 1px solid #d5d8dc; border-radius: 0.6rem; padding: 0.75rem; margin: 0.75rem 0; }
.log-row-header { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.log-row-title { font-weight: 700; }
.log-row-meta { color: #5d6d7e; font-size: 0.9rem; }
.log-summary { margin: 0.45rem 0; }
.chip.category.run { background: #ecfdf3; border-color: #bbf7d0; }
.chip.category.turn { background: #eff6ff; border-color: #bfdbfe; }
.chip.category.context { background: #f5f3ff; border-color: #ddd6fe; }
.chip.category.provider { background: #fefce8; border-color: #fde68a; }
.chip.category.compaction { background: #fff7ed; border-color: #fed7aa; }
.chip.category.report { background: #f0fdfa; border-color: #99f6e4; }
.summary-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.75rem; margin: 1rem 0; }
.summary-card { border: 1px solid #d5d8dc; border-radius: 0.75rem; padding: 0.8rem; background: #fbfcfc; }
.summary-card-title { color: #5d6d7e; font-size: 0.85rem; margin-bottom: 0.25rem; }
.summary-card-value { font-size: 1.25rem; font-weight: 700; }
.summary-card-detail { color: #5d6d7e; font-size: 0.85rem; margin-top: 0.25rem; }
.compaction-flow { border: 1px solid #fed7aa; border-radius: 0.75rem; padding: 1rem; margin: 1rem 0; background: #fffaf5; }
.compaction-flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.75rem; }
.compaction-flow-card { border: 1px solid #fbd38d; border-radius: 0.6rem; padding: 0.75rem; background: #fff; }
.compaction-flow-card h4 { margin: 0 0 0.4rem 0; }
.hidden { display: none; }
</style>
<script>
function agentLensFilterLog() {
  const query = (document.getElementById('agent-lens-log-search')?.value || '').toLowerCase();
  const active = new Set([...document.querySelectorAll('[data-filter-category].active')].map((button) => button.getAttribute('data-filter-category')));
  for (const row of document.querySelectorAll('[data-log-row]')) {
    const category = row.getAttribute('data-category');
    const search = (row.getAttribute('data-search') || '').toLowerCase();
    const categoryMatch = active.size === 0 || active.has(category);
    const searchMatch = query.length === 0 || search.includes(query);
    row.classList.toggle('hidden', !(categoryMatch && searchMatch));
  }
}
function agentLensToggleCategory(button) {
  button.classList.toggle('active');
  agentLensFilterLog();
}
function agentLensSetDetails(open) {
  for (const details of document.querySelectorAll('[data-log-row] details')) details.open = open;
}
</script>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${renderLiveNotice(options.refreshSeconds)}${renderSourceMetadata(options)}<p>${records.length} trace records.</p>
${renderCounts(eventCounts)}
${renderSummaryCards(summarizeTraceForReport(records))}
${renderCompactionExplorer(buildCompactionExplorer(records))}
${renderTimeline(records)}
${renderRecordSection("Context snapshots", contextRecords)}
${renderRecordSection("Provider payloads", providerRecords)}
${renderRecordSection("Compaction", compactionRecords)}
</body>
</html>
`;
}

export async function writeHtmlReportForTrace(traceFile: string, options: HtmlReportOptions = {}): Promise<string> {
	const records = await readTraceRecords(traceFile);
	const reportFile = traceFile.replace(/\.jsonl$/u, ".html");
	const html = renderHtmlReport(records, {
		...options,
		sourceTraceFile: options.sourceTraceFile ?? traceFile,
		generatedAt: options.generatedAt ?? new Date().toISOString(),
	});
	await writeFile(reportFile, html, "utf8");
	if (options.writeLatestAlias) {
		await writeFile(join(dirname(traceFile), "latest.html"), html, "utf8");
	}
	return reportFile;
}

async function readTraceRecords(traceFile: string): Promise<AgentLensTraceRecord[]> {
	const text = await readFile(traceFile, "utf8");
	return text
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as AgentLensTraceRecord);
}

function countEvents(records: readonly AgentLensTraceRecord[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const record of records) {
		counts.set(record.event, (counts.get(record.event) ?? 0) + 1);
	}
	return counts;
}

function renderRefreshMeta(refreshSeconds: number | undefined): string {
	return refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">\n` : "";
}

function renderLiveNotice(refreshSeconds: number | undefined): string {
	return refreshSeconds ? `<p><strong>Live report refreshes every ${refreshSeconds} seconds.</strong></p>` : "";
}

function renderSourceMetadata(options: HtmlReportOptions): string {
	const rows: string[] = [];
	if (options.sourceTraceFile) rows.push(`<dt>Source trace</dt><dd><code>${escapeHtml(options.sourceTraceFile)}</code></dd>`);
	if (options.generatedAt) rows.push(`<dt>Generated at</dt><dd>${escapeHtml(options.generatedAt)}</dd>`);
	return rows.length > 0 ? `<section><h2>Report metadata</h2><dl>${rows.join("\n")}</dl></section>` : "";
}

function renderCounts(counts: Map<string, number>): string {
	const badges = [...counts.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([event, count]) => `<span class="badge">${escapeHtml(event)}: ${count}</span>`)
		.join("\n");
	return `<section><h2>Event counts</h2>\n${badges}</section>`;
}

function renderSummaryCards(summary: ReportTraceSummary): string {
	const cards = [
		renderSummaryCard("Total records", String(summary.totalRecords), `${summary.runCount} runs · ${summary.turnCount} turns`),
		renderSummaryCard("Provider requests", String(summary.providerRequestCount), summary.models.length > 0 ? summary.models.join(", ") : "No models observed"),
		renderSummaryCard("Context", summary.lastContextMessages !== undefined ? `${summary.lastContextMessages} messages` : "No snapshots", summary.maxContextMessages !== undefined ? `max ${summary.maxContextMessages} messages` : ""),
		renderSummaryCard("Tools", summary.toolNames.length > 0 ? summary.toolNames.join(", ") : "No tools observed", "tool names only"),
		renderSummaryCard("Compactions", String(summary.compactionCount), summary.maxCompactionTokensBefore !== undefined ? `${summary.maxCompactionTokensBefore} tokens` : "No compaction tokens"),
		renderSummaryCard("Time range", summary.firstTimestamp ?? "No records", summary.lastTimestamp ? `last ${summary.lastTimestamp}` : ""),
	];
	return `<section><h2>Trace summary</h2><div class="summary-card-grid">${cards.join("\n")}</div></section>`;
}

function renderSummaryCard(title: string, value: string, detail: string): string {
	return `<div class="summary-card"><div class="summary-card-title">${escapeHtml(title)}</div><div class="summary-card-value">${escapeHtml(value)}</div><div class="summary-card-detail">${escapeHtml(detail)}</div></div>`;
}

function renderCompactionExplorer(explorer: CompactionExplorer): string {
	const body = explorer.groups.length === 0
		? "<p>No compaction records found.</p>"
		: explorer.groups.map(renderCompactionGroup).join("\n");
	return `<section><h2>Session and compaction explorer</h2>${body}</section>`;
}

function renderCompactionGroup(group: CompactionExplorerGroup): string {
	const title = group.runIndex !== undefined ? `Compaction timeline — run ${group.runIndex}` : "Compaction timeline";
	const preparation = group.preparation
		? `<div class="compaction-flow-card"><h4>Preparation</h4><p>${escapeHtml(formatParts([
			group.preparation.tokensBefore !== undefined ? `${group.preparation.tokensBefore} tokens` : undefined,
			group.preparation.firstKeptEntryId ? `first kept ${group.preparation.firstKeptEntryId}` : undefined,
			group.preparation.messagesToSummarizeCount !== undefined ? `${group.preparation.messagesToSummarizeCount} messages to summarize` : undefined,
			group.preparation.turnPrefixMessageCount !== undefined ? `${group.preparation.turnPrefixMessageCount} turn-prefix messages` : undefined,
		]))}</p><p class="summary-card-detail">${escapeHtml(group.preparation.timestamp)}</p></div>`
		: `<div class="compaction-flow-card"><h4>Preparation</h4><p>No preparation record linked.</p></div>`;
	const result = group.result
		? `<div class="compaction-flow-card"><h4>Result</h4><p>${escapeHtml(formatParts([
			group.result.tokensBefore !== undefined ? `${group.result.tokensBefore} tokens` : undefined,
			group.result.firstKeptEntryId ? `first kept ${group.result.firstKeptEntryId}` : undefined,
			group.result.summaryLength !== undefined ? `summary length ${group.result.summaryLength}` : undefined,
			group.result.summarySha256 ? `summary hash ${group.result.summarySha256}` : undefined,
			group.result.detailKeys.length > 0 ? `detail keys ${group.result.detailKeys.join(", ")}` : undefined,
		]))}</p><p class="summary-card-detail">${escapeHtml(group.result.timestamp)}</p></div>`
		: `<div class="compaction-flow-card"><h4>Result</h4><p>No compaction result record linked.</p></div>`;
	return `<article class="compaction-flow"><h3>${escapeHtml(title)}</h3><div class="compaction-flow-grid">
${renderContextCard("Before context", group.contextBefore)}
${preparation}
${result}
${renderContextCard("After context", group.contextAfter)}
</div></article>`;
}

function renderContextCard(title: string, context: ContextSnapshotView | undefined): string {
	if (!context) return `<div class="compaction-flow-card"><h4>${escapeHtml(title)}</h4><p>No nearby context snapshot.</p></div>`;
	const roles = Object.entries(context.roleCounts).map(([role, count]) => `${role}:${count}`).join(", ");
	return `<div class="compaction-flow-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(formatParts([
		context.messageCount !== undefined ? `${context.messageCount} messages` : undefined,
		roles || undefined,
		context.hasCompactionSummary ? "has compaction summary" : undefined,
	]))}</p><p class="summary-card-detail">${escapeHtml(context.timestamp)}</p></div>`;
}

function formatParts(parts: Array<string | undefined>): string {
	const present = parts.filter((part): part is string => Boolean(part));
	return present.length > 0 ? present.join(" · ") : "No metadata.";
}

function renderTimeline(records: readonly AgentLensTraceRecord[]): string {
	const events = records.map((record, index) => classifyTraceRecord(record, index));
	return `<section><h2>Observable log</h2>
${renderLogControls(events)}
${events.map(renderLogRow).join("\n")}
</section>`;
}

function renderLogControls(events: readonly ObservableLogEvent[]): string {
	const categories = [...new Set(events.map((event) => event.category))].sort();
	const filters = categories
		.map((category) => `<button type="button" class="filter-chip" data-filter-category="${escapeHtml(category)}" onclick="agentLensToggleCategory(this)">${escapeHtml(category)}</button>`)
		.join("\n");
	return `<div class="observable-log-controls">
<label>Search <input id="agent-lens-log-search" type="search" placeholder="Filter visible metadata" oninput="agentLensFilterLog()"></label>
${filters}
<button type="button" class="filter-chip" onclick="agentLensSetDetails(true)">Expand all</button>
<button type="button" class="filter-chip" onclick="agentLensSetDetails(false)">Collapse all</button>
</div>`;
}

function renderLogRow(event: ObservableLogEvent): string {
	const chips = event.chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join("\n");
	const detailJson = JSON.stringify(event.record.data, null, 2);
	return `<article class="log-row" data-log-row data-category="${escapeHtml(event.category)}" data-event="${escapeHtml(event.event)}" data-search="${escapeHtml(event.searchText)}">
<div class="log-row-header"><span class="chip category ${escapeHtml(event.category)}">${escapeHtml(event.category)}</span><span class="log-row-title">${escapeHtml(event.label)}</span><span class="log-row-meta">${escapeHtml(formatLogMeta(event))}</span></div>
${chips ? `<div>${chips}</div>` : ""}
<p class="log-summary">${escapeHtml(event.summary)}</p>
<details><summary>Record details</summary><pre>${escapeHtml(detailJson)}</pre></details>
</article>`;
}

function formatLogMeta(event: ObservableLogEvent): string {
	const parts = [`#${event.index + 1}`];
	if (event.runIndex !== undefined) parts.push(`Run ${event.runIndex}`);
	if (event.turnIndex !== undefined) parts.push(`Turn ${event.turnIndex}`);
	parts.push(event.timestamp, event.event);
	return parts.join(" · ");
}

function renderRecordSection(title: string, records: readonly AgentLensTraceRecord[]): string {
	const body = records.length === 0
		? "<p>No records.</p>"
		: records
				.map((record) => `<h3>${escapeHtml(record.timestamp)} — ${escapeHtml(record.event)}</h3><pre>${escapeHtml(JSON.stringify(sanitizeReportValue(record.data), null, 2))}</pre>`)
				.join("\n");
	return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
