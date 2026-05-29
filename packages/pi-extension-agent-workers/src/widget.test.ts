import assert from "node:assert/strict";
import test from "node:test";

import { clearAgentWorkersWidget, DEFAULT_WIDGET_REFRESH_MS, registerAgentWorkerWidget, renderWorkerWidget, updateAgentWorkersWidget } from "./widget.ts";
import type { AgentWorkerService } from "./service.ts";
import type { WorkerRunHistoryEntry } from "./worker-types.ts";

test("renderWorkerWidget displays compact original-style worker cards", () => {
  const entries = Array.from({ length: 7 }, (_, index) => makeEntry({ runId: `run_${index + 1}`, taskPreview: `task ${index + 1}` }));

  const lines = renderWorkerWidget(entries, { now: 2000, width: 72 });

  assert.equal(lines[0], "Agent workers");
  assert.equal(lines.filter((line) => line.startsWith("┌─ #")).length, 6);
  assert.ok(lines.some((line) => line.includes("#1 run_1 ✓ completed")));
  assert.ok(lines.some((line) => line.includes("adapter: claude-code")));
  assert.ok(lines.some((line) => line.includes("profile: verifier")));
  assert.ok(lines.some((line) => line.includes("duration: 1s")));
  assert.ok(lines.some((line) => line.includes("task: task 1")));
  assert.ok(lines.some((line) => line.includes("reason: exit_zero")));
  assert.equal(lines.some((line) => line.includes("task 7")), false);
});

test("renderWorkerWidget uses compact two-card rows on wide terminals", () => {
  const lines = renderWorkerWidget([
    makeEntry({ runId: "run_left", adapter: "demo", profile: "planner", slot: 2 }),
    makeEntry({ runId: "run_right", adapter: "codex-cli", profile: "reviewer", slot: 3 }),
  ], { width: 140 });

  assert.ok(lines.some((line) => line.includes("run_left") && line.includes("┌─ #3 run_right")));
  assert.equal(lines.some((line) => line.includes("│ ┌─ #3 run_right")), false);
  assert.ok(lines.some((line) => line.includes("#2 run_left") && line.includes("#3 run_right")));
  assert.ok(lines.some((line) => line.includes("adapter: demo") && line.includes("adapter: codex-cli")));
  assert.ok(lines.some((line) => line.length < 120));
});

test("renderWorkerWidget shows slot and concrete started time", () => {
  const lines = renderWorkerWidget([makeEntry({ slot: 4, startedAt: 1779849609211 })], { width: 72 });

  assert.ok(lines.some((line) => line.includes("#4 run_widget")));
  assert.ok(lines.some((line) => /started: \d{2}:\d{2}:\d{2}/.test(line)));
});

test("renderWorkerWidget truncates long task and reason fields", () => {
  const lines = renderWorkerWidget([
    makeEntry({
      taskPreview: "System prompt: secret secret secret secret secret secret secret secret secret secret user task",
      statusReason: "exit_nonzero",
    }),
  ], { width: 48 });

  assert.ok(lines.every((line) => line.length <= 48));
  assert.ok(lines.some((line) => line.includes("task: System prompt:") && line.includes("…")));
  assert.ok(lines.some((line) => line.includes("reason: exit_nonzero")));
});

test("updateAgentWorkersWidget is a no-op without UI", async () => {
  const service = createFakeService([makeEntry()]);

  await updateAgentWorkersWidget({ hasUI: false, ui: {} }, service);
});

test("updateAgentWorkersWidget requests current workspace scoped history", async () => {
  const historyCalls: unknown[] = [];
  const service = {
    getWorkspaceConfig: async () => ({ version: 1, scopeKey: "/tmp/project", scopeLabel: "project" }),
    listRunHistory: async (options?: unknown) => {
      historyCalls.push(options);
      return [makeEntry()];
    },
  } as unknown as AgentWorkerService;

  await updateAgentWorkersWidget({ cwd: "/tmp/project", hasUI: true, ui: { setWidget: () => undefined } }, service);

  assert.deepEqual(historyCalls, [{ limit: 6, cwd: "/tmp/project" }]);
});

test("updateAgentWorkersWidget applies workspace config widget preferences", async () => {
  const calls: Array<{ key: string; content?: WidgetContentForTest; options?: { placement?: "aboveEditor" | "belowEditor" } }> = [];
  const historyCalls: unknown[] = [];
  const service = {
    getWorkspaceConfig: async () => ({ version: 1, scopeKey: "/tmp/project", scopeLabel: "project", widgetLimit: 2, widgetPlacement: "belowEditor" }),
    listRunHistory: async (options?: unknown) => {
      historyCalls.push(options);
      return [makeEntry({ runId: "run_1" }), makeEntry({ runId: "run_2" }), makeEntry({ runId: "run_3" })];
    },
  } as unknown as AgentWorkerService;

  await updateAgentWorkersWidget({ cwd: "/tmp/project", hasUI: true, ui: { setWidget: (key, content, options) => calls.push({ key, content: content as WidgetContentForTest, options }) } }, service);

  assert.deepEqual(historyCalls, [{ limit: 2, cwd: "/tmp/project" }]);
  assert.equal(calls[0]?.options?.placement, "belowEditor");
  const lines = renderWidgetContent(calls[0]?.content, 140);
  assert.equal(lines.some((line) => line.includes("run_3")), false);
});

