import { readdir, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { listTraceSummaries, type TraceSummary } from "./traces.ts";

export interface IndexReportOptions {
	artifactRoot: string;
	activeTraceFile?: string;
	reportFiles?: Set<string>;
	generatedAt?: string;
}

export interface WriteIndexReportOptions {
	artifactRoot: string;
	activeTraceFile?: string;
	generatedAt?: string;
}

export function renderIndexReport(summaries: readonly TraceSummary[], options: IndexReportOptions): string {
	const generatedAt = options.generatedAt ?? new Date().toISOString();
	const reportFiles = options.reportFiles ?? new Set<string>();
	const rows = summaries.map((summary) => renderTraceRow(summary, options.artifactRoot, options.activeTraceFile, reportFiles)).join("\n");
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Agent Lens Index</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.45; color: #17202a; }
.controls { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: end; padding: 0.75rem; border: 1px solid #d5d8dc; border-radius: 0.5rem; background: #fbfcfc; }
.controls label { display: grid; gap: 0.2rem; font-size: 0.9rem; }
.controls input, .controls select { font: inherit; padding: 0.25rem 0.35rem; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #d5d8dc; padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; }
th { background: #f4f6f7; }
.badge { display: inline-block; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 999px; padding: 0.1rem 0.5rem; }
.empty-message { display: none; padding: 0.75rem; border: 1px solid #f5c2c7; border-radius: 0.5rem; background: #fff5f5; color: #842029; }
</style>
</head>
<body>
<h1>Agent Lens Index</h1>
<p>Generated at ${escapeHtml(generatedAt)}.</p>
<p>Artifact root: <code>${escapeHtml(options.artifactRoot)}</code></p>
${renderControls(summaries)}
<p id="empty-trace-message" class="empty-message">No traces match the current index filters.</p>
<table><thead><tr><th>Status</th><th>Trace</th><th>Records</th><th>Size</th><th>Last event</th><th>Last timestamp</th><th>Modified</th><th>Report</th></tr></thead><tbody id="trace-rows">
${rows}
</tbody></table>
<script>
(() => {
	const rows = Array.from(document.querySelectorAll('[data-trace-row]'));
	const search = document.getElementById('trace-search');
	const activeFilter = document.getElementById('active-filter');
	const eventFilter = document.getElementById('event-filter');
	const reportFilter = document.getElementById('report-filter');
	const sortSelect = document.getElementById('sort-traces');
	const tbody = document.getElementById('trace-rows');
	const emptyMessage = document.getElementById('empty-trace-message');
	function numberValue(row, name) {
		const value = Number(row.dataset[name] || '0');
		return Number.isFinite(value) ? value : 0;
	}
	function textValue(row, name) {
		return row.dataset[name] || '';
	}
	function compareRows(a, b) {
		switch (sortSelect.value) {
			case 'modified-asc': return textValue(a, 'modified').localeCompare(textValue(b, 'modified'));
			case 'records-desc': return numberValue(b, 'records') - numberValue(a, 'records');
			case 'records-asc': return numberValue(a, 'records') - numberValue(b, 'records');
			case 'size-desc': return numberValue(b, 'size') - numberValue(a, 'size');
			case 'size-asc': return numberValue(a, 'size') - numberValue(b, 'size');
			case 'event-asc': return textValue(a, 'event').localeCompare(textValue(b, 'event'));
			case 'active-first': return textValue(b, 'active').localeCompare(textValue(a, 'active'));
			case 'modified-desc':
			default: return textValue(b, 'modified').localeCompare(textValue(a, 'modified'));
		}
	}
	function rowMatches(row) {
		const query = search.value.trim().toLowerCase();
		if (query && !textValue(row, 'traceSearch').includes(query)) return false;
		if (activeFilter.value === 'active' && row.dataset.active !== 'true') return false;
		if (activeFilter.value === 'inactive' && row.dataset.active === 'true') return false;
		if (eventFilter.value !== 'all' && row.dataset.event !== eventFilter.value) return false;
		if (reportFilter.value !== 'all' && row.dataset.report !== reportFilter.value) return false;
		return true;
	}
	function applyControls() {
		let visible = 0;
		for (const row of rows.sort(compareRows)) {
			const matches = rowMatches(row);
			row.hidden = !matches;
			if (matches) visible += 1;
			tbody.appendChild(row);
		}
		emptyMessage.style.display = visible === 0 ? 'block' : 'none';
	}
	for (const control of [search, activeFilter, eventFilter, reportFilter, sortSelect]) {
		control.addEventListener('input', applyControls);
		control.addEventListener('change', applyControls);
	}
	applyControls();
})();
</script>
</body>
</html>
`;
}

export async function writeIndexReport(options: WriteIndexReportOptions): Promise<string> {
	const summaries = await listTraceSummaries(options.artifactRoot);
	const reportFiles = await listReportFiles(options.artifactRoot);
	const indexFile = join(options.artifactRoot, "index.html");
	await writeFile(indexFile, renderIndexReport(summaries, { ...options, reportFiles }), "utf8");
	return indexFile;
}

async function listReportFiles(artifactRoot: string): Promise<Set<string>> {
	let names: string[];
	try {
		names = await readdir(artifactRoot);
	} catch {
		return new Set();
	}
	return new Set(names.filter((name) => name.endsWith(".html") && name !== "index.html").map((name) => join(artifactRoot, name)));
}

function renderControls(summaries: readonly TraceSummary[]): string {
	const eventOptions = [...new Set(summaries.map((summary) => summary.lastEvent).filter((event): event is string => event !== undefined))]
		.sort((a, b) => a.localeCompare(b))
		.map((event) => `<option value="${escapeHtml(event)}">${escapeHtml(event)}</option>`)
		.join("\n");
	return `<form class="controls" onsubmit="return false">
<label>Search trace path/name <input id="trace-search" type="search" placeholder="agent-lens..."></label>
<label>Active <select id="active-filter"><option value="all">All traces</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></label>
<label>Last event <select id="event-filter"><option value="all">All events</option>${eventOptions}</select></label>
<label>Report <select id="report-filter"><option value="all">All reports</option><option value="available">Report available</option><option value="missing">Report missing</option></select></label>
<label>Sort <select id="sort-traces"><option value="modified-desc">Modified newest</option><option value="modified-asc">Modified oldest</option><option value="records-desc">Records high to low</option><option value="records-asc">Records low to high</option><option value="size-desc">Size high to low</option><option value="size-asc">Size low to high</option><option value="event-asc">Last event A-Z</option><option value="active-first">Active first</option></select></label>
</form>`;
}

function renderTraceRow(summary: TraceSummary, artifactRoot: string, activeTraceFile: string | undefined, reportFiles: Set<string>): string {
	const reportFile = summary.traceFile.replace(/\.jsonl$/u, ".html");
	const hasReport = reportFiles.has(reportFile);
	const reportCell = hasReport
		? `<a href="${escapeHtml(relative(artifactRoot, reportFile))}">${escapeHtml(basename(reportFile))}</a>`
		: "No report";
	const active = summary.traceFile === activeTraceFile;
	const lastEvent = summary.lastEvent ?? "missing";
	const lastTimestamp = summary.lastTimestamp ?? "missing";
	const modifiedAt = summary.modifiedAt ?? "missing";
	const size = summary.sizeBytes === undefined ? "missing" : `${summary.sizeBytes} B`;
	const traceSearch = `${basename(summary.traceFile)} ${summary.traceFile} ${lastEvent}`.toLowerCase();
	return `<tr data-trace-row data-active="${active ? "true" : "false"}" data-report="${hasReport ? "available" : "missing"}" data-event="${escapeHtml(lastEvent)}" data-modified="${escapeHtml(summary.modifiedAt ?? "")}" data-records="${summary.recordCount}" data-size="${summary.sizeBytes ?? 0}" data-trace-search="${escapeHtml(traceSearch)}"><td>${active ? '<span class="badge">active</span>' : ""}</td><td>${escapeHtml(basename(summary.traceFile))}</td><td>${summary.recordCount}</td><td>${escapeHtml(size)}</td><td>${escapeHtml(lastEvent)}</td><td>${escapeHtml(lastTimestamp)}</td><td>${escapeHtml(modifiedAt)}</td><td>${reportCell}</td></tr>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
