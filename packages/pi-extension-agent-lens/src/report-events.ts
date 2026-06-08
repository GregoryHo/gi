export interface TraceRecordLike {
	schemaVersion: number;
	timestamp: string;
	event: string;
	data: unknown;
}

export type ObservableLogCategory = "run" | "turn" | "context" | "provider" | "tool" | "compaction" | "report" | "cleanup" | "config" | "other";

export interface ObservableLogEvent {
	index: number;
	timestamp: string;
	event: string;
	category: ObservableLogCategory;
	label: string;
	chips: string[];
	runIndex?: number;
	turnIndex?: number;
	summary: string;
	searchText: string;
	record: TraceRecordLike;
}

export function classifyTraceRecord(record: TraceRecordLike, index: number): ObservableLogEvent {
	const sanitizedRecord = { ...record, data: sanitizeReportValue(record.data) };
	const data = isPlainObject(sanitizedRecord.data) ? sanitizedRecord.data : {};
	const runIndex = getNumber(data, "runIndex");
	const turnIndex = getNumber(data, "turnIndex");
	const base = createBase(sanitizedRecord, index, runIndex, turnIndex);

	switch (record.event) {
		case "before_agent_start":
			return withDetails(base, "run", "Agent start requested", runChips("start", runIndex), summarizeAgentStart(data));
		case "agent_start":
			return withDetails(base, "run", "Agent started", runChips("start", runIndex), runIndex ? `Run ${runIndex} started.` : "Agent run started.");
		case "agent_end":
			return withDetails(base, "run", "Agent ended", runChips("end", runIndex), summarizeAgentEnd(data));
		case "turn_start":
			return withDetails(base, "turn", "Turn started", turnChips("start", runIndex, turnIndex), turnIndex !== undefined ? `Turn ${turnIndex} started.` : "Turn started.");
		case "turn_end":
			return withDetails(base, "turn", "Turn ended", turnEndChips(data, runIndex, turnIndex), summarizeTurnEnd(data, turnIndex));
		case "context":
			return withDetails(base, "context", "Context snapshot", contextChips(data, runIndex), summarizeContext(data));
		case "before_provider_request":
			return withDetails(base, "provider", "Provider request", providerChips(data, runIndex), summarizeProvider(data));
		case "session_before_compact":
			return withDetails(base, "compaction", "Compaction prepared", compactionPreparationChips(data, runIndex), summarizeCompactionPreparation(data));
		case "session_compact":
			return withDetails(base, "compaction", "Compaction written", compactionChips(data, runIndex), summarizeCompaction(data));
		case "report_requested":
			return withDetails(base, "report", "Report requested", [], "HTML report requested.");
		default:
			return withDetails(base, "other", record.event, ["other", record.event], `${record.event} event.`);
	}
}

function createBase(record: TraceRecordLike, index: number, runIndex: number | undefined, turnIndex: number | undefined): Omit<ObservableLogEvent, "category" | "label" | "chips" | "summary"> {
	return {
		index,
		timestamp: record.timestamp,
		event: record.event,
		runIndex,
		turnIndex,
		searchText: `${record.timestamp} ${record.event} ${JSON.stringify(record.data)}`,
		record,
	};
}

function withDetails(
	base: Omit<ObservableLogEvent, "category" | "label" | "chips" | "summary">,
	category: ObservableLogCategory,
	label: string,
	chips: string[],
	summary: string,
): ObservableLogEvent {
	return { ...base, category, label, chips: unique(chips), summary };
}

function runChips(state: string, _runIndex: number | undefined): string[] {
	return chipList([state]);
}

function turnChips(state: string, _runIndex: number | undefined, _turnIndex: number | undefined): string[] {
	return chipList([state]);
}

function turnEndChips(data: Record<string, unknown>, runIndex: number | undefined, turnIndex: number | undefined): string[] {
	const toolNames = [...getNestedStringArray(data, ["assistant", "toolCallNames"]), ...getNestedStringArray(data, ["toolResults", "toolResultNames"])]
		.map((tool) => `tool:${tool}`);
	return chipList(["end", ...toolNames]);
}

function contextChips(data: Record<string, unknown>, runIndex: number | undefined): string[] {
	const messages = getPlainObject(data, "messages");
	const roleCounts = getPlainObject(messages, "roleCounts");
	const roles = Object.entries(roleCounts).filter(([, value]) => typeof value === "number").map(([role, count]) => `${role}:${count}`);
	return chipList([formatCountChip("messages", getNumber(messages, "count")), ...roles, ...getNestedStringArray(data, ["messages", "toolCallNames"]).map((tool) => `tool:${tool}`)]);
}

function providerChips(data: Record<string, unknown>, runIndex: number | undefined): string[] {
	const payload = getPlainObject(data, "payload");
	return chipList([
		getString(payload, "model") ? `model:${getString(payload, "model")}` : undefined,
		formatCountChip("tools", getNumber(payload, "toolCount")),
		formatCountChip("input", getNumber(payload, "inputCount")),
		formatCountChip("messages", getNumber(payload, "messageCount")),
	]);
}