test("updateAgentWorkersWidget installs a component factory that uses actual render width", async () => {
  let content: WidgetContentForTest | undefined;
  await updateAgentWorkersWidget(
    { cwd: "/tmp/project", hasUI: true, ui: { setWidget: (_key, nextContent) => { content = nextContent as WidgetContentForTest; } } },
    createFakeService([makeEntry({ runId: "run_left" }), makeEntry({ runId: "run_right" })]),
  );

  assert.equal(typeof content, "function");
  const narrow = renderWidgetContent(content, 80);
  const wide = renderWidgetContent(content, 140);
  assert.equal(narrow.some((line) => line.includes("run_left") && line.includes("run_right")), false);
  assert.ok(wide.some((line) => line.includes("run_left") && line.includes("┌─ #1 run_right")));
});

test("registerAgentWorkerWidget refreshes the widget on an interval", async () => {
  const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void> | void>();
  const service = createFakeService([makeEntry()]);
  let intervalMs = 0;
  let refresh: (() => void) | undefined;
  let cleared = false;
  const calls: string[] = [];
  const ctx = {
    hasUI: true,
    ui: {
      setWidget() {
        calls.push("setWidget");
      },
    },
  };

  registerAgentWorkerWidget(
    {
      on(name: string, handler: (event: unknown, ctx: any) => Promise<void> | void) {
        handlers.set(name, handler);
      },
    } as unknown as Parameters<typeof registerAgentWorkerWidget>[0],
    service,
    {
      setIntervalFn: (callback, ms) => {
        intervalMs = ms;
        refresh = callback;
        return "timer";
      },
      clearIntervalFn: (timer) => {
        assert.equal(timer, "timer");
        cleared = true;
      },
    },
  );

  await handlers.get("session_start")?.({}, ctx);
  assert.equal(intervalMs, DEFAULT_WIDGET_REFRESH_MS);
  refresh?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls.length, 2);
  await handlers.get("session_shutdown")?.({}, ctx);
  assert.equal(cleared, true);
});

test("updateAgentWorkersWidget sets and clears the widget when UI is available", async () => {
  const calls: Array<{ key: string; content?: WidgetContentForTest }> = [];
  const ctx = {
    hasUI: true,
    ui: {
      setWidget(key: string, content?: WidgetContentForTest) {
        calls.push({ key, content });
      },
    },
  };

  await updateAgentWorkersWidget(ctx, createFakeService([makeEntry()]));
  clearAgentWorkersWidget(ctx);

  assert.equal(calls[0]?.key, "agent-workers");
  assert.ok(renderWidgetContent(calls[0]?.content, 80).some((line) => line.includes("Agent workers")));
  assert.deepEqual(calls[1], { key: "agent-workers", content: undefined });
});

type WidgetContentForTest = string[] | ((tui?: unknown, theme?: unknown) => { render(width: number): string[] });

function renderWidgetContent(content: WidgetContentForTest | undefined, width: number): string[] {
  if (Array.isArray(content)) return content;
  return content?.().render(width) ?? [];
}

function makeEntry(overrides: Partial<WorkerRunHistoryEntry> = {}): WorkerRunHistoryEntry {
  return {
    runId: "run_widget",
    status: "completed",
    statusReason: "exit_zero",
    adapter: "claude-code",
    profile: "verifier",
    mode: "review",
    taskPreview: "verify acceptance criteria",
    cwd: "/tmp/project",
    pid: 1234,
    slot: 1,
    startedAt: 1000,
    endedAt: 2000,
    elapsedMs: 1000,
    lastActivityAt: 2000,
    exitCode: 0,
    usage: { source: "unknown" },
    activity: ["checked status"],
    logPath: "/tmp/log",
    controllable: true,
    historical: false,
    ...overrides,
  };
}

function createFakeService(entries: WorkerRunHistoryEntry[]): AgentWorkerService {
  return {
    getWorkspaceConfig: async () => ({ version: 1, scopeKey: "/tmp/project", scopeLabel: "project" }),
    listRunHistory: async (options?: { limit?: number } | number) => {
      const limit = typeof options === "number" ? options : options?.limit;
      return entries.slice(0, limit);
    },
    onRunChange: () => undefined,
  } as unknown as AgentWorkerService;
}
