import test from "node:test";
import assert from "node:assert/strict";
import {
	summarizeBeforeAgentStart,
	summarizeCompactionPreparation,
	summarizeMessages,
	summarizeProviderPayload,
} from "./summarize.ts";

test("summarizeBeforeAgentStart records lengths and counts without raw prompt text", () => {
	const summary = summarizeBeforeAgentStart({
		prompt: "secret user prompt",
		images: [{ type: "image", data: "base64", mimeType: "image/png" }],
		systemPrompt: "system instructions",
		systemPromptOptions: {
			cwd: "/repo",
			selectedTools: ["read", "bash"],
			contextFiles: [{ path: "/repo/AGENTS.md", content: "private project rules" }],
			skills: [{ name: "skill-a", description: "desc", location: "/skills/a/SKILL.md" } as any],
		},
	});

	assert.equal(summary.prompt.length, "secret user prompt".length);
	assert.equal(summary.prompt.preview, undefined);
	assert.equal(summary.imageCount, 1);
	assert.equal(summary.systemPrompt.length, "system instructions".length);
	assert.equal(summary.systemPromptOptions.contextFileCount, 1);
	assert.deepEqual(summary.systemPromptOptions.selectedTools, ["read", "bash"]);
	assert.deepEqual(summary.systemPromptOptions.skillNames, ["skill-a"]);
	assert.equal(JSON.stringify(summary).includes("secret user prompt"), false);
	assert.equal(JSON.stringify(summary).includes("private project rules"), false);
});

test("summarizeMessages records role counts and tool call names without raw text", () => {
	const messages = [
		{ role: "user", content: "please read secret.txt", timestamp: 1 },
		{
			role: "assistant",
			content: [
				{ type: "text", text: "I will read it" },
				{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "secret.txt" } },
			],
			provider: "anthropic",
			model: "claude",
			usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "toolUse",
			timestamp: 2,
		},
		{ role: "toolResult", toolCallId: "call-1", toolName: "read", content: [{ type: "text", text: "file secret contents" }], isError: false, timestamp: 3 },
	] as any[];

	const summary = summarizeMessages(messages);

	assert.equal(summary.count, 3);
	assert.deepEqual(summary.roleCounts, { user: 1, assistant: 1, toolResult: 1 });
	assert.equal(summary.contentChars, "please read secret.txt".length + "I will read it".length + "file secret contents".length);
	assert.equal(summary.hasCompactionSummary, false);
	assert.deepEqual(summary.toolCallNames, ["read"]);
	assert.deepEqual(summary.toolResultNames, ["read"]);
	assert.equal(JSON.stringify(summary).includes("secret.txt"), false);
	assert.equal(JSON.stringify(summary).includes("file secret contents"), false);
});

test("summarizeProviderPayload records provider shape without raw message content", () => {
	const summary = summarizeProviderPayload({
		system: "private system prompt",
		messages: [{ role: "user", content: "secret payload prompt" }],
		tools: [{ name: "read", input_schema: { type: "object" } }],
		max_tokens: 1024,
	});

	assert.deepEqual(summary.topLevelKeys, ["max_tokens", "messages", "system", "tools"]);
	assert.equal(summary.messageCount, 1);
	assert.deepEqual(summary.messageRoles, { user: 1 });
	assert.equal(summary.toolCount, 1);
	assert.equal(summary.systemLength, "private system prompt".length);
	assert.equal(JSON.stringify(summary).includes("secret payload prompt"), false);
	assert.equal(JSON.stringify(summary).includes("private system prompt"), false);
});

test("summarizeProviderPayload records Responses API input shape without raw content", () => {
	const summary = summarizeProviderPayload({
		instructions: "private response instructions",
		input: [
			{ role: "user", content: [{ type: "input_text", text: "secret user input" }] },
			{ role: "assistant", content: [{ type: "output_text", text: "secret assistant output" }] },
		],
		tools: [{ type: "function", name: "bash" }],
		model: "gpt-5",
	});

	assert.deepEqual(summary.topLevelKeys, ["input", "instructions", "model", "tools"]);
	assert.equal(summary.instructionsLength, "private response instructions".length);
	assert.equal(summary.inputCount, 2);
	assert.deepEqual(summary.inputRoles, { user: 1, assistant: 1 });
	assert.equal(summary.inputJsonChars, JSON.stringify([
		{ role: "user", content: [{ type: "input_text", text: "secret user input" }] },
		{ role: "assistant", content: [{ type: "output_text", text: "secret assistant output" }] },
	]).length);
	assert.equal(summary.toolCount, 1);
	assert.equal(summary.model, "gpt-5");
	assert.equal(JSON.stringify(summary).includes("secret user input"), false);
	assert.equal(JSON.stringify(summary).includes("secret assistant output"), false);
	assert.equal(JSON.stringify(summary).includes("private response instructions"), false);
});

test("summarizeCompactionPreparation records boundaries without raw summaries", () => {
	const summary = summarizeCompactionPreparation({
		firstKeptEntryId: "entry-2",
		messagesToSummarize: [{ role: "user", content: "old secret", timestamp: 1 }],
		turnPrefixMessages: [{ role: "assistant", content: [{ type: "text", text: "prefix secret" }], timestamp: 2 }],
		isSplitTurn: true,
		tokensBefore: 1234,
		previousSummary: "previous secret summary",
		fileOps: { read: new Set(["secret.ts"]), edited: new Set(["changed.ts"]) },
		settings: { enabled: true, reserveTokens: 100, keepRecentTokens: 200 },
	} as any);

	assert.equal(summary.firstKeptEntryId, "entry-2");
	assert.equal(summary.isSplitTurn, true);
	assert.equal(summary.messagesToSummarize.count, 1);
	assert.equal(summary.turnPrefixMessages.count, 1);
	assert.equal(summary.previousSummary?.length, "previous secret summary".length);
	assert.deepEqual(summary.fileOps, { readCount: 1, editedCount: 1 });
	assert.equal(JSON.stringify(summary).includes("previous secret summary"), false);
	assert.equal(JSON.stringify(summary).includes("old secret"), false);
	assert.equal(JSON.stringify(summary).includes("secret.ts"), false);
});
