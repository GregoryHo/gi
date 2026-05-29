import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  formatWorkerKillLines,
  formatWorkerRunLines,
  getAgentWorkersHelpLines,
  parseWorkerHistoryArgs,
  parseWorkerRunArgs,
  parseWorkerUiPocArgs,
  parseWorkerWaitArgs,
  registerAgentWorkerCommands,
} from "./commands.ts";
import { AgentWorkerService } from "./service.ts";
import { createWorkerCardWidget, WORKER_UI_POC_CARD_REFRESH_MS } from "./ui-poc.ts";
import type { WorkerRunHistoryEntry } from "./worker-types.ts";

test("parseWorkerRunArgs defaults to demo adapter and keeps task text", () => {
  assert.deepEqual(parseWorkerRunArgs("write tests for worker state"), {
    ok: true,
    adapter: "demo",
    task: "write tests for worker state",
  });
});

test("parseWorkerRunArgs accepts explicit demo adapter", () => {
  assert.deepEqual(parseWorkerRunArgs("--adapter demo inspect logs"), {
    ok: true,
    adapter: "demo",
    task: "inspect logs",
  });
});

test("parseWorkerRunArgs accepts profile invocation", () => {
  assert.deepEqual(parseWorkerRunArgs("--profile planner inspect the diff"), {
    ok: true,
    profile: "planner",
    task: "inspect the diff",
  });
  assert.deepEqual(parseWorkerRunArgs("--profile implementer fix focused bug"), {
    ok: true,
    profile: "implementer",
    task: "fix focused bug",
  });
  assert.deepEqual(parseWorkerRunArgs("--profile verifier check acceptance criteria"), {
    ok: true,
    profile: "verifier",
    task: "check acceptance criteria",
  });
});

test("parseWorkerRunArgs accepts explicit real worker adapters", () => {
  assert.deepEqual(parseWorkerRunArgs("--adapter claude-code --yes fix bug"), {
    ok: true,
    adapter: "claude-code",
    task: "fix bug",
    confirmedRealWorker: true,
  });
  assert.deepEqual(parseWorkerRunArgs("--adapter codex-cli --yes review change"), {
    ok: true,
    adapter: "codex-cli",
    task: "review change",
    confirmedRealWorker: true,
  });
});

test("parseWorkerRunArgs accepts explicit cwd", () => {
  assert.deepEqual(parseWorkerRunArgs("--cwd /tmp/product --adapter demo inspect repo"), {
    ok: true,
    adapter: "demo",
    cwd: "/tmp/product",
    task: "inspect repo",
  });
});

test("parseWorkerRunArgs accepts safe demo duration", () => {
  assert.deepEqual(parseWorkerRunArgs("--adapter demo --duration-ms 10000 cancel test"), {
    ok: true,
    adapter: "demo",
    task: "cancel test",
    durationMs: 10000,
  });
});

test("parseWorkerRunArgs accepts run timeout", () => {
  assert.deepEqual(parseWorkerRunArgs("--adapter demo --timeout-ms 1000 timeout test"), {
    ok: true,
    adapter: "demo",
    task: "timeout test",
    timeoutMs: 1000,
  });
});

test("parseWorkerRunArgs rejects unsafe demo duration", () => {
  const parsed = parseWorkerRunArgs("--duration-ms 999999 cancel test");
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /duration-ms must be between/);
});

test("parseWorkerRunArgs rejects missing task", () => {
  const parsed = parseWorkerRunArgs("--adapter demo");
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /Usage:/);
});

test("parseWorkerRunArgs rejects adapter aliases that are not explicit M3 names", () => {
  const parsed = parseWorkerRunArgs("--adapter claude fix bug");
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /Unknown adapter/);
});

test("parseWorkerRunArgs rejects unknown adapters", () => {
  const parsed = parseWorkerRunArgs("--adapter unknown task");
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /Unknown adapter/);
});

