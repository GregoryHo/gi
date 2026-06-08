import { access, unlink } from "node:fs/promises";
import { basename } from "node:path";
import type { AgentLensRetentionConfig } from "./config.ts";
import { listTraceSummaries } from "./traces.ts";

export interface CleanupPlanOptions {
	artifactRoot: string;
	activeTraceFile: string;
	retention: AgentLensRetentionConfig;
	now?: Date;
}

export interface CleanupPlan {
	deleteFiles: string[];
	protectedFiles: string[];
	reasons: Map<string, string>;
}

export async function planCleanup(options: CleanupPlanOptions): Promise<CleanupPlan> {
	const now = options.now ?? new Date();
	const summaries = await listTraceSummaries(options.artifactRoot);
	const activeReportFile = toReportFile(options.activeTraceFile);
	const protectedFiles = [options.activeTraceFile, activeReportFile];
	const selected = new Map<string, string>();

	if (options.retention.maxTraceFiles !== null && summaries.length > options.retention.maxTraceFiles) {
		const overflow = summaries.slice(options.retention.maxTraceFiles);
		for (const summary of overflow) {
			selected.set(summary.traceFile, `exceeds maxTraceFiles=${options.retention.maxTraceFiles}`);
		}
	}

	if (options.retention.maxAgeDays !== null) {
		const cutoff = now.getTime() - options.retention.maxAgeDays * 24 * 60 * 60 * 1000;
		for (const summary of summaries) {
			const timestamp = summary.lastTimestamp ?? summary.modifiedAt;
			if (timestamp && Date.parse(timestamp) < cutoff) {
				selected.set(summary.traceFile, `older than maxAgeDays=${options.retention.maxAgeDays}`);
			}
		}
	}

	const deleteFiles: string[] = [];
	const reasons = new Map<string, string>();
	for (const [traceFile, reason] of selected) {
		if (protectedFiles.includes(traceFile)) continue;
		deleteFiles.push(traceFile);
		reasons.set(traceFile, reason);
		const reportFile = toReportFile(traceFile);
		if (!protectedFiles.includes(reportFile) && await exists(reportFile)) {
			deleteFiles.push(reportFile);
			reasons.set(reportFile, `report for ${basename(traceFile)}`);
		}
	}

	return { deleteFiles, protectedFiles, reasons };
}

export async function executeCleanupPlan(plan: CleanupPlan): Promise<void> {
	for (const file of plan.deleteFiles) {
		if (plan.protectedFiles.includes(file)) continue;
		await unlink(file);
	}
}

export function formatCleanupPlan(plan: CleanupPlan): string {
	if (plan.deleteFiles.length === 0) return "Agent Lens cleanup: nothing to delete.";
	const lines = [`Would delete ${plan.deleteFiles.length} ${plan.deleteFiles.length === 1 ? "file" : "files"}:`];
	for (const file of plan.deleteFiles) {
		const reason = plan.reasons.get(file);
		lines.push(`- ${file}${reason ? ` (${reason})` : ""}`);
	}
	return lines.join("\n");
}

function toReportFile(traceFile: string): string {
	return traceFile.replace(/\.jsonl$/u, ".html");
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}
