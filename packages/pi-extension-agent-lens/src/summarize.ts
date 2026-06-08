import type { BuildSystemPromptOptions } from "@earendil-works/pi-coding-agent";
import { contentFingerprint, safeJsonSize, type ContentFingerprint } from "./redact.ts";

export interface LensMessage {
	role: string;
	content?: unknown;
}

export interface TextFingerprint extends ContentFingerprint {
	preview?: never;
}

export interface BeforeAgentStartSummary {
	prompt: TextFingerprint;
	imageCount: number;
	systemPrompt: TextFingerprint;
	systemPromptOptions: {
		selectedTools: string[];
		selectedToolCount: number;
		contextFileCount: number;
		skillCount: number;
		skillNames: string[];
		promptGuidelineCount: number;
		appendSystemPromptLength: number;
		customPromptLength: number;
	};
}

export interface MessagesSummary {
	count: number;
	roleCounts: Record<string, number>;
	contentChars: number;
	hasCompactionSummary: boolean;
	toolCallNames: string[];
	toolResultNames: string[];
}

export interface ProviderPayloadSummary {
	kind: string;
	jsonChars?: number;
	topLevelKeys: string[];
	model?: string;
	messageCount?: number;
	messageRoles?: Record<string, number>;
	inputCount?: number;
	inputRoles?: Record<string, number>;
	inputJsonChars?: number;
	toolCount?: number;
	systemLength?: number;
	instructionsLength?: number;
}

export interface CompactionPreparationSummary {
	firstKeptEntryId: string;
	isSplitTurn: boolean;
	tokensBefore: number;
	previousSummary?: TextFingerprint;
	messagesToSummarize: MessagesSummary;
	turnPrefixMessages: MessagesSummary;
	fileOps: {
		readCount: number;
		editedCount: number;
	};
	settings: {
		enabled: boolean;
		reserveTokens: number;
		keepRecentTokens: number;
	};
}

export function summarizeBeforeAgentStart(event: {
	prompt: string;
	images?: unknown[];
	systemPrompt: string;
	systemPromptOptions: BuildSystemPromptOptions;
}): BeforeAgentStartSummary {
	const options = event.systemPromptOptions;
	const selectedTools = options.selectedTools ?? [];
	const skills = options.skills ?? [];
	return {
		prompt: contentFingerprint(event.prompt)!,
		imageCount: event.images?.length ?? 0,
		systemPrompt: contentFingerprint(event.systemPrompt)!,
		systemPromptOptions: {
			selectedTools: [...selectedTools],
			selectedToolCount: selectedTools.length,
			contextFileCount: options.contextFiles?.length ?? 0,
			skillCount: skills.length,
			skillNames: skills.map((skill) => skill.name),
			promptGuidelineCount: options.promptGuidelines?.length ?? 0,
			appendSystemPromptLength: options.appendSystemPrompt?.length ?? 0,
			customPromptLength: options.customPrompt?.length ?? 0,
		},
	};
}

export function summarizeMessages(messages: LensMessage[]): MessagesSummary {
	const roleCounts: Record<string, number> = {};
	const toolCallNames = new Set<string>();
	const toolResultNames = new Set<string>();
	let contentChars = 0;
	let hasCompactionSummary = false;

	for (const message of messages) {
		roleCounts[message.role] = (roleCounts[message.role] ?? 0) + 1;
		if (message.role === "compactionSummary") hasCompactionSummary = true;
		contentChars += getMessageContentChars(message);

		if (message.role === "assistant" && Array.isArray(message.content)) {
			for (const block of message.content) {
				if (isPlainObject(block) && block.type === "toolCall" && typeof block.name === "string") {
					toolCallNames.add(block.name);
				}
			}
		}
		const toolName = getStringProp(message, "toolName");
		if (message.role === "toolResult" && toolName) {
			toolResultNames.add(toolName);
		}
	}

	return {
		count: messages.length,
		roleCounts,
		contentChars,
		hasCompactionSummary,
		toolCallNames: [...toolCallNames].sort(),
		toolResultNames: [...toolResultNames].sort(),
	};
}