test("getAgentWorkersHelpLines lists M3 commands and real worker safety", () => {
  const lines = getAgentWorkersHelpLines();
  assert.ok(lines.some((line) => line.includes("/worker-run")));
  assert.ok(lines.some((line) => line.includes("--cwd")));
  assert.ok(lines.some((line) => line.includes("/worker-workspace")));
  assert.ok(lines.some((line) => line.includes("--profile planner")));
  assert.ok(lines.some((line) => line.includes("--profile implementer")));
  assert.ok(lines.some((line) => line.includes("--profile verifier")));
  assert.ok(lines.some((line) => line.includes("claude-code")));
  assert.ok(lines.some((line) => line.includes("codex-cli")));
  assert.ok(lines.some((line) => line.includes("confirmation")));
  assert.ok(lines.some((line) => line.includes("usage.source = unknown")));
});

test("formatWorkerRunLines shows reported usage and activity summaries", () => {
  const lines = formatWorkerRunLines({
    id: "run_usage",
    adapter: "codex-cli",
    taskPreview: "usage",
    cwd: "/tmp/project",
    status: "completed",
    startedAt: 1000,
    endedAt: 2000,
    exitCode: 0,
    logPath: "/tmp/log",
    usage: { source: "reported", inputTokens: 11, outputTokens: 3, cacheReadTokens: 2 },
    activity: ["codex turn completed"],
    finalTextPreview: "OK",
  });

  assert.ok(lines.includes("usage.source: reported"));
  assert.ok(lines.includes("usage.inputTokens: 11"));
  assert.ok(lines.includes("usage.outputTokens: 3"));
  assert.ok(lines.includes("activity: codex turn completed"));
  assert.ok(lines.includes("final: OK"));
});

test("formatWorkerKillLines does not claim cancellation for completed workers", () => {
  const lines = formatWorkerKillLines({
    id: "run_done",
    adapter: "demo",
    taskPreview: "done",
    cwd: "/tmp/project",
    status: "completed",
    startedAt: 1000,
    endedAt: 1250,
    exitCode: 0,
    logPath: "/tmp/log",
    usage: { source: "unknown" },
  });

  assert.equal(lines[0], "Worker is already completed.");
});

test("parseWorkerRunArgs accepts one-run cwd picker flag", () => {
  assert.deepEqual(parseWorkerRunArgs("--pick-cwd --adapter demo inspect repo"), {
    ok: true,
    adapter: "demo",
    pickCwd: true,
    task: "inspect repo",
  });
});

test("parseWorkerHistoryArgs accepts optional limit and all-scope flag", () => {
  assert.deepEqual(parseWorkerHistoryArgs("--limit 5"), {
    ok: true,
    limit: 5,
  });
  assert.deepEqual(parseWorkerHistoryArgs("--all --limit 5"), {
    ok: true,
    allScopes: true,
    limit: 5,
  });
  const singleDash = parseWorkerHistoryArgs("-all --limit 5");
  assert.equal(singleDash.ok, false);
  assert.match(singleDash.message, /Unknown worker-history option: -all/);
});

test("parseWorkerHistoryArgs defaults without arguments", () => {
  assert.deepEqual(parseWorkerHistoryArgs(""), { ok: true });
});

test("parseWorkerUiPocArgs accepts explicit safe PoC modes", () => {
  assert.deepEqual(parseWorkerUiPocArgs(""), { ok: true, mode: "all" });
  assert.deepEqual(parseWorkerUiPocArgs("widget"), { ok: true, mode: "widget" });
  assert.deepEqual(parseWorkerUiPocArgs("wide-widget"), { ok: true, mode: "wide-widget" });
  assert.deepEqual(parseWorkerUiPocArgs("card-widget"), { ok: true, mode: "card-widget" });
  assert.deepEqual(parseWorkerUiPocArgs("footer"), { ok: true, mode: "footer" });
  assert.deepEqual(parseWorkerUiPocArgs("cockpit"), { ok: true, mode: "cockpit" });
  assert.deepEqual(parseWorkerUiPocArgs("clear"), { ok: true, mode: "clear" });
});

