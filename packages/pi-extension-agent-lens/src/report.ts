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

interface MemoryFlowRecordLink {
	flowNumber: number;
	role: string;
	roleLabel: string;
	confidence: string;
}

interface SummaryCardLink {
	href: string;
	label: string;
}

export function renderHtmlReport(records: readonly AgentLensTraceRecord[], options: HtmlReportOptions = {}): string {
	const title = options.title ?? "Agent Lens Report";
	const eventCounts = countEvents(records);
	const providerRecords = records.filter((record) => record.event === "before_provider_request");
	const compactionRecords = records.filter(
		(record) => record.event === "session_before_compact" || record.event === "session_compact",
	);
	const contextRecords = records.filter((record) => record.event === "context");
	const compactionExplorer = buildCompactionExplorer(records);
	const memoryFlowRecordLinks = buildMemoryFlowRecordLinks(compactionExplorer);

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${renderRefreshMeta(options.refreshSeconds)}<title>${escapeHtml(title)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.45; color: #17202a; }
section { margin: 2rem 0; }
.report-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; padding: 0.75rem; border: 1px solid #d5d8dc; border-radius: 0.6rem; background: #fbfcfc; }
.report-nav a { color: #1f618d; text-decoration: none; }
.report-nav a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #d5d8dc; padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; }
th { background: #f4f6f7; }
pre { background: #f8f9f9; border: 1px solid #d5d8dc; padding: 0.75rem; overflow: auto; }
.badge, .chip { display: inline-block; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 999px; padding: 0.1rem 0.5rem; margin: 0.1rem; font-size: 0.85rem; }
.observable-log-controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 1rem 0; }
.observable-log-controls input { min-width: 18rem; padding: 0.35rem 0.5rem; }
.filter-chip { border: 1px solid #bfc9ca; border-radius: 999px; background: #fff; padding: 0.25rem 0.6rem; cursor: pointer; }
.filter-chip.active { background: #17202a; color: #fff; }
.density-controls { display: inline-flex; gap: 0.35rem; align-items: center; }
.log-count { color: #5d6d7e; font-size: 0.9rem; }
.log-row { border: 1px solid #d5d8dc; border-radius: 0.6rem; padding: 0.75rem; margin: 0.75rem 0; }
body.density-compact .log-row { padding: 0.45rem; margin: 0.45rem 0; }
body.density-compact .log-summary { margin: 0.25rem 0; }
body.density-compact .compaction-flow { padding: 0.65rem; }
body.density-compact .compaction-flow-card { padding: 0.5rem; }
.log-row.memory-related { border-left-width: 0.35rem; }
.log-row.memory-role-before-context { border-left-color: #60a5fa; }
.log-row.memory-role-preparation, .log-row.memory-role-result { border-left-color: #fb923c; }
.log-row.memory-role-after-context, .log-row.memory-role-provider-after { border-left-color: #2dd4bf; }
.log-row.memory-confidence-inferred { border-style: dashed; }
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
.chip.memory-link { background: #fff7ed; border-color: #fed7aa; }
.chip.memory-role-label { background: #f8fafc; border-color: #cbd5e1; }
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
  let visible = 0;
  for (const row of document.querySelectorAll('[data-log-row]')) {
    const category = row.getAttribute('data-category');
    const search = (row.getAttribute('data-search') || '').toLowerCase();
    const categoryMatch = active.size === 0 || active.has(category);
    const searchMatch = query.length === 0 || search.includes(query);
    const matches = categoryMatch && searchMatch;
    row.classList.toggle('hidden', !matches);
    if (matches) visible += 1;
  }
  const count = document.getElementById('visible-log-count');
  if (count) count.textContent = String(visible) + ' visible';
}
function agentLensToggleCategory(button) {
  button.classList.toggle('active');
  agentLensFilterLog();
}
function agentLensSetDetails(open) {
  for (const details of document.querySelectorAll('[data-log-row] details')) details.open = open;
}
function agentLensSetDensity(density) {
  document.body.classList.toggle('density-compact', density === 'compact');
}
</script>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${renderReportNav()}
${renderLiveNotice(options.refreshSeconds)}${renderSourceMetadata(options)}<p>${records.length} trace records.</p>
${renderCounts(eventCounts)}
${renderSummaryCards(summarizeTraceForReport(records), compactionExplorer.groups.length > 0)}
${renderCompactionExplorer(compactionExplorer)}
${renderTimeline(records, memoryFlowRecordLinks)}
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

function renderReportNav(): string {
	return `<nav class="report-nav" aria-label="Report sections"><a href="#event-counts">Event counts</a><a href="#trace-summary">Trace summary</a><a href="#memory-flow-explorer">Memory flow</a><a href="#observable-log">Observable log</a><a href="#context-snapshots">Context snapshots</a><a href="#provider-payloads">Provider payloads</a><a href="#compaction">Compaction</a></nav>`;
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
	return `<section id="event-counts"><h2>Event counts</h2>\n${badges}</section>`;
}

function renderSummaryCards(summary: ReportTraceSummary, hasMemoryFlows: boolean): string {
	const compactionDetail = summary.maxCompactionTokensBefore !== undefined ? `${summary.maxCompactionTokensBefore} tokens` : "No compaction tokens";
	const cards = [
		renderSummaryCard("Total records", String(summary.totalRecords), `${summary.runCount} runs · ${summary.turnCount} turns`),
		renderSummaryCard("Provider requests", String(summary.providerRequestCount), summary.models.length > 0 ? summary.models.join(", ") : "No models observed"),
		renderSummaryCard("Context", summary.lastContextMessages !== undefined ? `${summary.lastContextMessages} messages` : "No snapshots", summary.maxContextMessages !== undefined ? `max ${summary.maxContextMessages} messages` : ""),
		renderSummaryCard("Tools", summary.toolNames.length > 0 ? summary.toolNames.join(", ") : "No tools observed", "tool names only"),
		renderSummaryCard("Compactions", String(summary.compactionCount), compactionDetail, hasMemoryFlows ? { href: "#memory-flow-1", label: "View memory flow" } : undefined),
		renderSummaryCard("Time range", summary.firstTimestamp ?? "No records", summary.lastTimestamp ? `last ${summary.lastTimestamp}` : ""),
	];
	return `<section id="trace-summary"><h2>Trace summary</h2><div class="summary-card-grid">${cards.join("\n")}</div></section>`;
}

function renderSummaryCard(title: string, value: string, detail: string, link?: SummaryCardLink): string {
	const linkHtml = link ? ` <a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>` : "";
	return `<div class="summary-card"><div class="summary-card-title">${escapeHtml(title)}</div><div class="summary-card-value">${escapeHtml(value)}</div><div class="summary-card-detail">${escapeHtml(detail)}${linkHtml}</div></div>`;
}

function renderCompactionExplorer(explorer: CompactionExplorer): string {
	const body = explorer.groups.length === 0
		? "<p>No compaction records found.</p>"
		: explorer.groups.map((group, index) => renderCompactionGroup(group, index + 1)).join("\n");
	return `<section id="memory-flow-explorer"><h2>Memory flow explorer</h2><p class="summary-card-detail">Partial metadata-only view. Relationships are labeled as observed, nearby observed, inferred, or missing; inferred links are based on event order and are not full session reconstruction.</p>${body}</section>`;
}

function renderCompactionGroup(group: CompactionExplorerGroup, flowNumber: number): string {
	const title = group.runIndex !== undefined ? `Memory flow #${flowNumber} — Compaction timeline — run ${group.runIndex}` : `Memory flow #${flowNumber} — Compaction timeline`;
	const preparation = group.preparation
		? `<div id="memory-flow-${flowNumber}-preparation" class="compaction-flow-card"><h4>What became summary metadata — Preparation</h4><p>${escapeHtml(formatParts([
			group.preparation.tokensBefore !== undefined ? `${group.preparation.tokensBefore} tokens` : undefined,
			group.preparation.firstKeptEntryId ? `first kept ${group.preparation.firstKeptEntryId}` : undefined,
			group.preparation.messagesToSummarizeCount !== undefined ? `${group.preparation.messagesToSummarizeCount} messages to summarize` : undefined,
			group.preparation.turnPrefixMessageCount !== undefined ? `${group.preparation.turnPrefixMessageCount} turn-prefix messages` : undefined,
		]))}</p>${renderSegmentMeta(group.preparation.timestamp, group.preparation.confidence, group.preparation.recordIndex)}</div>`
		: `<div id="memory-flow-${flowNumber}-preparation" class="compaction-flow-card"><h4>What became summary metadata — Preparation</h4><p>Missing: no preparation record linked.</p><p class="summary-card-detail">Missing</p></div>`;
	const result = group.result
		? `<div id="memory-flow-${flowNumber}-result" class="compaction-flow-card"><h4>Compaction result</h4><p>${escapeHtml(formatParts([
			group.result.tokensBefore !== undefined ? `${group.result.tokensBefore} tokens` : undefined,
			group.result.firstKeptEntryId ? `first kept ${group.result.firstKeptEntryId}` : undefined,
			group.result.summaryLength !== undefined ? `summary length ${group.result.summaryLength}` : undefined,
			group.result.summarySha256 ? `summary hash ${group.result.summarySha256}` : undefined,
			group.result.detailKeys.length > 0 ? `detail keys ${group.result.detailKeys.join(", ")}` : undefined,
		]))}</p>${renderSegmentMeta(group.result.timestamp, group.result.confidence, group.result.recordIndex)}</div>`
		: `<div id="memory-flow-${flowNumber}-result" class="compaction-flow-card"><h4>Result</h4><p>Missing: no compaction result record linked.</p><p class="summary-card-detail">Missing</p></div>`;
	return `<article id="memory-flow-${flowNumber}" class="compaction-flow"><h3>${escapeHtml(title)}</h3><div class="compaction-flow-grid">
${renderContextCard("Before context", group.contextBefore, `memory-flow-${flowNumber}-before-context`)}
${preparation}
${result}
${renderContextCard("After context", group.contextAfter, `memory-flow-${flowNumber}-after-context`)}
${renderProviderAfterCard(group.providerAfter, `memory-flow-${flowNumber}-provider-after`)}
</div></article>`;
}

function renderContextCard(title: string, context: ContextSnapshotView | undefined, id: string): string {
	if (!context) return `<div id="${escapeHtml(id)}" class="compaction-flow-card"><h4>${escapeHtml(formatContextCardTitle(title))}</h4><p>Missing: no nearby context snapshot.</p><p class="summary-card-detail">Missing</p></div>`;
	const roles = Object.entries(context.roleCounts).map(([role, count]) => `${role}:${count}`).join(", ");
	return `<div id="${escapeHtml(id)}" class="compaction-flow-card"><h4>${escapeHtml(formatContextCardTitle(title))}</h4><p>${escapeHtml(formatParts([
		context.messageCount !== undefined ? `${context.messageCount} messages` : undefined,
		roles || undefined,
		context.hasCompactionSummary ? "has compaction summary" : undefined,
	]))}</p>${renderSegmentMeta(context.timestamp, context.confidence, context.recordIndex)}</div>`;
}

function formatContextCardTitle(title: string): string {
	return title === "After context" ? "What stayed recent — After context" : title;
}

function renderProviderAfterCard(provider: CompactionExplorerGroup["providerAfter"], id: string): string {
	if (!provider) return `<div id="${escapeHtml(id)}" class="compaction-flow-card"><h4>What the next observed provider request likely saw</h4><p>Missing: no later provider request observed.</p><p class="summary-card-detail">Missing</p></div>`;
	const roles = Object.entries(provider.roleCounts).map(([role, count]) => `${role}:${count}`).join(", ");
	return `<div id="${escapeHtml(id)}" class="compaction-flow-card"><h4>What the next observed provider request likely saw</h4><p>${escapeHtml(formatParts([
		provider.model ? `model ${provider.model}` : undefined,
		provider.inputCount !== undefined ? `${provider.inputCount} inputs` : undefined,
		provider.messageCount !== undefined ? `${provider.messageCount} messages` : undefined,
		roles || undefined,
		provider.toolCount !== undefined ? `${provider.toolCount} tools` : undefined,
		provider.instructionsLength !== undefined ? `${provider.instructionsLength} instruction chars` : undefined,
	]))}</p>${renderSegmentMeta(provider.timestamp, provider.confidence, provider.recordIndex)}</div>`;
}

function renderSegmentMeta(timestamp: string, confidence: string, recordIndex: number): string {
	const recordNumber = recordIndex + 1;
	return `<p class="summary-card-detail">${escapeHtml(confidence)} · ${escapeHtml(timestamp)} · <a href="#record-${recordNumber}">View record #${recordNumber}</a></p>`;
}

function formatParts(parts: Array<string | undefined>): string {
	const present = parts.filter((part): part is string => Boolean(part));
	return present.length > 0 ? present.join(" · ") : "No metadata.";
}

function buildMemoryFlowRecordLinks(explorer: CompactionExplorer): Map<number, MemoryFlowRecordLink[]> {
	const links = new Map<number, MemoryFlowRecordLink[]>();
	for (const [index, group] of explorer.groups.entries()) {
		const flowNumber = index + 1;
		addMemoryFlowRecordLink(links, group.contextBefore, flowNumber, "before-context", "nearest context before");
		addMemoryFlowRecordLink(links, group.preparation, flowNumber, "preparation", "compaction preparation");
		addMemoryFlowRecordLink(links, group.result, flowNumber, "result", "compaction result");
		addMemoryFlowRecordLink(links, group.contextAfter, flowNumber, "after-context", "nearest context after");
		addMemoryFlowRecordLink(links, group.providerAfter, flowNumber, "provider-after", "next observed provider request");
	}
	return links;
}

function addMemoryFlowRecordLink(
	links: Map<number, MemoryFlowRecordLink[]>,
	segment: { recordIndex: number; confidence: string } | undefined,
	flowNumber: number,
	role: string,
	roleLabel: string,
): void {
	if (!segment) return;
	const existing = links.get(segment.recordIndex) ?? [];
	existing.push({ flowNumber, role, roleLabel, confidence: segment.confidence });
	links.set(segment.recordIndex, existing);
}

function renderTimeline(records: readonly AgentLensTraceRecord[], memoryFlowRecordLinks: Map<number, MemoryFlowRecordLink[]>): string {
	const events = records.map((record, index) => classifyTraceRecord(record, index));
	return `<section id="observable-log" data-total-log-rows="${events.length}"><h2>Observable log</h2>
${renderLogControls(events)}
${events.map((event) => renderLogRow(event, memoryFlowRecordLinks.get(event.index) ?? [])).join("\n")}
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
<span class="density-controls"><span>Density</span><button id="density-comfortable" type="button" class="filter-chip" onclick="agentLensSetDensity('comfortable')">Comfortable</button><button id="density-compact" type="button" class="filter-chip" onclick="agentLensSetDensity('compact')">Compact</button></span>
<span id="visible-log-count" class="log-count">${events.length} visible</span>
</div>`;
}

function renderLogRow(event: ObservableLogEvent, memoryLinks: readonly MemoryFlowRecordLink[]): string {
	const chips = event.chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join("\n");
	const memoryChips = memoryLinks.map((link) => `<a class="chip memory-link" href="#memory-flow-${link.flowNumber}">Memory flow #${link.flowNumber}</a> <span class="chip memory-role-label">${escapeHtml(link.roleLabel)} · ${escapeHtml(link.confidence)}</span>`).join("\n");
	const chipBlock = [chips, memoryChips].filter((block) => block.length > 0).join("\n");
	const primaryMemoryLink = memoryLinks[0];
	const memoryClass = primaryMemoryLink ? ` memory-related memory-role-${primaryMemoryLink.role} memory-confidence-${slugClass(primaryMemoryLink.confidence)}` : "";
	const memoryAttributes = primaryMemoryLink ? ` data-memory-flow="${primaryMemoryLink.flowNumber}" data-memory-role="${escapeHtml(primaryMemoryLink.role)}"` : "";
	const detailJson = JSON.stringify(event.record.data, null, 2);
	return `<article id="record-${event.index + 1}" class="log-row${memoryClass}" data-log-row data-category="${escapeHtml(event.category)}" data-event="${escapeHtml(event.event)}" data-search="${escapeHtml(event.searchText)}"${memoryAttributes}>
<div class="log-row-header"><span class="chip category ${escapeHtml(event.category)}">${escapeHtml(event.category)}</span><span class="log-row-title">${escapeHtml(event.label)}</span><span class="log-row-meta">${escapeHtml(formatLogMeta(event))}</span></div>
${chipBlock ? `<div>${chipBlock}</div>` : ""}
<p class="log-summary">${escapeHtml(event.summary)}</p>
<details><summary>Record details</summary><pre>${escapeHtml(detailJson)}</pre></details>
</article>`;
}

function slugClass(value: string): string {
	return value.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-").replaceAll(/^-|-$/gu, "");
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
	return `<section id="${escapeHtml(sectionId(title))}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function sectionId(title: string): string {
	return title.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-").replaceAll(/^-|-$/gu, "");
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
