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
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #d5d8dc; padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; }
th { background: #f4f6f7; }
.badge { display: inline-block; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 999px; padding: 0.1rem 0.5rem; }
</style>
</head>
<body>
<h1>Agent Lens Index</h1>
<p>Generated at ${escapeHtml(generatedAt)}.</p>
<p>Artifact root: <code>${escapeHtml(options.artifactRoot)}</code></p>
<table><thead><tr><th>Status</th><th>Trace</th><th>Records</th><th>Size</th><th>Last event</th><th>Last timestamp</th><th>Modified</th><th>Report</th></tr></thead><tbody>
${rows}
</tbody></table>
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

function renderTraceRow(summary: TraceSummary, artifactRoot: string, activeTraceFile: string | undefined, reportFiles: Set<string>): string {
	const reportFile = summary.traceFile.replace(/\.jsonl$/u, ".html");
	const reportCell = reportFiles.has(reportFile)
		? `<a href="${escapeHtml(relative(artifactRoot, reportFile))}">${escapeHtml(basename(reportFile))}</a>`
		: "No report";
	return `<tr><td>${summary.traceFile === activeTraceFile ? '<span class="badge">active</span>' : ""}</td><td>${escapeHtml(basename(summary.traceFile))}</td><td>${summary.recordCount}</td><td>${summary.sizeBytes ?? ""} B</td><td>${escapeHtml(summary.lastEvent ?? "")}</td><td>${escapeHtml(summary.lastTimestamp ?? "")}</td><td>${escapeHtml(summary.modifiedAt ?? "")}</td><td>${reportCell}</td></tr>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