test("createWorkerCardWidget renders original-style compact cards with useful metadata", () => {
  const widget = createWorkerCardWidget({
    entries: [
      makeHistoryEntry({
        runId: "run_card",
        adapter: "claude-code",
        profile: "reviewer",
        taskPreview: "review a compact widget layout",
        statusReason: "exit_zero",
        startedAt: 1000,
        endedAt: 6500,
        elapsedMs: 5500,
      }),
    ],
  });

  const lines = widget.render(100);
  const text = lines.join("\n");
  assert.ok(lines.some((line) => line.startsWith("┌─ run_card ✓ completed")));
  assert.ok(lines.some((line) => line.startsWith("│ adapter: claude-code")));
  assert.ok(lines.some((line) => line.includes("profile: reviewer")));
  assert.ok(lines.some((line) => line.includes("duration: 5s")));
  assert.ok(lines.some((line) => line.includes("task: review a compact widget layout")));
  assert.ok(lines.some((line) => line.includes("reason: exit_zero")));
  assert.ok(lines.some((line) => line.startsWith("└")));
  assert.match(text, /run_card/);
});

test("createWorkerCardWidget uses compact columns without a middle divider on wide terminals", () => {
  const widget = createWorkerCardWidget({
    entries: [
      makeHistoryEntry({ runId: "run_left", adapter: "demo", profile: "planner" }),
      makeHistoryEntry({ runId: "run_right", adapter: "codex-cli", profile: "reviewer" }),
    ],
  });

  const lines = widget.render(140);
  assert.ok(lines.some((line) => line.includes("run_left") && line.includes("┌─ run_right")));
  assert.equal(lines.some((line) => line.includes("│ ┌─ run_right")), false);
  assert.ok(lines.some((line) => line.includes("adapter: demo") && line.includes("adapter: codex-cli")));
  assert.ok(lines.some((line) => line.length < 120));
});

test("createWorkerCardWidget truncates long task and reason fields", () => {
  const widget = createWorkerCardWidget({
    entries: [
      makeHistoryEntry({
        taskPreview: "task ".repeat(40),
        statusReason: "reason ".repeat(40) as WorkerRunHistoryEntry["statusReason"],
      }),
    ],
  });

  const lines = widget.render(52);
  assert.ok(lines.every((line) => line.length <= 52));
  assert.ok(lines.some((line) => line.includes("task:") && line.includes("…")));
  assert.ok(lines.some((line) => line.includes("reason:") && line.includes("…")));
});

test("createWorkerCardWidget refreshes entries on an interval", async () => {
  let intervalMs = 0;
  let refresh: (() => void) | undefined;
  let cleared = false;
  let rendered = 0;
  const widget = createWorkerCardWidget({
    entries: [makeHistoryEntry({ runId: "run_before" })],
    refreshIntervalMs: WORKER_UI_POC_CARD_REFRESH_MS,
    loadEntries: async () => [makeHistoryEntry({ runId: "run_after" })],
    requestRender: () => {
      rendered += 1;
    },
    setIntervalFn: (callback, ms) => {
      intervalMs = ms;
      refresh = callback;
      return "timer";
    },
    clearIntervalFn: (timer) => {
      assert.equal(timer, "timer");
      cleared = true;
    },
  });

  assert.equal(intervalMs, WORKER_UI_POC_CARD_REFRESH_MS);
  refresh?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(widget.render(80).join("\n"), /run_after/);
  assert.equal(rendered, 1);
  widget.dispose?.();
  assert.equal(cleared, true);
});

test("parseWorkerUiPocArgs rejects unknown modes", () => {
  const parsed = parseWorkerUiPocArgs("side-panel");
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /Unknown worker-ui-poc mode/);
});

test("parseWorkerWaitArgs accepts run id and wait limit", () => {
  assert.deepEqual(parseWorkerWaitArgs("run_123 --wait-ms 5000"), {
    ok: true,
    runId: "run_123",
    waitMs: 5000,
  });
});

test("parseWorkerWaitArgs rejects missing run id", () => {
  const parsed = parseWorkerWaitArgs("--wait-ms 5000");
  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /Usage:/);
});

