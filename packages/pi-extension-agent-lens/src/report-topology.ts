export interface TraceRecordLike {
	schemaVersion: number;
	timestamp: string;
	event: string;
	data: unknown;
}

export type TopologyConfidence = "observed" | "nearby observed" | "inferred" | "missing";
export type TopologyLane = "trace" | "main-agent" | "worker-agent" | "tools" | "provider" | "memory" | "unknown";
export type TopologyNodeKind = "trace" | "run" | "turn" | "provider-request" | "tool-activity" | "context-snapshot" | "compaction" | "memory-event" | "unknown";
export type TopologyRelationshipKind = "contains" | "precedes" | "follows" | "triggered-by" | "summarizes" | "retains-after" | "next-provider-after" | "parent-child-agent" | "branch-lineage";

export interface TopologyNode {
	id: string;
	kind: TopologyNodeKind;
	lane: TopologyLane;
	label: string;
	recordIndex?: number;
	timestamp?: string;
	runIndex?: number;
	turnIndex?: number;
	metadata: Record<string, string | number | boolean>;
}

export interface TopologyRelationship {
	from: string;
	to: string;
	kind: TopologyRelationshipKind;
	confidence: TopologyConfidence;
	label: string;
	recordIndex?: number;
}

export interface TopologyGaps {
	workerMetadata: "observed" | "missing";
	sessionBranchTopology: "observed" | "partial" | "missing";
}

export interface TopologyModel {
	nodes: TopologyNode[];
	relationships: TopologyRelationship[];
	gaps: TopologyGaps;
}

