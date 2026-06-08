import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface TraceRecord {
	schemaVersion: 1;
	timestamp: string;
	event: string;
	data: unknown;
}

export interface TraceRecorder {
	traceFile: string;
	lastError?: string;
	record(event: string, data: unknown): Promise<void>;
}

export interface CreateTraceRecorderOptions {
	cwd?: string;
	artifactRoot?: string;
	now?: () => Date;
}

export function getDefaultArtifactRoot(cwd: string): string {
	return join(cwd, ".pi-agent-lens");
}

function formatTraceTimestamp(date: Date): string {
	return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

export function createTraceRecorder(options: CreateTraceRecorderOptions = {}): TraceRecorder {
	const cwd = options.cwd ?? process.cwd();
	const now = options.now ?? (() => new Date());
	const artifactRoot = options.artifactRoot ?? getDefaultArtifactRoot(cwd);
	const traceFile = join(artifactRoot, `agent-lens-${formatTraceTimestamp(now())}.jsonl`);
	const recorder: TraceRecorder = {
		traceFile,
		async record(event, data) {
			const record: TraceRecord = {
				schemaVersion: 1,
				timestamp: now().toISOString(),
				event,
				data,
			};
			try {
				mkdirSync(artifactRoot, { recursive: true });
				appendFileSync(traceFile, `${JSON.stringify(record)}\n`, "utf8");
				recorder.lastError = undefined;
			} catch (error) {
				recorder.lastError = error instanceof Error ? error.message : String(error);
			}
		},
	};
	return recorder;
}