test("/worker-history requests current workspace scope by default and all scopes on demand", async () => {
  const { pi, commands } = createCommandRegistry();
  const calls: unknown[] = [];
  const service = {
    listRunHistory: async (options: unknown) => {
      calls.push(options);
      return [];
    },
  } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);

  await commands.get("worker-history")?.handler("--limit 1", {
    cwd: "/tmp/project",
    hasUI: false,
    ui: { notify: () => undefined },
  });
  await commands.get("worker-history")?.handler("--all --limit 2", {
    cwd: "/tmp/project",
    hasUI: false,
    ui: { notify: () => undefined },
  });

  assert.deepEqual(calls, [
    { limit: 1, cwd: "/tmp/project" },
    { limit: 2, allScopes: true },
  ]);
});

test("/worker-history explains empty current workspace scope", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const service = {
    listRunHistory: async () => [],
  } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);

  await commands.get("worker-history")?.handler("", {
    cwd: "/tmp/project",
    hasUI: false,
    ui: { notify: () => undefined },
  });

  assert.match(messages.join("\n"), /No worker run history for current workspace/);
  assert.match(messages.join("\n"), /--all/);
});

test("/worker-history applies workspace config history defaults", async () => {
  const { pi, commands } = createCommandRegistry();
  const configDir = await makeTempDir("command-history-config-dir");
  const workspace = await makeTempDir("command-history-config-workspace");
  const service = new AgentWorkerService({ defaultCwd: workspace, configDir });
  const calls: unknown[] = [];
  const fakeService = {
    ...service,
    listRunHistory: async (options: unknown) => {
      calls.push(options);
      return [];
    },
  } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, fakeService, { configDir });

  await commands.get("worker-config")?.handler("set historyScope all", {
    cwd: workspace,
    hasUI: false,
    ui: { notify: () => undefined },
  });
  await commands.get("worker-config")?.handler("set historyLimit 7", {
    cwd: workspace,
    hasUI: false,
    ui: { notify: () => undefined },
  });
  await commands.get("worker-history")?.handler("", {
    cwd: workspace,
    hasUI: false,
    ui: { notify: () => undefined },
  });

  assert.deepEqual(calls, [{ limit: 7, allScopes: true }]);
});

test("/worker-history shows recent historical run summaries", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const service = {
    listRunHistory: async () => [
      {
        runId: "run_history",
        status: "completed",
        adapter: "demo",
        mode: "custom",
        taskPreview: "history",
        cwd: "/tmp/project",
        startedAt: 1000,
        endedAt: 2000,
        elapsedMs: 1000,
        exitCode: 0,
        usage: { source: "unknown" },
        activity: [],
        logPath: "/tmp/log",
        controllable: false,
        historical: true,
      },
    ],
  } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);

  await commands.get("worker-history")?.handler("--limit 1", {
    cwd: "/tmp/project",
    hasUI: false,
    ui: { notify: () => undefined },
  });

  assert.match(messages.join("\n"), /run_history — completed — historical/);
  assert.match(messages.join("\n"), /controllable: false/);
});

test("/worker-config shows and updates workspace config", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const configDir = await makeTempDir("command-config-dir");
  const workspace = await makeTempDir("command-config-workspace");
  const service = new AgentWorkerService({ defaultCwd: workspace, configDir });
  registerAgentWorkerCommands(pi, service, { configDir });

  await commands.get("worker-config")?.handler("", {
    cwd: workspace,
    hasUI: false,
    ui: { notify: () => undefined },
  });
  await commands.get("worker-config")?.handler("set defaultProfile verifier", {
    cwd: workspace,
    hasUI: false,
    ui: { notify: () => undefined },
  });

  assert.match(messages.join("\n"), /Agent worker workspace config/);
  assert.match(messages.join("\n"), /defaultProfile: unset/);
  assert.match(messages.join("\n"), /Updated worker config/);
  assert.match(messages.join("\n"), /defaultProfile: verifier/);
});

