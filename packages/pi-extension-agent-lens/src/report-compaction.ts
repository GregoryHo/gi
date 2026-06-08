export interface TraceRecordLike {
	schemaVersion: number;
	timestamp: string;
	event: string;
	data: unknown;
}

export interface CompactionExplorer {
	groups: CompactionExplorerGroup[];
}

export interface CompactionExplorerGroup {
	runIndex?: number;
	preparation?: CompactionPreparationView;
	result?: CompactionResultView;
	contextBefore?: ContextSnapshotView;
	contextAfter?: ContextSnapshotView;
}

export interface CompactionPreparationView {
	timestamp: string;
	firstKeptEntryId?: string;
	tokensBefore?: number;
	branchEntryCount?: number;
	messagesToSummarizeCount?: number;
	turnPrefixMessageCount?: number;
}

export interface CompactionResultView {
	timestamp: string;
	id?: string;
	firstKeptEntryId?: string;
	tokensBefore?: number;
	summaryLength?: number;
	summarySha256?: string;
	detailKeys: string[];
}

export interface ContextSnapshotView {
	timestamp: string;
	messageCount?: number;
	roleCounts: Record<string, number>;
	hasCompactionSummary: boolean;
}

export function buildCompactionExplorer(records: readonly TraceRecordLike[]): CompactionExplorer {
	const groups: CompactionExplorerGroup[] = [];

	for (let index = 0; index < records.length; index += 1) {
		const record = records[index];
		if (record.event !== "session_compact") continue;
		const data = asObject(record.data);
		const runIndex = getNumber(data, "runIndex");
		const preparation = findPreparation(records, index, runIndex);
		groups.push({
			runIndex,
			preparation: preparation ? toPreparationView(preparation) : undefined,
			result: toResultView(record),
			contextBefore: findContextBefore(records, preparation?.index ?? index, runIndex),
			contextAfter: findContextAfter(records, index, runIndex),
		});
	}

	for (let index = 0; index < records.length; index += 1) {
		const record = records[index];
		if (record.event !== "session_before_compact") continue;
		const data = asObject(record.data);
		const runIndex = getNumber(data, "runIndex");
		const alreadyGrouped = groups.some((group) => group.preparation?.timestamp === record.timestamp);
		if (!alreadyGrouped) {
			groups.push({
				runIndex,
				preparation: toPreparationView({ record, index }),
				contextBefore: findContextBefore(records, index, runIndex),
				contextAfter: findContextAfter(records, index, runIndex),
			});
		}
	}

	groups.sort((a, b) => (a.preparation?.timestamp ?? a.result?.timestamp ?? "").localeCompare(b.preparation?.timestamp ?? b.result?.timestamp ?? ""));
	return { groups };
}

function findPreparation(records: readonly TraceRecordLike[], resultIndex: number, runIndex: number | undefined): { record: TraceRecordLike; index: number } | undefined {
	for (let index = resultIndex - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record.event !== "session_before_compact") continue;
		if (runIndex !== undefined && getNumber(asObject(record.data), "runIndex") !== runIndex) continue;
		return { record, index };
	}
	return undefined;
}

function findContextBefore(records: readonly TraceRecordLike[], beforeIndex: number, runIndex: number | undefined): ContextSnapshotView | undefined {
	for (let index = beforeIndex - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record.event !== "context") continue;
		if (runIndex !== undefined && getNumber(asObject(record.data), "runIndex") !== runIndex) continue;
		return toContextView(record);
	}
	return undefined;
}

function findContextAfter(records: readonly TraceRecordLike[], afterIndex: number, runIndex: number | undefined): ContextSnapshotView | undefined {
	for (let index = afterIndex + 1; index < records.length; index += 1) {
		const record = records[index];
		if (record.event !== "context") continue;
		if (runIndex !== undefined && getNumber(asObject(record.data), "runIndex") !== runIndex) continue;
		return toContextView(record);
	}
	return undefined;
}

function toPreparationView(item: { record: TraceRecordLike; index: number }): CompactionPreparationView {
	const data = asObject(item.record.data);
	const preparation = asObject(data.preparation);
	return {
		timestamp: item.record.timestamp,
		firstKeptEntryId: getString(preparation, "firstKeptEntryId"),
		tokensBefore: getNumber(preparation, "tokensBefore"),
		branchEntryCount: getNumber(data, "branchEntryCount"),
		messagesToSummarizeCount: getNumber(asObject(preparation.messagesToSummarize), "count"),
		turnPrefixMessageCount: getNumber(asObject(preparation.turnPrefixMessages), "count"),
	};
}

function toResultView(record: TraceRecordLike): CompactionResultView {
	const data = asObject(record.data);
	const compaction = asObject(data.compaction);
	const summary = asObject(compaction.summary);
	return {
		timestamp: record.timestamp,
		id: getString(compaction, "id"),
		firstKeptEntryId: getString(compaction, "firstKeptEntryId"),
		tokensBefore: getNumber(compaction, "tokensBefore"),
		summaryLength: getNumber(summary, "length"),
		summarySha256: getString(summary, "sha256"),
		detailKeys: getStringArray(compaction, "detailKeys"),
	};
}

function toContextView(record: TraceRecordLike): ContextSnapshotView {
	const data = asObject(record.data);
	const messages = asObject(data.messages);
	const roles = asObject(messages.roleCounts);
	const roleCounts: Record<string, number> = {};
	for (const [role, count] of Object.entries(roles)) {
		if (typeof count === "number") roleCounts[role] = count;
	}
	return {
		timestamp: record.timestamp,
		messageCount: getNumber(messages, "count"),
		roleCounts,
		hasCompactionSummary: messages.hasCompactionSummary === true,
	};
}

function asObject(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
