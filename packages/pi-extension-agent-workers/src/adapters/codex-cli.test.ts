import assert from "node:assert/strict";
import test from "node:test";

import { createCodexCliAdapter, parseCodexCliJsonLine } from "./codex-cli.ts";

test("createCodexCliAdapter builds safe exec JSON argv", () => {
  const adapter = createCodexCliAdapter({ executable: "codex-test", isCommandAvailable: () => true });
  const spec = adapter.createSpawnSpec("Reply OK", "/tmp/project");

  assert.equal(adapter.name, "codex-cli");
  assert.equal(spec.command, "codex-test");
  assert.equal(spec.cwd, "/tmp/project");
  assert.equal(spec.shell, false);
  assert.deepEqual(spec.args, ["exec", "--json", "Reply OK"]);
  assert.equal(spec.args.includes("--dangerously-bypass-approvals-and-sandbox"), false);
});

test("createCodexCliAdapter validate reports unavailable CLI", () => {
  const adapter = createCodexCliAdapter({ executable: "missing-codex", isCommandAvailable: () => false });

  assert.throws(() => adapter.validate?.(), /Codex CLI not found/);
});

test("createCodexCliAdapter wires stdout parser", () => {
  const adapter = createCodexCliAdapter({ executable: "codex-test", isCommandAvailable: () => true });
  const events = adapter.parseOutputLine?.(
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "OK" } }),
    "stdout",
    222,
  );

  assert.deepEqual(events, [{ type: "final", text: "OK", timestamp: 222 }]);
});

test("parseCodexCliJsonLine maps agent message to final text", () => {
  const line = JSON.stringify({
    type: "item.completed",
    item: { id: "item_0", type: "agent_message", text: "OK" },
  });

  assert.deepEqual(parseCodexCliJsonLine(line, 100), [{ type: "final", text: "OK", timestamp: 100 }]);
});

test("parseCodexCliJsonLine maps turn completed usage as reported", () => {
  const line = JSON.stringify({
    type: "turn.completed",
    usage: {
      input_tokens: 11,
      cached_input_tokens: 2,
      output_tokens: 3,
      reasoning_output_tokens: 4,
    },
  });

  assert.deepEqual(parseCodexCliJsonLine(line, 200), [
    { type: "activity", label: "codex turn completed", timestamp: 200 },
    {
      type: "usage",
      usage: {
        inputTokens: 11,
        outputTokens: 3,
        cacheReadTokens: 2,
        reasoningOutputTokens: 4,
        source: "reported",
      },
      timestamp: 200,
    },
  ]);
});

test("parseCodexCliJsonLine keeps missing usage unknown by emitting no usage event", () => {
  const events = parseCodexCliJsonLine(JSON.stringify({ type: "turn.completed" }), 250);

  assert.deepEqual(events, [{ type: "activity", label: "codex turn completed", timestamp: 250 }]);
});

test("parseCodexCliJsonLine maps malformed JSON to output fallback", () => {
  assert.deepEqual(parseCodexCliJsonLine("not json", 300), [
    { type: "output", stream: "stdout", text: "not json", timestamp: 300 },
  ]);
});
