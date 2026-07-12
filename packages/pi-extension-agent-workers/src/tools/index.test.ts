import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { ResolvedWorkerRequest, WorkerRequest } from "../core/request-types.ts";
import type { AgentWorkerService } from "../core/service.ts";
import { registerAgentWorkerTools } from "./index.ts";
import type { WorkerRun } from "../core/worker-types.ts";

interface RegisteredTool {
  name: string;
  description?: string;
  promptGuidelines?: string[];
  parameters?: Record<string, unknown>;
  execute: (...args: unknown[]) => Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }>;
}

test("registerAgentWorkerTools registers the M5 tool facade", () => {
  const { pi, tools } = createToolRegistry();

  registerAgentWorkerTools(pi, createFakeService());

  assert.deepEqual([...tools.keys()].sort(), [
    "agent_worker_cancel",
    "agent_worker_list_profiles",
    "agent_worker_list_runs",
    "agent_worker_start",
    "agent_worker_status",
    "agent_worker_wait",
  ]);
  assert.match(tools.get("agent_worker_start")?.description ?? "", /Start one agent worker/);
  assert.ok(tools.get("agent_worker_start")?.promptGuidelines?.some((line) => line.includes("Jira")));
});

test("registerAgentWorkerTools uses Google-compatible string enum schemas", () => {
  const { pi, tools } = createToolRegistry();

  registerAgentWorkerTools(pi, createFakeService());

  assert.deepEqual(getToolStringEnum(tools.get("agent_worker_start"), "adapter"), ["demo", "claude-code", "codex-cli", "pi-sdk"]);
  assert.deepEqual(getToolStringEnum(tools.get("agent_worker_start"), "mode"), ["plan", "review", "implement", "custom"]);
  assert.deepEqual(getToolStringEnum(tools.get("agent_worker_list_runs"), "scope"), ["current", "all"]);
});

test("agent_worker_start starts a demo worker and returns compact details", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService();
  const cwd = await makeTempDir("tool-demo");
  registerAgentWorkerTools(pi, service);

  const result = await executeTool(tools.get("agent_worker_start"), { adapter: "demo", task: "hello", cwd });

  assert.equal(result.details.runId, "run_tool");
  assert.equal(result.details.status, "running");
  assert.equal(result.details.adapter, "demo");
  assert.equal(result.details.cwd, cwd);
  assert.equal(result.details.logPath, "/tmp/log");
  assert.equal(result.details.pid, 1234);
  assert.equal(typeof result.details.elapsedMs, "number");
  assert.equal("rawEvents" in result.details, false);
});

test("agent_worker_start uses workspace config defaults for confirmation planning", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService({ resolvedFromConfig: { adapter: "claude-code", profile: "verifier", requireConfirmation: true } });
  const cwd = await makeTempDir("tool-config-confirm");
  registerAgentWorkerTools(pi, service);
  const messages: string[] = [];

  const result = await executeTool(
    tools.get("agent_worker_start"),
    { task: "check via config", cwd },
    { cwd, hasUI: true, ui: { confirm: async (_title: string, message: string) => { messages.push(message); return false; } } },
  );

  assert.equal(result.details.cancelled, true);
  assert.match(messages.join("\n"), /Profile: verifier/);
  assert.equal(service.startCalls.length, 0);
});

test("agent_worker_start requires confirmation for real adapters and shows effective cwd", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService({ requireConfirmation: true });
  const cwd = await makeTempDir("tool-confirm");
  registerAgentWorkerTools(pi, service);
  const messages: string[] = [];

  const result = await executeTool(
    tools.get("agent_worker_start"),
    { adapter: "codex-cli", task: "hello", cwd },
    { hasUI: true, ui: { confirm: async (_title: string, message: string) => { messages.push(message); return false; } } },
  );

  assert.equal(result.details.cancelled, true);
  assert.match(messages.join("\n"), new RegExp(`Workspace: ${escapeRegExp(cwd)}`));
  assert.equal(service.startCalls.length, 0);
});

test("agent_worker_status and wait expose bounded final results to the model", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService({ finalText: "worker final result" });
  registerAgentWorkerTools(pi, service);

  const status = await executeTool(tools.get("agent_worker_status"), { runId: "run_tool" });
  assert.match(status.content[0]?.text ?? "", /worker final result/);

  const waited = await executeTool(tools.get("agent_worker_wait"), { runId: "run_tool", waitMs: 1000 });
  assert.match(waited.content[0]?.text ?? "", /worker final result/);

  const oversized = createFakeService({ finalText: "x".repeat(20_000), finalTextPath: "/private/full-result.txt" });
  const oversizedRegistry = createToolRegistry();
  registerAgentWorkerTools(oversizedRegistry.pi, oversized);
  const bounded = await executeTool(oversizedRegistry.tools.get("agent_worker_wait"), { runId: "run_tool" });
  assert.ok((bounded.content[0]?.text.length ?? 0) < 10_000);
  assert.match(bounded.content[0]?.text ?? "", /truncated/i);
  assert.match(bounded.content[0]?.text ?? "", /\/private\/full-result\.txt/);
});