export function buildTopologyModel(records: readonly TraceRecordLike[]): TopologyModel {
	const nodes: TopologyNode[] = [{ id: "trace", kind: "trace", lane: "trace", label: "Trace", metadata: { records: records.length } }];
	const relationships: TopologyRelationship[] = [];
	const seenRuns = new Set<number>();
	const seenTurns = new Set<string>();
	let hasWorkerMetadata = false;
	let hasBranchBoundaryMetadata = false;

	for (const [index, record] of records.entries()) {
		const data = asObject(record.data);
		const runIndex = getNumber(data, "runIndex");
		const turnIndex = getNumber(data, "turnIndex");
		if (hasAgentMetadata(data)) hasWorkerMetadata = true;

		if (runIndex !== undefined && !seenRuns.has(runIndex)) {
			const runId = toRunId(runIndex);
			nodes.push({ id: runId, kind: "run", lane: "main-agent", label: `Run ${runIndex}`, runIndex, metadata: { runIndex } });
			relationships.push({ from: "trace", to: runId, kind: "contains", confidence: "observed", label: "trace contains run" });
			seenRuns.add(runIndex);
		}

		if (runIndex !== undefined && turnIndex !== undefined) {
			const turnKey = `${runIndex}:${turnIndex}`;
			if (!seenTurns.has(turnKey)) {
				const turnId = toTurnId(runIndex, turnIndex);
				nodes.push({ id: turnId, kind: "turn", lane: "main-agent", label: `Run ${runIndex} turn ${turnIndex}`, runIndex, turnIndex, metadata: { runIndex, turnIndex } });
				relationships.push({ from: toRunId(runIndex), to: turnId, kind: "contains", confidence: "observed", label: "run contains turn", recordIndex: index });
				seenTurns.add(turnKey);
			}
		}

		if (record.event === "context") {
			const node = toContextNode(record, index, runIndex);
			nodes.push(node);
			addRunRelationship(relationships, runIndex, node.id, "contains", "nearby observed", "run has context snapshot", index);
			const toolNames = readToolNames(data);
			if (toolNames.length > 0) addToolNode(nodes, relationships, record, index, runIndex, turnIndex, toolNames, "context references tool metadata");
		}

		if (record.event === "before_provider_request") {
			const node = toProviderNode(record, index, runIndex);
			nodes.push(node);
			addRunRelationship(relationships, runIndex, node.id, "triggered-by", "inferred", "provider request inferred from run event order", index);
		}

		if (record.event === "turn_end") {
			const toolNames = readTurnToolNames(data);
			if (toolNames.length > 0) addToolNode(nodes, relationships, record, index, runIndex, turnIndex, toolNames, "turn includes tool activity metadata");
		}

		if (record.event === "session_before_compact") {
			const node = toPreparationNode(record, index, runIndex);
			nodes.push(node);
			addRunRelationship(relationships, runIndex, node.id, "contains", "observed", "run contains compaction preparation", index);
			const preparation = asObject(data.preparation);
			if (getString(preparation, "firstKeptEntryId") || getNumber(data, "branchEntryCount") !== undefined) hasBranchBoundaryMetadata = true;
		}

		if (record.event === "session_compact") {
			const node = toCompactionNode(record, index, runIndex);
			nodes.push(node);
			addRunRelationship(relationships, runIndex, node.id, "contains", "observed", "run contains compaction result", index);
			const previousPreparation = findPreviousPreparation(records, index, runIndex);
			if (previousPreparation) {
				relationships.push({ from: `memory-preparation-${previousPreparation.index + 1}`, to: node.id, kind: "summarizes", confidence: "observed", label: "compaction result follows preparation metadata", recordIndex: index });
			}
			const compaction = asObject(data.compaction);
			if (getString(compaction, "firstKeptEntryId")) {
				hasBranchBoundaryMetadata = true;
				relationships.push({ from: node.id, to: "session-branch-boundary", kind: "retains-after", confidence: "observed", label: "first kept entry boundary observed", recordIndex: index });
			}
		}
	}

	if (!hasWorkerMetadata) {
		relationships.push({ from: "trace", to: "worker-agent-unavailable", kind: "parent-child-agent", confidence: "missing", label: "worker/agent parent-child metadata unavailable" });
	}
	if (!hasBranchBoundaryMetadata) {
		relationships.push({ from: "trace", to: "branch-lineage-unavailable", kind: "branch-lineage", confidence: "missing", label: "session branch lineage metadata unavailable" });
	} else {
		relationships.push({ from: "trace", to: "branch-lineage-partial", kind: "branch-lineage", confidence: "missing", label: "only branch boundary metadata is available; full lineage is unavailable" });
	}

	return {
		nodes,
		relationships,
		gaps: {
			workerMetadata: hasWorkerMetadata ? "observed" : "missing",
			sessionBranchTopology: hasBranchBoundaryMetadata ? "partial" : "missing",
		},
	};
}

function toContextNode(record: TraceRecordLike, recordIndex: number, runIndex: number | undefined): TopologyNode {
	const messages = asObject(asObject(record.data).messages);
	return {
		id: `context-${recordIndex + 1}`,
		kind: "context-snapshot",
		lane: "main-agent",
		label: "Context snapshot",
		recordIndex,
		timestamp: record.timestamp,
		runIndex,
		metadata: compactMetadata({ messageCount: getNumber(messages, "count"), hasCompactionSummary: messages.hasCompactionSummary === true }),
	};
}

function toProviderNode(record: TraceRecordLike, recordIndex: number, runIndex: number | undefined): TopologyNode {
	const payload = asObject(asObject(record.data).payload);
	return {
		id: `provider-${recordIndex + 1}`,
		kind: "provider-request",
		lane: "provider",
		label: getString(payload, "model") ? `Provider request · ${getString(payload, "model")}` : "Provider request",
		recordIndex,
		timestamp: record.timestamp,
		runIndex,
		metadata: compactMetadata({ model: getString(payload, "model"), inputCount: getNumber(payload, "inputCount"), messageCount: getNumber(payload, "messageCount"), toolCount: getNumber(payload, "toolCount") }),
	};
}

