import assert from "node:assert/strict";
import test from "node:test";

import { createMinimalResourceLoader, createPiSdkAdapter } from "./pi-sdk.ts";

interface FakeSession {
  prompt(text: string): Promise<void>;
  subscribe(listener: (event: unknown) => void): () => void;
  abort(): Promise<void>;
  dispose(): void;
}

function createFakeSession(onPrompt?: (text: string, emit: (event: unknown) => void) => void): FakeSession {
  const listeners = new Set<(event: unknown) => void>();
  const emit = (event: unknown) => {
    for (const listener of listeners) listener(event);
  };
  return {
    async prompt(text: string) {
      onPrompt?.(text, emit);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async abort() {},
    dispose() {},
  };
}

test("createMinimalResourceLoader excludes inherited child resources and applies the worker system prompt", () => {
	const loader = createMinimalResourceLoader("Focused child prompt.");

	const extensions = loader.getExtensions();
	assert.deepEqual(extensions.extensions, []);
	assert.deepEqual(extensions.errors, []);
	assert.ok(extensions.runtime);
	assert.deepEqual(loader.getSkills(), { skills: [], diagnostics: [] });
	assert.deepEqual(loader.getPrompts(), { prompts: [], diagnostics: [] });
	assert.deepEqual(loader.getThemes(), { themes: [], diagnostics: [] });
	assert.deepEqual(loader.getAgentsFiles(), { agentsFiles: [] });
	assert.equal(loader.getSystemPrompt(), "Focused child prompt.");
	assert.deepEqual(loader.getAppendSystemPrompt(), []);
});

test("createPiSdkAdapter passes child options and uses read-only tools for read-only worker runs", async () => {
	const calls: Array<{
		cwd?: string;
		tools?: string[];
		systemPrompt?: string;
		model?: string;
		thinking?: string;
		maxTurns?: number;
	}> = [];
	const adapter = createPiSdkAdapter({
		createSession: async (options) => {
			calls.push(options);
			return { session: createFakeSession() };
		},
	});

	await adapter.runTask({
		task: "inspect only",
		cwd: "/tmp/project",
		options: {
			systemPrompt: "Review without editing.",
			model: "anthropic/claude-sonnet-4-6",
			thinking: "high",
			maxTurns: 3,
		},
		readOnly: true,
		canModifyWorkspace: false,
		signal: new AbortController().signal,
		emitEvent: () => undefined,
		writeOutput: () => undefined,
	});

	assert.deepEqual(calls, [{
		cwd: "/tmp/project",
		tools: ["read", "grep", "find", "ls"],
		systemPrompt: "Review without editing.",
		model: "anthropic/claude-sonnet-4-6",
		thinking: "high",
		maxTurns: 3,
	}]);
});

test("createPiSdkAdapter enables write tools only for write-capable worker runs and applies the default turn budget", async () => {
	const calls: Array<{ tools?: string[]; maxTurns?: number }> = [];
  const adapter = createPiSdkAdapter({
    createSession: async (options) => {
			calls.push({ tools: options.tools, maxTurns: options.maxTurns });
      return { session: createFakeSession() };
    },
  });

  await adapter.runTask({
    task: "make focused edit",
    cwd: "/tmp/project",
    options: {},
    readOnly: false,
    canModifyWorkspace: true,
    signal: new AbortController().signal,
    emitEvent: () => undefined,
    writeOutput: () => undefined,
  });

	assert.deepEqual(calls[0]?.tools, ["read", "grep", "find", "ls", "bash", "edit", "write"]);
	assert.equal(calls[0]?.maxTurns, 20);
});

test("createPiSdkAdapter stops a child that exceeds its turn budget", async () => {
	let aborted = false;
	const events: unknown[] = [];
	const adapter = createPiSdkAdapter({
		now: () => 2000,
		createSession: async () => {
			const session = createFakeSession((_text, emit) => {
				emit({ type: "turn_end" });
				emit({ type: "turn_end" });
			});
			return {
				session: {
					...session,
					async abort() {
						aborted = true;
					},
				},
			};
		},
	});

	const result = await adapter.runTask({
		task: "bounded task",
		cwd: "/tmp/project",
		options: { maxTurns: 2 },
		readOnly: true,
		canModifyWorkspace: false,
		signal: new AbortController().signal,
		emitEvent: (event) => events.push(event),
		writeOutput: () => undefined,
	});

	assert.equal(aborted, true);
	assert.deepEqual(result, { exitCode: 1, statusReason: "turn_limit" });
	assert.ok(events.some((event) => (event as { type?: string }).type === "error"));
});

test("createPiSdkAdapter surfaces setup and prompt failures without inventing usage", async () => {
	const setupAdapter = createPiSdkAdapter({
		createSession: async () => {
			throw new Error("setup failed");
		},
	});
	const context = {
		task: "failure",
		cwd: "/tmp/project",
		options: {},
		readOnly: true,
		canModifyWorkspace: false,
		signal: new AbortController().signal,
		emitEvent: () => undefined,
		writeOutput: () => undefined,
	};
	await assert.rejects(setupAdapter.runTask(context), /setup failed/);

	const events: unknown[] = [];
	let disposed = false;
	const promptAdapter = createPiSdkAdapter({
		createSession: async () => ({
			session: {
				...createFakeSession(),
				async prompt() {
					throw new Error("prompt failed");
				},
				dispose() {
					disposed = true;
				},
			},
		}),
	});
	const result = await promptAdapter.runTask({ ...context, emitEvent: (event) => events.push(event) });

	assert.equal(result.exitCode, 1);
	assert.equal(disposed, true);
	assert.deepEqual(events.map((event) => (event as { type?: string }).type), ["error"]);
});

test("createPiSdkAdapter completes without final text or reported usage when the child emits neither", async () => {
	const events: unknown[] = [];
	const adapter = createPiSdkAdapter({ createSession: async () => ({ session: createFakeSession() }) });

	const result = await adapter.runTask({
		task: "silent child",
		cwd: "/tmp/project",
		options: {},
		readOnly: true,
		canModifyWorkspace: false,
		signal: new AbortController().signal,
		emitEvent: (event) => events.push(event),
		writeOutput: () => undefined,
	});

	assert.equal(result.exitCode, 0);
	assert.deepEqual(events, [{
		type: "activity",
		label: "pi-sdk child session completed",
		timestamp: events.length > 0 ? (events[0] as { timestamp: number }).timestamp : 0,
	}]);
});

test("createPiSdkAdapter emits complete final text, writes it to the private run log, and reports usage", async () => {
  const events: unknown[] = [];
  const output: string[] = [];
  const finalText = `Child result: ${"detail ".repeat(40)}`.trim();
  const adapter = createPiSdkAdapter({
    now: () => 1000,
    createSession: async () => ({
      session: createFakeSession((_text, emit) => {
        emit({
          type: "message_end",
          message: {
            role: "assistant",
							content: [{ type: "text", text: finalText }],
            usage: {
              input: 11,
              output: 3,
              cacheRead: 2,
              cacheWrite: 1,
              cost: { total: 0.004 },
            },
          },
        });
      }),
    }),
  });

  const result = await adapter.runTask({
    task: "reply ok",
    cwd: "/tmp/project",
    options: {},
    readOnly: true,
    canModifyWorkspace: false,
    signal: new AbortController().signal,
    emitEvent: (event) => events.push(event),
    writeOutput: (_stream, line) => output.push(line),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(events, [
		{ type: "final", text: finalText, timestamp: 1000 },
    {
      type: "usage",
      usage: {
        source: "reported",
        inputTokens: 11,
        outputTokens: 3,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
        costUsd: 0.004,
      },
      timestamp: 1000,
    },
    { type: "activity", label: "pi-sdk child session completed", timestamp: 1000 },
  ]);
  assert.deepEqual(output, [`[final]\n${finalText}`, "pi-sdk child session completed"]);
});
