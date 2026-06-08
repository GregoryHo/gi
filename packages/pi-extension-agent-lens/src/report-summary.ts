export interface TraceRecordLike {
	schemaVersion: number;
	timestamp: string;
	event: string;
	data: unknown;
}

export interface ReportTraceSummary {
	totalRecords: number;
	runCount: number;
	turnCount: number;
	providerRequestCount: number;
	models: string[];
	maxContextMessages?: number;
	lastContextMessages?: number;
	contextRoleCounts: Record<string, number>;
	toolNames: string[];
	compactionCount: number;
	maxCompactionTokensBefore?: number;
	firstTimestamp?: string;
	lastTimestamp?: string;
}

export function summarizeTraceForReport(records: readonly TraceRecordLike[]): ReportTraceSummary {
	const runIndexes = new Set<number>();
	const turnKeys = new Set<string>();
	const models = new Set<string>();
	const toolNames = new Set<string>();
	const contextRoleCounts: Record<string, number> = {};
	let providerRequestCount = 0;
	let maxContextMessages: number | undefined;
	let lastContextMessages: number | undefined;
	let compactionCount = 0;
	let maxCompactionTokensBefore: number | undefined;

	for (const record of records) {
		const data = isPlainObject(record.data) ? record.data : {};
		const runIndex = getNumber(data, "runIndex");
		if (runIndex !== undefined && (record.event === "before_agent_start" || record.event === "agent_start" || record.event === "agent_end")) {
			runIndexes.add(runIndex);
		}
		if (record.event === "turn_start" || record.event === "turn_end") {
			const turnIndex = getNumber(data, "turnIndex");
			if (runIndex !== undefined && turnIndex !== undefined) turnKeys.add(`${runIndex}:${turnIndex}`);
		}
		if (record.event === "before_provider_request") {
			providerRequestCount += 1;
			const payload = getPlainObject(data, "payload");
			const model = getString(payload, "model");
			if (model) models.add(model);
		}
		if (record.event === "context") {
			const messages = getPlainObject(data, "messages");
			const count = getNumber(messages, "count");
			if (count !== undefined) {
				lastContextMessages = count;
				maxContextMessages = maxContextMessages === undefined ? count : Math.max(maxContextMessages, count);
			}
			const roles = getPlainObject(messages, "roleCounts");
			for (const [role, countValue] of Object.entries(roles)) {
				if (typeof countValue === "number") contextRoleCounts[role] = countValue;
			}
			for (const tool of getStringArray(messages, "toolCallNames")) toolNames.add(tool);
			for (const tool of getStringArray(messages, "toolResultNames")) toolNames.add(tool);
		}
		if (record.event === "turn_end") {
			for (const tool of getNestedStringArray(data, ["assistant", "toolCallNames"])) toolNames.add(tool);
			for (const tool of getNestedStringArray(data, ["toolResults", "toolResultNames"])) toolNames.add(tool);
		}
		if (record.event === "session_before_compact" || record.event === "session_compact") {
			compactionCount += 1;
			const tokens = record.event === "session_compact"
				? getNestedNumber(data, ["compaction", "tokensBefore"])
				: getNestedNumber(data, ["preparation", "tokensBefore"]);
			if (tokens !== undefined) maxCompactionTokensBefore = maxCompactionTokensBefore === undefined ? tokens : Math.max(maxCompactionTokensBefore, tokens);
		}
	}

	return {
		totalRecords: records.length,
		runCount: runIndexes.size,
		turnCount: turnKeys.size,
		providerRequestCount,
		models: [...models].sort(),
		maxContextMessages,
		lastContextMessages,
		contextRoleCounts,
		toolNames: [...toolNames].sort(),
		compactionCount,
		maxCompactionTokensBefore,
		firstTimestamp: records[0]?.timestamp,
		lastTimestamp: records.at(-1)?.timestamp,
	};
}

function getNestedNumber(value: Record<string, unknown>, path: string[]): number | undefined {
	let current: unknown = value;
	for (const segment of path) {
		if (!isPlainObject(current)) return undefined;
		current = current[segment];
	}
	return typeof current === "number" ? current : undefined;
}

function getNestedStringArray(value: Record<string, unknown>, path: string[]): string[] {
	let current: unknown = value;
	for (const segment of path) {
		if (!isPlainObject(current)) return [];
		current = current[segment];
	}
	return Array.isArray(current) ? current.filter((item): item is string => typeof item === "string") : [];
}

function getPlainObject(value: Record<string, unknown>, key: string): Record<string, unknown> {
	const nested = value[key];
	return isPlainObject(nested) ? nested : {};
}

function getNumber(value: Record<string, unknown>, key: string): number | undefined {
	return typeof value[key] === "number" ? value[key] : undefined;
}

function getString(value: Record<string, unknown>, key: string): string | undefined {
	return typeof value[key] === "string" ? value[key] : undefined;
}

function getStringArray(value: Record<string, unknown>, key: string): string[] {
	const nested = value[key];
	return Array.isArray(nested) ? nested.filter((item): item is string => typeof item === "string") : [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
