import assert from "node:assert/strict";
import test from "node:test";

import { createPiSdkAdapter } from "./pi-sdk.ts";

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

test("createPiSdkAdapter uses read-only tools for read-only worker runs", async () => {
  const calls: Array<{ cwd?: string; tools?: string[] }> = [];
  const adapter = createPiSdkAdapter({
    createSession: async (options) => {
      calls.push({ cwd: options.cwd, tools: options.tools });
      return { session: createFakeSession() };
    },
  });

  await adapter.runTask({
    task: "inspect only",
    cwd: "/tmp/project",
    options: {},
    readOnly: true,
    canModifyWorkspace: false,
    signal: new AbortController().signal,
    emitEvent: () => undefined,
    writeOutput: () => undefined,
  });

  assert.deepEqual(calls, [{ cwd: "/tmp/project", tools: ["read", "grep", "find", "ls"] }]);
});

test("createPiSdkAdapter enables write tools only for write-capable worker runs", async () => {
  const calls: Array<{ tools?: string[] }> = [];
  const adapter = createPiSdkAdapter({
    createSession: async (options) => {
      calls.push({ tools: options.tools });
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
});

test("createPiSdkAdapter emits compact final text and reported usage from child messages", async () => {
  const events: unknown[] = [];
  const output: string[] = [];
  const adapter = createPiSdkAdapter({
    now: () => 1000,
    createSession: async () => ({
      session: createFakeSession((_text, emit) => {
        emit({
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "OK from child session" }],
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
    { type: "final", text: "OK from child session", timestamp: 1000 },
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
  assert.deepEqual(output, ["pi-sdk child session completed"]);
});
