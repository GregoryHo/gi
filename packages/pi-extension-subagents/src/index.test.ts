import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEventBus, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentWorkerService, registerAgentWorkerProtocol } from "@gregho/pi-extension-agent-workers";

import subagentsExtension from "./index.ts";

test("subagents extension registers one bounded foreground tool", () => {
	const tools: Array<Record<string, unknown>> = [];
	const pi = {
		registerTool(tool: Record<string, unknown>) {
			tools.push(tool);
		},
	} as unknown as ExtensionAPI;

	subagentsExtension(pi);

	assert.equal(tools.length, 1);
	assert.equal(tools[0]?.name, "subagent");
	assert.match(String(tools[0]?.description), /foreground/i);
	assert.equal(typeof tools[0]?.execute, "function");
});

test("Subagents is installable without a runtime Agent Workers package dependency", async () => {
	const [manifestText, indexText] = await Promise.all([
		readFile(new URL("../package.json", import.meta.url), "utf8"),
		readFile(new URL("./index.ts", import.meta.url), "utf8"),
	]);
	const manifest = JSON.parse(manifestText) as { peerDependencies?: Record<string, string> };

	assert.equal(manifest.peerDependencies?.["@gregho/pi-extension-agent-workers"], undefined);
	assert.doesNotMatch(indexText, /from "@gregho\/pi-extension-agent-workers\/protocol"/);
});

test("registered subagent tool throws when the Agent Workers runtime is unavailable", async () => {
	const events = createEventBus();
	let tool: Record<string, unknown> | undefined;
	const pi = {
		events,
		registerTool(value: Record<string, unknown>) {
			tool = value;
		},
	} as unknown as ExtensionAPI;
	subagentsExtension(pi);

	await assert.rejects(
		(tool?.execute as Function)(
			"call-1",
			{ calls: [{ agent: "explorer", task: "inspect" }] },
			new AbortController().signal,
			() => undefined,
			{ cwd: process.cwd(), hasUI: false },
		),
		/Agent Workers runtime/,
	);
});

test("registered subagent tool integrates with the Agent Workers event protocol", async () => {
	const events = createEventBus();
	const runs = new Map<string, Record<string, unknown>>();
	let sequence = 0;
	let capturedStart: Record<string, unknown> | undefined;
	const manager = {
		async startRun(input: Record<string, unknown>) {
			capturedStart = input;
			const run = {
				id: `integration-${++sequence}`,
				adapter: input.adapter,
				taskPreview: input.taskPreview,
				cwd: input.cwd,
				status: "running",
				startedAt: 1,
				lastActivityAt: 1,
				logPath: "/private/integration.log",
				usage: { source: "unknown" },
				activity: [],
				readOnly: input.readOnly,
				canModifyWorkspace: input.canModifyWorkspace,
			};
			runs.set(run.id, run);
			return { ...run };
		},
		getRun(id: string) {
			const run = runs.get(id);
			return run ? { ...run } : undefined;
		},
		async waitForRun(id: string) {
			const run = runs.get(id)!;
			Object.assign(run, {
				status: "completed",
				statusReason: "exit_zero",
				endedAt: 2,
				finalText: "integrated child result",
			});
			return { ...run };
		},
	} as never;
	const service = new AgentWorkerService({ manager });
	const dispose = registerAgentWorkerProtocol(events, service);
	let tool: Record<string, unknown> | undefined;
	const pi = {
		events,
		registerTool(value: Record<string, unknown>) {
			tool = value;
		},
	} as unknown as ExtensionAPI;
	subagentsExtension(pi);
	let confirmations = 0;
	const updates: Array<{ content: Array<{ text: string }> }> = [];

	const result = await (tool?.execute as Function)(
		"call-1",
		{ calls: [{ agent: "reviewer", task: "review integration" }], cwd: process.cwd() },
		new AbortController().signal,
		(update: { content: Array<{ text: string }> }) => updates.push(update),
		{ cwd: process.cwd(), hasUI: true, ui: { confirm: async () => { confirmations++; return true; } } },
	);

	assert.equal(confirmations, 1);
	assert.equal(capturedStart?.readOnly, true);
	assert.equal(capturedStart?.canModifyWorkspace, false);
	assert.equal((result.details.results[0] as { finalText: string }).finalText, "integrated child result");
	assert.match(result.content[0].text, /\[reviewer\]/);
	assert.match(result.content[0].text, /integrated child result/);
	assert.ok(updates.some((update) => update.content[0]?.text.includes("Subagents: 1/1 completed")));
	dispose();
});