export function summarizeProviderPayload(payload: unknown): ProviderPayloadSummary {
	const topLevelKeys = isPlainObject(payload) ? Object.keys(payload).sort() : [];
	const summary: ProviderPayloadSummary = {
		kind: Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload,
		jsonChars: safeJsonSize(payload),
		topLevelKeys,
	};

	if (!isPlainObject(payload)) return summary;

	if (typeof payload.model === "string") {
		summary.model = payload.model;
	}

	const messages = Array.isArray(payload.messages) ? payload.messages : undefined;
	if (messages) {
		summary.messageCount = messages.length;
		summary.messageRoles = countRoles(messages);
	}

	const input = Array.isArray(payload.input) ? payload.input : undefined;
	if (input) {
		summary.inputCount = input.length;
		summary.inputRoles = countRoles(input);
		summary.inputJsonChars = safeJsonSize(input);
	}

	const tools = Array.isArray(payload.tools) ? payload.tools : undefined;
	if (tools) {
		summary.toolCount = tools.length;
	}

	if (typeof payload.system === "string") {
		summary.systemLength = payload.system.length;
	} else if (payload.system !== undefined) {
		summary.systemLength = safeJsonSize(payload.system);
	}

	if (typeof payload.instructions === "string") {
		summary.instructionsLength = payload.instructions.length;
	} else if (payload.instructions !== undefined) {
		summary.instructionsLength = safeJsonSize(payload.instructions);
	}

	return summary;
}

export function summarizeCompactionPreparation(preparation: {
	firstKeptEntryId: string;
	messagesToSummarize: LensMessage[];
	turnPrefixMessages: LensMessage[];
	isSplitTurn: boolean;
	tokensBefore: number;
	previousSummary?: string;
	fileOps: { read?: Set<string>; edited?: Set<string> };
	settings: { enabled: boolean; reserveTokens: number; keepRecentTokens: number };
}): CompactionPreparationSummary {
	return {
		firstKeptEntryId: preparation.firstKeptEntryId,
		isSplitTurn: preparation.isSplitTurn,
		tokensBefore: preparation.tokensBefore,
		previousSummary: contentFingerprint(preparation.previousSummary),
		messagesToSummarize: summarizeMessages(preparation.messagesToSummarize),
		turnPrefixMessages: summarizeMessages(preparation.turnPrefixMessages),
		fileOps: {
			readCount: preparation.fileOps.read?.size ?? 0,
			editedCount: preparation.fileOps.edited?.size ?? 0,
		},
		settings: { ...preparation.settings },
	};
}

function getMessageContentChars(message: LensMessage): number {
	switch (message.role) {
		case "user":
		case "custom":
		case "toolResult":
			return getTextAndImageContentChars(message.content);
		case "assistant":
			if (!Array.isArray(message.content)) return 0;
			return message.content.reduce((sum: number, block: unknown) => {
				if (isPlainObject(block) && block.type === "text" && typeof block.text === "string") {
					return sum + block.text.length;
				}
				if (isPlainObject(block) && block.type === "thinking" && typeof block.thinking === "string") {
					return sum + block.thinking.length;
				}
				return sum;
			}, 0);
		case "bashExecution":
			return stringLength(getUnknownProp(message, "command")) + stringLength(getUnknownProp(message, "output"));
		case "branchSummary":
		case "compactionSummary":
			return stringLength(getUnknownProp(message, "summary"));
		default:
			return 0;
	}
}

function getTextAndImageContentChars(content: unknown): number {
	if (typeof content === "string") return content.length;
	if (!Array.isArray(content)) return 0;
	let chars = 0;
	for (const block of content) {
		if (isPlainObject(block) && block.type === "text" && typeof block.text === "string") chars += block.text.length;
		else if (isPlainObject(block) && block.type === "image") chars += 4800;
	}
	return chars;
}

function stringLength(value: unknown): number {
	return typeof value === "string" ? value.length : 0;
}

function getUnknownProp(value: object, key: string): unknown {
	return (value as Record<string, unknown>)[key];
}

function getStringProp(value: object, key: string): string | undefined {
	const prop = getUnknownProp(value, key);
	return typeof prop === "string" ? prop : undefined;
}

function countRoles(messages: unknown[]): Record<string, number> {
	const roles: Record<string, number> = {};
	for (const message of messages) {
		if (!isPlainObject(message) || typeof message.role !== "string") continue;
		roles[message.role] = (roles[message.role] ?? 0) + 1;
	}
	return roles;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
