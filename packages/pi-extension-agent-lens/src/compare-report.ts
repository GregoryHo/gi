import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { summarizeTraceForReport, type ReportTraceSummary, type TraceRecordLike } from "./report-summary.ts";
import { listTraceSummaries } from "./traces.ts";

export interface TraceComparisonItem {
	traceFile: string;
	reportFile?: string;
	sizeBytes?: number;
	modifiedAt?: string;
	summary: ReportTraceSummary;
}

export interface TraceComparisonReportOptions {
	artifactRoot: string;
	generatedAt?: string;
}

export interface WriteTraceComparisonReportOptions {
	artifactRoot: string;
	generatedAt?: string;
}

export function renderTraceComparisonReport(items: readonly TraceComparisonItem[], options: TraceComparisonReportOptions): string {
	const generatedAt = options.generatedAt ?? new Date().toISOString();
	const rows = items.map((item) => renderComparisonRow(item, options.artifactRoot)).join("\n");
	const body = rows.length > 0 ? rows : `<tr><td colspan="13">No traces found.</td></tr>`;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Agent Lens Trace Comparison</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.45; color: #17202a; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #d5d8dc; padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; }
th { background: #f4f6f7; }
.notice { padding: 0.75rem; border: 1px solid #c7d2fe; border-radius: 0.6rem; background: #eef2ff; }
</style>
</head>
<body>
<h1>Agent Lens Trace Comparison</h1>
<p>Generated at ${escapeHtml(generatedAt)}.</p>
<p>Artifact root: <code>${escapeHtml(options.artifactRoot)}</code></p>
<p class="notice">Metadata-only comparison. No raw prompt, provider payload, tool output, or compaction summary content is rendered. No correctness or quality judgment is implied.</p>
<table><thead><tr><th>Trace</th><th>Report</th><th>Records</th><th>Runs</th><th>Turns</th><th>Provider requests</th><th>Models</th><th>Context</th><th>Tools</th><th>Compactions</th><th>Max compaction tokens</th><th>Size</th><th>Modified</th></tr></thead><tbody>
${body}
</tbody></table>
</body>
</html>
`;
}

export async function writeTraceComparisonReport(options: WriteTraceComparisonReportOptions): Promise<string> {
	const summaries = await listTraceSummaries(options.artifactRoot);
	const reportFiles = await listReportFiles(options.artifactRoot);
	const items = await Promise.all(summaries.map(async (summary): Promise<TraceComparisonItem> => {
		const records = await readTraceRecords(summary.traceFile);
		const reportFile = summary.traceFile.replace(/\.jsonl$/u, ".html");
		return {
			traceFile: summary.traceFile,
			reportFile: reportFiles.has(reportFile) ? reportFile : undefined,
			sizeBytes: summary.sizeBytes,
			modifiedAt: summary.modifiedAt,
			summary: summarizeTraceForReport(records),
		};
	}));
	const compareFile = join(options.artifactRoot, "compare.html");
	await writeFile(compareFile, renderTraceComparisonReport(items, options), "utf8");
	return compareFile;
}

async function listReportFiles(artifactRoot: string): Promise<Set<string>> {
	let names: string[];
	try {
		names = await readdir(artifactRoot);
	} catch {
		return new Set();
	}
	return new Set(names.filter((name) => name.endsWith(".html") && name !== "index.html" && name !== "compare.html").map((name) => join(artifactRoot, name)));
}

async function readTraceRecords(traceFile: string): Promise<TraceRecordLike[]> {
	const text = await readFile(traceFile, "utf8");
	return text
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.flatMap((line) => {
			try {
				return [JSON.parse(line) as TraceRecordLike];
			} catch {
				return [];
			}
		});
}

function renderComparisonRow(item: TraceComparisonItem, artifactRoot: string): string {
	const summary = item.summary;
	const reportCell = item.reportFile
		? `<a href="${escapeHtml(relative(artifactRoot, item.reportFile))}">${escapeHtml(basename(item.reportFile))}</a>`
		: "missing";
	return `<tr><td>${escapeHtml(basename(item.traceFile))}</td><td>${reportCell}</td><td>${summary.totalRecords}</td><td>${summary.runCount}</td><td>${summary.turnCount}</td><td>${summary.providerRequestCount}</td><td>${escapeHtml(formatList(summary.models))}</td><td>${escapeHtml(formatContext(summary))}</td><td>${escapeHtml(formatList(summary.toolNames))}</td><td>${summary.compactionCount}</td><td>${escapeHtml(formatOptionalNumber(summary.maxCompactionTokensBefore))}</td><td>${escapeHtml(formatOptionalNumber(item.sizeBytes))}</td><td>${escapeHtml(item.modifiedAt ?? "missing")}</td></tr>`;
}

function formatContext(summary: ReportTraceSummary): string {
	const parts = [
		summary.lastContextMessages !== undefined ? `last ${summary.lastContextMessages}` : undefined,
		summary.maxContextMessages !== undefined ? `max ${summary.maxContextMessages}` : undefined,
	];
	const present = parts.filter((part): part is string => part !== undefined);
	return present.length > 0 ? present.join(" · ") : "missing";
}

function formatList(values: readonly string[]): string {
	return values.length > 0 ? values.join(", ") : "missing";
}

function formatOptionalNumber(value: number | undefined): string {
	return value === undefined ? "missing" : String(value);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