function toPreparationNode(record: TraceRecordLike, recordIndex: number, runIndex: number | undefined): TopologyNode {
	const data = asObject(record.data);
	const preparation = asObject(data.preparation);
	return {
		id: `memory-preparation-${recordIndex + 1}`,
		kind: "memory-event",
		lane: "memory",
		label: "Compaction preparation",
		recordIndex,
		timestamp: record.timestamp,
		runIndex,
		metadata: compactMetadata({ tokensBefore: getNumber(preparation, "tokensBefore"), firstKeptEntryId: getString(preparation, "firstKeptEntryId"), branchEntryCount: getNumber(data, "branchEntryCount") }),
	};
}

function toCompactionNode(record: TraceRecordLike, recordIndex: number, runIndex: number | undefined): TopologyNode {
	const compaction = asObject(asObject(record.data).compaction);
	const summary = asObject(compaction.summary);
	return {
		id: `compaction-${recordIndex + 1}`,
		kind: "compaction",
		lane: "memory",
		label: "Compaction result",
		recordIndex,
		timestamp: record.timestamp,
		runIndex,
		metadata: compactMetadata({ tokensBefore: getNumber(compaction, "tokensBefore"), firstKeptEntryId: getString(compaction, "firstKeptEntryId"), summaryLength: getNumber(summary, "length"), summarySha256: getString(summary, "sha256") }),
	};
}

function addToolNode(nodes: TopologyNode[], relationships: TopologyRelationship[], record: TraceRecordLike, recordIndex: number, runIndex: number | undefined, turnIndex: number | undefined, toolNames: string[], label: string): void {
	const nodeId = `tool-${recordIndex + 1}`;
	nodes.push({
		id: nodeId,
		kind: "tool-activity",
		lane: "tools",
		label: `Tools: ${toolNames.join(", ")}`,
		recordIndex,
		timestamp: record.timestamp,
		runIndex,
		turnIndex,
		metadata: { toolNames: toolNames.join(", "), toolCount: toolNames.length },
	});
	const parent = runIndex !== undefined && turnIndex !== undefined ? toTurnId(runIndex, turnIndex) : runIndex !== undefined ? toRunId(runIndex) : "trace";
	relationships.push({ from: parent, to: nodeId, kind: "triggered-by", confidence: "nearby observed", label, recordIndex });
}

function addRunRelationship(relationships: TopologyRelationship[], runIndex: number | undefined, to: string, kind: TopologyRelationshipKind, confidence: TopologyConfidence, label: string, recordIndex: number): void {
	relationships.push({ from: runIndex === undefined ? "trace" : toRunId(runIndex), to, kind, confidence, label, recordIndex });
}

function findPreviousPreparation(records: readonly TraceRecordLike[], beforeIndex: number, runIndex: number | undefined): { index: number } | undefined {
	for (let index = beforeIndex - 1; index >= 0; index -= 1) {
		const record = records[index];
		if (record.event !== "session_before_compact") continue;
		if (runIndex !== undefined && getNumber(asObject(record.data), "runIndex") !== runIndex) continue;
		return { index };
	}
	return undefined;
}

function readToolNames(data: Record<string, unknown>): string[] {
	const messages = asObject(data.messages);
	return unique([...getStringArray(messages, "toolCallNames"), ...getStringArray(messages, "toolResultNames")]);
}

function readTurnToolNames(data: Record<string, unknown>): string[] {
	return unique([
		...getStringArray(asObject(data.assistant), "toolCallNames"),
		...getStringArray(asObject(data.toolResults), "toolResultNames"),
	]);
}

function hasAgentMetadata(data: Record<string, unknown>): boolean {
	return getString(data, "agentId") !== undefined || getString(data, "workerId") !== undefined || getString(data, "parentRunId") !== undefined;
}

function toRunId(runIndex: number): string {
	return `run-${runIndex}`;
}

function toTurnId(runIndex: number, turnIndex: number): string {
	return `turn-${runIndex}-${turnIndex}`;
}

function compactMetadata(values: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> {
	const metadata: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined) metadata[key] = value;
	}
	return metadata;
}

function unique(values: string[]): string[] {
	return [...new Set(values)].sort();
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