test("agent_worker_status, agent_worker_wait, and agent_worker_cancel use the shared service", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService();
  registerAgentWorkerTools(pi, service);

  const status = await executeTool(tools.get("agent_worker_status"), { runId: "run_tool" });
  assert.equal((status.details.run as Record<string, unknown>).runId, "run_tool");

  const allStatus = await executeTool(tools.get("agent_worker_status"), {});
  assert.equal((allStatus.details.runs as unknown[]).length, 1);

  const waited = await executeTool(tools.get("agent_worker_wait"), { runId: "run_tool", waitMs: 1000 });
  assert.equal((waited.details.run as Record<string, unknown>).runId, "run_tool");
  assert.equal(waited.details.completed, true);
  assert.deepEqual(service.waitCalls, [{ id: "run_tool", waitMs: 1000 }]);

  const cancelled = await executeTool(tools.get("agent_worker_cancel"), { runId: "run_tool" });
  assert.equal((cancelled.details.run as Record<string, unknown>).status, "cancelled");
  assert.deepEqual(service.cancelCalls, ["run_tool"]);
});

test("agent_worker_list_runs exposes recent history scoped to current cwd by default", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService();
  registerAgentWorkerTools(pi, service);

  const result = await executeTool(tools.get("agent_worker_list_runs"), { limit: 1 }, { cwd: "/tmp/project", hasUI: false, ui: {} });

  const runs = result.details.runs as Array<Record<string, unknown>>;
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.runId, "run_tool");
  assert.equal(runs[0]?.controllable, true);
  assert.deepEqual(service.historyCalls, [{ limit: 1, cwd: "/tmp/project" }]);
});

test("agent_worker_list_runs explains empty current workspace scope", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService({ history: [] });
  registerAgentWorkerTools(pi, service);

  const result = await executeTool(tools.get("agent_worker_list_runs"), {}, { cwd: "/tmp/project", hasUI: false, ui: {} });

  assert.match(result.content[0]?.text ?? "", /current workspace/);
  assert.match(result.content[0]?.text ?? "", /scope.*all/);
});

test("agent_worker_list_runs can request all workspace history", async () => {
  const { pi, tools } = createToolRegistry();
  const service = createFakeService();
  registerAgentWorkerTools(pi, service);

  await executeTool(tools.get("agent_worker_list_runs"), { limit: 2, scope: "all" }, { cwd: "/tmp/project", hasUI: false, ui: {} });

  assert.deepEqual(service.historyCalls, [{ limit: 2, allScopes: true }]);
});

test("agent_worker_list_profiles exposes expanded safe metadata", async () => {
  const { pi, tools } = createToolRegistry();
  registerAgentWorkerTools(pi, createFakeService());

  const result = await executeTool(tools.get("agent_worker_list_profiles"), {});
  const profiles = result.details.profiles as Array<{ name: string; readOnly?: boolean; canModifyWorkspace?: boolean; recommendedUse?: string }>;

  assert.ok(profiles.some((profile) => profile.name === "planner"));
  assert.ok(profiles.some((profile) => profile.name === "reviewer"));
  assert.ok(profiles.some((profile) => profile.name === "implementer" && profile.canModifyWorkspace === true));
  assert.ok(profiles.some((profile) => profile.name === "verifier" && profile.readOnly === true));
});

test("agent_worker_list_profiles includes workspace custom profiles", async () => {
  const { pi, tools } = createToolRegistry();
  registerAgentWorkerTools(pi, createFakeService({ customProfiles: [{ name: "docs-checker", readOnly: true, canModifyWorkspace: false, recommendedUse: "Use for docs." }] }));

  const result = await executeTool(tools.get("agent_worker_list_profiles"), {}, { cwd: "/tmp/project", hasUI: false, ui: {} });
  const profiles = result.details.profiles as Array<{ name: string; readOnly?: boolean; canModifyWorkspace?: boolean }>;

  assert.ok(profiles.some((profile) => profile.name === "planner"));
  assert.ok(profiles.some((profile) => profile.name === "docs-checker" && profile.readOnly === true));
});

function createToolRegistry(): { pi: ExtensionAPI; tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();
  return {
    tools,
    pi: {
      registerTool(tool: RegisteredTool) {
        tools.set(tool.name, tool);
      },
    } as unknown as ExtensionAPI,
  };
}

