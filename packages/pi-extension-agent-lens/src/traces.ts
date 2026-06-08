import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

export interface TraceSummary {
	traceFile: string;
	recordCount: number;
	lastEvent?: string;
	lastTimestamp?: string;
	sizeBytes?: number;
	modifiedAt?: string;
}

export async function listTraceSummaries(artifactRoot: string): Promise<TraceSummary[]> {
	let names: string[];
	try {
		names = await readdir(artifactRoot);
	} catch {
		return [];
	}

	const traceFiles = names
		.filter((name) => name.endsWith(".jsonl"))
		.map((name) => join(artifactRoot, name));
	const summaries = await Promise.all(traceFiles.map((traceFile) => summarizeTraceFile(traceFile)));
	return summaries.sort((a, b) => (b.lastTimestamp ?? "").localeCompare(a.lastTimestamp ?? ""));
}

export interface FormatTraceListOptions {
	activeTraceFile?: string;
}

export function formatTraceList(summaries: TraceSummary[], options: FormatTraceListOptions = {}): string {
	if (summaries.length === 0) return "No Agent Lens traces found.";
	const lines = ["Agent Lens traces:"];
	for (const summary of summaries) {
		const marker = summary.traceFile === options.activeTraceFile ? "*" : "-";
		const parts = [
			basename(summary.traceFile),
			`${summary.recordCount} ${summary.recordCount === 1 ? "record" : "records"}`,
		];
		if (summary.sizeBytes !== undefined) parts.push(formatBytes(summary.sizeBytes));
		if (summary.lastEvent) parts.push(`last=${summary.lastEvent}`);
		if (summary.lastTimestamp) parts.push(summary.lastTimestamp);
		if (summary.modifiedAt) parts.push(`modified=${summary.modifiedAt}`);
		lines.push(`${marker} ${parts.join(" | ")}`);
	}
	if (options.activeTraceFile) lines.push("* = active trace");
	return lines.join("\n");
}

async function summarizeTraceFile(traceFile: string): Promise<TraceSummary> {
	const text = await readFile(traceFile, "utf8");
	const lines = text.split("\n").filter((line) => line.trim().length > 0);
	let lastEvent: string | undefined;
	let lastTimestamp: string | undefined;
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const record = JSON.parse(lines[i]) as { event?: unknown; timestamp?: unknown };
			lastEvent = typeof record.event === "string" ? record.event : undefined;
			lastTimestamp = typeof record.timestamp === "string" ? record.timestamp : undefined;
			break;
		} catch {
			// Ignore malformed lines and keep looking backward.
		}
	}
	const stats = await stat(traceFile);
	return { traceFile, recordCount: lines.length, lastEvent, lastTimestamp, sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() };
}

function formatBytes(bytes: number): string {
	return `${bytes} B`;
}