function compactionPreparationChips(data: Record<string, unknown>, runIndex: number | undefined): string[] {
	const preparation = getPlainObject(data, "preparation");
	return chipList(["prepare", formatCountChip("tokens", getNumber(preparation, "tokensBefore"))]);
}

function compactionChips(data: Record<string, unknown>, runIndex: number | undefined): string[] {
	const compaction = getPlainObject(data, "compaction");
	const summary = getPlainObject(compaction, "summary");
	return chipList(["written", formatCountChip("tokens", getNumber(compaction, "tokensBefore")), formatCountChip("summary", getNumber(summary, "length"))]);
}

function chipList(chips: Array<string | undefined>): string[] {
	return unique(chips.filter((chip): chip is string => Boolean(chip)));
}

function summarizeAgentStart(data: Record<string, unknown>): string {
	const prompt = getPlainObject(data, "prompt");
	const systemPrompt = getPlainObject(data, "systemPrompt");
	const promptLength = getNumber(prompt, "length");
	const systemLength = getNumber(systemPrompt, "length");
	const parts = [promptLength !== undefined ? `prompt length ${promptLength}` : undefined, systemLength !== undefined ? `system prompt length ${systemLength}` : undefined].filter(Boolean);
	return parts.length > 0 ? `Agent start requested with ${parts.join(", ")}.` : "Agent start requested.";
}

function summarizeAgentEnd(data: Record<string, unknown>): string {
	const messages = getPlainObject(data, "messages");
	const count = getNumber(messages, "count");
	return count !== undefined ? `Agent ended with ${count} messages observed.` : "Agent ended.";
}

function summarizeTurnEnd(data: Record<string, unknown>, turnIndex: number | undefined): string {
	const assistantCount = getNestedNumber(data, ["assistant", "count"]);
	const toolResultCount = getNestedNumber(data, ["toolResults", "count"]);
	const prefix = turnIndex !== undefined ? `Turn ${turnIndex} ended` : "Turn ended";
	const parts = [assistantCount !== undefined ? `${assistantCount} assistant message` : undefined, toolResultCount !== undefined ? `${toolResultCount} tool result${toolResultCount === 1 ? "" : "s"}` : undefined].filter(Boolean);
	return parts.length > 0 ? `${prefix} with ${parts.join(" and ")}.` : `${prefix}.`;
}

function summarizeContext(data: Record<string, unknown>): string {
	const messages = getPlainObject(data, "messages");
	const count = getNumber(messages, "count");
	const contentChars = getNumber(messages, "contentChars");
	const hasCompactionSummary = messages.hasCompactionSummary === true;
	return `${count ?? 0} messages in context${contentChars !== undefined ? `, ${contentChars} content chars` : ""}${hasCompactionSummary ? ", includes compaction summary" : ""}.`;
}

function summarizeProvider(data: Record<string, unknown>): string {
	const payload = getPlainObject(data, "payload");
	const model = getString(payload, "model");
	const tools = getNumber(payload, "toolCount");
	const input = getNumber(payload, "inputCount") ?? getNumber(payload, "messageCount");
	const parts = [model ? `model ${model}` : undefined, input !== undefined ? `${input} inputs/messages` : undefined, tools !== undefined ? `${tools} tools` : undefined].filter(Boolean);
	return parts.length > 0 ? `Provider request with ${parts.join(", ")}.` : "Provider request summarized.";
}

function summarizeCompactionPreparation(data: Record<string, unknown>): string {
	const preparation = getPlainObject(data, "preparation");
	const tokens = getNumber(preparation, "tokensBefore");
	const firstKept = getString(preparation, "firstKeptEntryId");
	return `Compaction prepared${tokens !== undefined ? ` at ${tokens} tokens` : ""}${firstKept ? `, first kept entry ${firstKept}` : ""}.`;
}

function summarizeCompaction(data: Record<string, unknown>): string {
	const compaction = getPlainObject(data, "compaction");
	const tokens = getNumber(compaction, "tokensBefore");
	const firstKept = getString(compaction, "firstKeptEntryId");
	return `Compaction written${tokens !== undefined ? ` after ${tokens} tokens` : ""}${firstKept ? `, first kept entry ${firstKept}` : ""}.`;
}

function formatCountChip(name: string, count: number | undefined): string | undefined {
	return count !== undefined ? `${name}:${count}` : undefined;
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

export function sanitizeReportValue(value: unknown): unknown {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(sanitizeReportValue);
	if (!isPlainObject(value)) return value;
	const sanitized: Record<string, unknown> = {};
	for (const [key, nested] of Object.entries(value)) {
		if ((key === "text" || key === "content") && typeof nested === "string") {
			sanitized[key] = `[redacted ${key} field: ${nested.length} chars]`;
		} else {
			sanitized[key] = sanitizeReportValue(nested);
		}
	}
	return sanitized;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