test("/worker-run uses workspace config defaults for confirmation planning", async () => {
  const { pi, commands } = createCommandRegistry();
  const workspace = await makeTempDir("command-run-config-workspace");
  const calls: string[] = [];
  const service = {
    resolveCwd: (_cwd: string | undefined, fallback: string) => fallback,
    async resolveRequestWithConfig(request: { task: string }) {
      calls.push(`resolve:${request.task}`);
      return {
        adapter: "claude-code",
        profile: "verifier",
        mode: "review",
        task: request.task,
        cwd: workspace,
        requireConfirmation: true,
        readOnly: true,
        canModifyWorkspace: false,
      };
    },
    async start() {
      calls.push("start");
      return {
        id: "run_config",
        adapter: "claude-code",
        profile: "verifier",
        mode: "review",
        taskPreview: "check via config",
        cwd: workspace,
        status: "running",
        startedAt: 1000,
        logPath: "/tmp/log",
        usage: { source: "unknown" },
        activity: [],
      };
    },
  } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);

  await commands.get("worker-run")?.handler("check via config", {
    cwd: workspace,
    hasUI: true,
    ui: { notify: () => undefined, confirm: async () => false },
  });

  assert.deepEqual(calls, ["resolve:check via config"]);
});

test("/worker-ui-poc exercises widget component footer and custom overlay APIs", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const entries = [makeHistoryEntry({ runId: "run_poc" })];
  const service = { listRunHistory: async () => entries } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);
  const calls: string[] = [];

  await commands.get("worker-ui-poc")?.handler("all", {
    cwd: "/tmp/project",
    hasUI: true,
    ui: {
      setWidget: (_key: string, widget: unknown, options: unknown) => {
        calls.push(`widget:${typeof widget}:${JSON.stringify(options)}`);
      },
      setFooter: (footer: unknown) => {
        calls.push(`footer:${typeof footer}`);
      },
      custom: async (factory: unknown, options: unknown) => {
        calls.push(`custom:${typeof factory}:${JSON.stringify(options)}`);
        return "closed";
      },
      notify: (message: string) => messages.push(message),
    },
  });

  assert.ok(calls.some((call) => call.startsWith("widget:function")));
  assert.ok(calls.some((call) => call.startsWith("footer:function")));
  assert.ok(calls.some((call) => call.includes('"overlay":true')));
  assert.match(messages.join("\n"), /Worker UI PoC cockpit result: closed/);
  assert.match(messages.join("\n"), /mode: all/);
  assert.match(messages.join("\n"), /stress test/);
});

test("/worker-ui-poc wide-widget installs a width-aware component widget", async () => {
  const { pi, commands } = createCommandRegistry();
  const entries = [makeHistoryEntry({ runId: "run_wide_1" }), makeHistoryEntry({ runId: "run_wide_2" })];
  const service = { listRunHistory: async () => entries } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);
  const calls: string[] = [];

  await commands.get("worker-ui-poc")?.handler("wide-widget", {
    cwd: "/tmp/project",
    hasUI: true,
    ui: {
      setWidget: (_key: string, widget: unknown, options: unknown) => calls.push(`widget:${widget === undefined ? "true" : typeof widget}:${JSON.stringify(options)}`),
      notify: () => undefined,
    },
  });

  assert.deepEqual(calls, ["widget:true:undefined", 'widget:function:{"placement":"belowEditor"}']);
});

test("/worker-ui-poc card-widget installs interval-refreshing card widget", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const entries = [makeHistoryEntry({ runId: "run_card_cmd", adapter: "codex-cli", profile: "planner", elapsedMs: 10_000 })];
  const service = { listRunHistory: async () => entries } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);
  let factory: ((tui?: unknown) => { render(width: number): string[]; dispose?(): void }) | undefined;
  const calls: string[] = [];

  await commands.get("worker-ui-poc")?.handler("card-widget", {
    cwd: "/tmp/project",
    hasUI: true,
    ui: {
      setWidget: (_key: string, widget: unknown, options: unknown) => {
        calls.push(`widget:${widget === undefined ? "clear" : typeof widget}:${JSON.stringify(options)}`);
        if (typeof widget === "function") factory = widget as typeof factory;
      },
      setFooter: () => undefined,
      setStatus: () => undefined,
      notify: () => undefined,
    },
  });

  assert.deepEqual(calls, ["widget:clear:undefined", 'widget:function:{"placement":"belowEditor"}']);
  const component = factory?.({ requestRender: () => undefined });
  const text = component?.render(100).join("\n") ?? "";
  component?.dispose?.();
  assert.match(text, /run_card_cmd/);
  assert.match(text, /adapter: codex-cli/);
  assert.match(text, /profile: planner/);
  assert.match(messages.join("\n"), /refresh: 5s/);
});

