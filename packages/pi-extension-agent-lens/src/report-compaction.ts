export interface TraceRecordLike {
	schemaVersion: number;
	timestamp: string;
	event: string;
	data: unknown;
}

export type MemoryFlowConfidence = "observed" | "nearby observed" | "inferred" | "missing";

export interface CompactionExplorer {
	groups: CompactionExplorerGroup[];
}

export interface CompactionExplorerGroup {
	runIndex?: number;
	preparation?: CompactionPreparationView;
	result?: CompactionResultView;
	contextBefore?: ContextSnapshotView;
	contextAfter?: ContextSnapshotView;
	providerAfter?: ProviderRequestView;
}

export interface CompactionPreparationView {
	recordIndex: number;
	confidence: MemoryFlowConfidence;
	timestamp: string;
	firstKeptEntryId?: string;
	tokensBefore?: number;
	branchEntryCount?: number;
	messagesToSummarizeCount?: number;
	turnPrefixMessageCount?: number;
}

export interface CompactionResultView {
	recordIndex: number;
	confidence: MemoryFlowConfidence;
	timestamp: string;
	id?: string;
	firstKeptEntryId?: string;
	tokensBefore?: number;
	summaryLength?: number;
	summarySha256?: string;
	detailKeys: string[];
}

export interface ContextSnapshotView {
	recordIndex: number;
	confidence: MemoryFlowConfidence;
	timestamp: string;
	messageCount?: number;
	roleCounts: Record<string, number>;
	hasCompactionSummary: boolean;
}

export interface ProviderRequestView {
	recordIndex: number;
	confidence: MemoryFlowConfidence;
	timestamp: string;
	model?: string;
	inputCount?: number;
	messageCount?: number;
	toolCount?: number;
	instructionsLength?: number;
	roleCounts: Record<string, number>;
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
			result: toResultView(record, index),
			contextBefore: findContextBefore(records, preparation?.index ?? index, runIndex),
			contextAfter: findContextAfter(records, index, runIndex),
			providerAfter: findProviderAfter(records, index, runIndex),
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
				providerAfter: findProviderAfter(records, index, runIndex),
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
		return toContextView(record, index);
	}
	return undefined;
}

function findContextAfter(records: readonly TraceRecordLike[], afterIndex: number, runIndex: number | undefined): ContextSnapshotView | undefined {
	for (let index = afterIndex + 1; index < records.length; index += 1) {
		const record = records[index];
		if (record.event !== "context") continue;
		if (runIndex !== undefined && getNumber(asObject(record.data), "runIndex") !== runIndex) continue;
		return toContextView(record, index);
	}
	return undefined;
}

function findProviderAfter(records: readonly TraceRecordLike[], afterIndex: number, runIndex: number | undefined): ProviderRequestView | undefined {
	for (let index = afterIndex + 1; index < records.length; index += 1) {
		const record = records[index];
		if (record.event !== "before_provider_request") continue;
		if (runIndex !== undefined && getNumber(asObject(record.data), "runIndex") !== runIndex) continue;
		return toProviderView(record, index);
	}
	return undefined;
}

function toPreparationView(item: { record: TraceRecordLike; index: number }): CompactionPreparationView {
	const data = asObject(item.record.data);
	const preparation = asObject(data.preparation);
	return {
		recordIndex: item.index,
		confidence: "observed",
		timestamp: item.record.timestamp,
		firstKeptEntryId: getString(preparation, "firstKeptEntryId"),
		tokensBefore: getNumber(preparation, "tokensBefore"),
		branchEntryCount: getNumber(data, "branchEntryCount"),
		messagesToSummarizeCount: getNumber(asObject(preparation.messagesToSummarize), "count"),
		turnPrefixMessageCount: getNumber(asObject(preparation.turnPrefixMessages), "count"),
	};
}

function toResultView(record: TraceRecordLike, recordIndex: number): CompactionResultView {
	const data = asObject(record.data);
	const compaction = asObject(data.compaction);
	const summary = asObject(compaction.summary);
	return {
		recordIndex,
		confidence: "observed",
		timestamp: record.timestamp,
		id: getString(compaction, "id"),
		firstKeptEntryId: getString(compaction, "firstKeptEntryId"),
		tokensBefore: getNumber(compaction, "tokensBefore"),
		summaryLength: getNumber(summary, "length"),
		summarySha256: getString(summary, "sha256"),
		detailKeys: getStringArray(compaction, "detailKeys"),
	};
}

function toContextView(record: TraceRecordLike, recordIndex: number): ContextSnapshotView {
	const data = asObject(record.data);
	const messages = asObject(data.messages);
	return {
		recordIndex,
		confidence: "nearby observed",
		timestamp: record.timestamp,
		messageCount: getNumber(messages, "count"),
		roleCounts: getNumberMap(asObject(messages.roleCounts)),
		hasCompactionSummary: messages.hasCompactionSummary === true,
	};
}

function toProviderView(record: TraceRecordLike, recordIndex: number): ProviderRequestView {
	const data = asObject(record.data);
	const payload = asObject(data.payload);
	return {
		recordIndex,
		confidence: "inferred",
		timestamp: record.timestamp,
		model: getString(payload, "model"),
		inputCount: getNumber(payload, "inputCount"),
		messageCount: getNumber(payload, "messageCount"),
		toolCount: getNumber(payload, "toolCount"),
		instructionsLength: getNumber(payload, "instructionsLength"),
		roleCounts: getNumberMap(asObject(payload.inputRoles)),
	};
}

function getNumberMap(value: Record<string, unknown>): Record<string, number> {
	const numbers: Record<string, number> = {};
	for (const [key, nested] of Object.entries(value)) {
		if (typeof nested === "number") numbers[key] = nested;
	}
	return numbers;
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
