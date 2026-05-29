import assert from "node:assert/strict";
import test from "node:test";

import { createClaudeCodeAdapter, parseClaudeCodeStreamLine } from "./claude-code.ts";

test("createClaudeCodeAdapter builds safe stream-json argv", () => {
  const adapter = createClaudeCodeAdapter({ executable: "claude-test", isCommandAvailable: () => true });
  const spec = adapter.createSpawnSpec("Reply OK", "/tmp/project");

  assert.equal(adapter.name, "claude-code");
  assert.equal(spec.command, "claude-test");
  assert.equal(spec.cwd, "/tmp/project");
  assert.equal(spec.shell, false);
  assert.deepEqual(spec.args, [
    "-p",
    "--verbose",
    "--no-session-persistence",
    "--output-format",
    "stream-json",
    "Reply OK",
  ]);
  assert.equal(spec.args.includes("--dangerously-skip-permissions"), false);
});

test("createClaudeCodeAdapter validate reports unavailable CLI", () => {
  const adapter = createClaudeCodeAdapter({ executable: "missing-claude", isCommandAvailable: () => false });

  assert.throws(() => adapter.validate?.(), /Claude Code CLI not found/);
});

test("createClaudeCodeAdapter wires stdout parser", () => {
  const adapter = createClaudeCodeAdapter({ executable: "claude-test", isCommandAvailable: () => true });
  const events = adapter.parseOutputLine?.(
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "OK" }] } }),
    "stdout",
    111,
  );

  assert.deepEqual(events, [{ type: "final", text: "OK", timestamp: 111 }]);
});

test("parseClaudeCodeStreamLine maps assistant text and reported usage", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "OK" }],
      usage: {
        input_tokens: 10,
        output_tokens: 2,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 4,
      },
    },
  });

  const events = parseClaudeCodeStreamLine(line, 123);

  assert.deepEqual(events, [
    { type: "final", text: "OK", timestamp: 123 },
    {
      type: "usage",
      usage: {
        inputTokens: 10,
        outputTokens: 2,
        cacheReadTokens: 3,
        cacheWriteTokens: 4,
        source: "reported",
      },
      timestamp: 123,
    },
  ]);
});

test("parseClaudeCodeStreamLine maps result usage and cost without raw payload", () => {
  const line = JSON.stringify({
    type: "result",
    subtype: "success",
    total_cost_usd: 0.01,
    usage: {
      input_tokens: 20,
      output_tokens: 5,
      cache_read_input_tokens: 6,
      cache_creation_input_tokens: 7,
    },
  });

  const events = parseClaudeCodeStreamLine(line, 456);

  assert.deepEqual(events, [
    { type: "activity", label: "claude result: success", timestamp: 456 },
    {
      type: "usage",
      usage: {
        inputTokens: 20,
        outputTokens: 5,
        cacheReadTokens: 6,
        cacheWriteTokens: 7,
        costUsd: 0.01,
        source: "reported",
      },
      timestamp: 456,
    },
  ]);
});

test("parseClaudeCodeStreamLine keeps missing usage unknown by emitting no usage event", () => {
  const events = parseClaudeCodeStreamLine(JSON.stringify({ type: "result", subtype: "success" }), 500);

  assert.deepEqual(events, [{ type: "activity", label: "claude result: success", timestamp: 500 }]);
});

test("parseClaudeCodeStreamLine maps malformed JSON to output fallback", () => {
  assert.deepEqual(parseClaudeCodeStreamLine("not json", 789), [
    { type: "output", stream: "stdout", text: "not json", timestamp: 789 },
  ]);
});