test("/worker-ui-poc sidepanel uses right anchored overlay sizing options", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const entries = [makeHistoryEntry({ runId: "run_sidepanel" })];
  const service = { listRunHistory: async () => entries } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);
  const calls: string[] = [];

  await commands.get("worker-ui-poc")?.handler("sidepanel", {
    cwd: "/tmp/project",
    hasUI: true,
    ui: {
      setWidget: (_key: string, widget: unknown) => calls.push(`widget:${widget === undefined}`),
      setFooter: (footer: unknown) => calls.push(`footer:${footer === undefined}`),
      setStatus: (_key: string, value: unknown) => calls.push(`status:${value === undefined}`),
      custom: async (_factory: unknown, options: unknown) => {
        calls.push(JSON.stringify(options));
        return "closed";
      },
      notify: (message: string) => messages.push(message),
    },
  });

  assert.deepEqual(calls.slice(0, 3), ["widget:true", "footer:true", "status:true"]);
  assert.ok(calls[3]?.includes('"anchor":"right-center"'));
  assert.ok(calls[3]?.includes('"width":"38%"'));
  assert.ok(calls[3]?.includes('"maxHeight":"85%"'));
  assert.match(messages.join("\n"), /Worker UI PoC sidepanel result: closed/);
  assert.match(messages.join("\n"), /mode: sidepanel/);
});

test("/worker-ui-poc clear removes PoC surfaces", async () => {
  const { pi, commands } = createCommandRegistry();
  const service = { listRunHistory: async () => [] } as unknown as AgentWorkerService;
  registerAgentWorkerCommands(pi, service);
  const calls: string[] = [];

  await commands.get("worker-ui-poc")?.handler("clear", {
    cwd: "/tmp/project",
    hasUI: true,
    ui: {
      setWidget: (_key: string, widget: unknown) => calls.push(`widget:${widget === undefined}`),
      setFooter: (footer: unknown) => calls.push(`footer:${footer === undefined}`),
      setStatus: (_key: string, value: unknown) => calls.push(`status:${value === undefined}`),
      notify: () => undefined,
    },
  });

  assert.deepEqual(calls, ["widget:true", "footer:true", "status:true"]);
});

test("/worker-workspace-pick uses native select without setting sticky workspace", async () => {
  const { pi, commands, messages } = createCommandRegistry();
  const service = new AgentWorkerService();
  const workspace = await makeTempDir("command-workspace-pick");
  registerAgentWorkerCommands(pi, service);

  await commands.get("worker-workspace-pick")?.handler("", {
    cwd: workspace,
    hasUI: true,
    ui: {
      select: async (_title: string, choices: string[]) => {
        assert.ok(choices.includes(workspace));
        return workspace;
      },
      notify: () => undefined,
    },
  });

  assert.equal(messages.join("\n").includes("Picked worker workspace for copy/use"), true);
});

function createCommandRegistry(): {
  pi: ExtensionAPI;
  commands: Map<string, { handler: (args: string, ctx: any) => Promise<void> }>;
  messages: string[];
} {
  const commands = new Map<string, { handler: (args: string, ctx: any) => Promise<void> }>();
  const messages: string[] = [];
  return {
    commands,
    messages,
    pi: {
      registerCommand(name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
        commands.set(name, command);
      },
      on() {},
      sendMessage(message: { content?: string }) {
        messages.push(message.content ?? "");
      },
    } as unknown as ExtensionAPI,
  };
}

function makeHistoryEntry(overrides: Partial<WorkerRunHistoryEntry> = {}): WorkerRunHistoryEntry {
  return {
    runId: "run_history",
    status: "completed",
    statusReason: "exit_zero",
    adapter: "demo",
    taskPreview: "inspect UI possibilities",
    cwd: "/tmp/project",
    startedAt: 1000,
    endedAt: 2000,
    elapsedMs: 1000,
    usage: { source: "unknown" },
    activity: [],
    logPath: "/tmp/log",
    controllable: false,
    historical: true,
    ...overrides,
  };
}

async function makeTempDir(name: string): Promise<string> {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}