function createFakeService(options: { requireConfirmation?: boolean; history?: Array<Record<string, unknown>>; resolvedFromConfig?: { adapter?: WorkerRequest["adapter"]; profile?: string; requireConfirmation?: boolean }; customProfiles?: Array<Record<string, unknown>>; finalText?: string; finalTextPath?: string } = {}): AgentWorkerService & {
  startCalls: WorkerRequest[];
  cancelCalls: string[];
  waitCalls: Array<{ id: string; waitMs?: number }>;
  historyCalls: unknown[];
} {
  const run: WorkerRun = {
    id: "run_tool",
    adapter: "demo",
    taskPreview: "hello",
    cwd: "/tmp/project",
    pid: 1234,
    status: "running",
    startedAt: 1000,
    logPath: "/tmp/log",
    usage: { source: "unknown" },
    activity: ["demo started"],
	...(options.finalText ? { finalText: options.finalText, finalTextPreview: options.finalText.slice(0, 200) } : {}),
	...(options.finalTextPath ? { finalTextPath: options.finalTextPath } : {}),
  };
  const startCalls: WorkerRequest[] = [];
  const cancelCalls: string[] = [];
  const waitCalls: Array<{ id: string; waitMs?: number }> = [];
  const historyCalls: unknown[] = [];

  const resolveRequestWithConfig = (request: WorkerRequest): ResolvedWorkerRequest => {
    const adapter = options.resolvedFromConfig?.adapter ?? request.adapter ?? "demo";
    return {
      adapter,
      ...(options.resolvedFromConfig?.profile ?? request.profile ? { profile: options.resolvedFromConfig?.profile ?? request.profile } : {}),
      mode: request.mode ?? "custom",
      task: request.task,
      cwd: request.cwd ?? "/tmp/project",
      requireConfirmation: options.resolvedFromConfig?.requireConfirmation ?? options.requireConfirmation ?? false,
      readOnly: adapter !== "claude-code" && adapter !== "codex-cli" && adapter !== "pi-sdk",
      canModifyWorkspace: adapter === "claude-code" || adapter === "codex-cli" || adapter === "pi-sdk",
    };
  };

  return {
    startCalls,
    cancelCalls,
    waitCalls,
    historyCalls,
    resolveCwd(cwd?: string): string {
      return cwd ?? "/tmp/project";
    },
    resolveRequest: resolveRequestWithConfig,
    resolveRequestWithConfig,
    async start(request: WorkerRequest): Promise<WorkerRun> {
      startCalls.push(request);
      return { ...run, adapter: request.adapter ?? "demo", taskPreview: request.task, cwd: request.cwd ?? "/tmp/project" };
    },
    getRun(id: string): WorkerRun | undefined {
      return id === run.id ? { ...run } : undefined;
    },
    listRuns(): WorkerRun[] {
      return [{ ...run }];
    },
    async listProfiles(_cwd?: string) {
      return [
        { name: "planner", description: "Planner", adapter: "claude-code", mode: "plan", requireConfirmation: true, readOnly: true, canModifyWorkspace: false, recommendedUse: "Use for planning." },
        { name: "reviewer", description: "Reviewer", adapter: "claude-code", mode: "review", requireConfirmation: true, readOnly: true, canModifyWorkspace: false, recommendedUse: "Use for review." },
        { name: "implementer", description: "Implementer", adapter: "claude-code", mode: "implement", requireConfirmation: true, readOnly: false, canModifyWorkspace: true, recommendedUse: "Use for implementation." },
        { name: "verifier", description: "Verifier", adapter: "claude-code", mode: "review", requireConfirmation: true, readOnly: true, canModifyWorkspace: false, recommendedUse: "Use for verification." },
        ...(options.customProfiles ?? []),
      ];
    },
    async listRunHistory(optionsInput?: unknown) {
      historyCalls.push(optionsInput);
      return options.history ?? [{ ...run, runId: run.id, elapsedMs: 0, controllable: true, historical: false }];
    },
    async waitForRun(id: string, waitMs?: number): Promise<{ run: WorkerRun; completed: boolean }> {
      waitCalls.push({ id, ...(waitMs === undefined ? {} : { waitMs }) });
      return { run: { ...run, status: "completed", endedAt: run.startedAt }, completed: true };
    },
    cancelRun(id: string): WorkerRun {
      cancelCalls.push(id);
      return { ...run, status: "cancelled" };
    },
  } as unknown as AgentWorkerService & {
    startCalls: WorkerRequest[];
    cancelCalls: string[];
    waitCalls: Array<{ id: string; waitMs?: number }>;
    historyCalls: unknown[];
  };
}

function getToolStringEnum(tool: RegisteredTool | undefined, propertyName: string): string[] {
  assert.ok(tool, "tool should be registered");
  const properties = (tool.parameters?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const property = properties[propertyName];
  assert.ok(property, `${propertyName} schema should exist`);
  assert.equal(property.type, "string");
  assert.equal("anyOf" in property, false);
  return property.enum as string[];
}

async function executeTool(tool: RegisteredTool | undefined, params: Record<string, unknown>, ctx: unknown = { hasUI: false, ui: {} }) {
  assert.ok(tool, "tool should be registered");
  return tool.execute("tool_call", params, new AbortController().signal, () => undefined, ctx);
}

async function makeTempDir(name: string): Promise<string> {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
