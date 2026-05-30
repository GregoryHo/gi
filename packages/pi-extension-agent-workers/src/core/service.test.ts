import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { updateWorkspaceConfig } from "../config/index.ts";
import { AgentWorkerService, waitForRunWithLimit, workerResultFromRun } from "./service.ts";
import type { WorkerManager } from "./worker-manager.ts";
import type { WorkerRun } from "./worker-types.ts";

test("AgentWorkerService resolves profile requests without domain assumptions", () => {
  const service = new AgentWorkerService();
  const resolved = service.resolveRequest({ profile: "planner", task: "inspect the diff", cwd: "/tmp/project" });

  assert.equal(resolved.adapter, "claude-code");
  assert.equal(resolved.mode, "plan");
  assert.equal(resolved.cwd, "/tmp/project");
  assert.equal(resolved.requireConfirmation, true);
  assert.equal(resolved.profile, "planner");
  assert.match(resolved.task, /System prompt:/);
  assert.match(resolved.task, /User task:/);
  assert.match(resolved.task, /inspect the diff/);
});

test("AgentWorkerService resolves implementer and verifier profiles safely", () => {
  const service = new AgentWorkerService({ defaultCwd: "/tmp/project" });

  const implementer = service.resolveRequest({ profile: "implementer", task: "fix bug" });
  assert.equal(implementer.adapter, "claude-code");
  assert.equal(implementer.mode, "implement");
  assert.equal(implementer.requireConfirmation, true);
  assert.equal(implementer.profile, "implementer");
  assert.match(implementer.task, /minimal diffs/i);
  assert.match(implementer.task, /User task:\nfix bug/);

  const verifier = service.resolveRequest({ profile: "verifier", task: "check AC" });
  assert.equal(verifier.adapter, "claude-code");
  assert.equal(verifier.mode, "review");
  assert.equal(verifier.requireConfirmation, true);
  assert.match(verifier.task, /Do not modify files/i);
  assert.match(verifier.task, /acceptance criteria/i);
});

test("AgentWorkerService classifies profile and direct real-adapter safety", () => {
  const service = new AgentWorkerService({ defaultCwd: process.cwd() });

  const verifier = service.resolveRequest({ profile: "verifier", task: "verify" });
  assert.equal(verifier.readOnly, true);
  assert.equal(verifier.canModifyWorkspace, false);

  const implementer = service.resolveRequest({ profile: "implementer", task: "implement" });
  assert.equal(implementer.readOnly, false);
  assert.equal(implementer.canModifyWorkspace, true);

  const directReal = service.resolveRequest({ adapter: "claude-code", task: "custom" });
  assert.equal(directReal.readOnly, false);
  assert.equal(directReal.canModifyWorkspace, true);

  const demo = service.resolveRequest({ adapter: "demo", task: "demo" });
  assert.equal(demo.readOnly, true);
  assert.equal(demo.canModifyWorkspace, false);
});

test("AgentWorkerService resolves custom workspace profiles from config", async () => {
  const root = await makeTempDir("service-custom-profile");
  const configDir = join(root, "config");
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  await updateWorkspaceConfig(
    { configDir, scopeKey: workspace, scopeLabel: "workspace" },
    {
      profiles: [
        {
          name: "docs-checker",
          description: "Check docs only.",
          adapter: "demo",
          mode: "review",
          systemPrompt: "Review docs only.",
          requireConfirmation: false,
          readOnly: true,
          canModifyWorkspace: false,
          recommendedUse: "Use for docs review.",
        },
      ],
    },
  );
  const service = new AgentWorkerService({ defaultCwd: workspace, configDir });

  const resolved = await service.resolveRequestWithConfig({ profile: "docs-checker", task: "check README" });

  assert.equal(resolved.profile, "docs-checker");
  assert.equal(resolved.adapter, "demo");
  assert.equal(resolved.mode, "review");
  assert.equal(resolved.readOnly, true);
  assert.equal(resolved.canModifyWorkspace, false);
  assert.match(resolved.task, /Review docs only/);
});

test("AgentWorkerService lists built-in and custom workspace profiles", async () => {
  const root = await makeTempDir("service-list-custom-profiles");
  const configDir = join(root, "config");
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  await updateWorkspaceConfig(
    { configDir, scopeKey: workspace, scopeLabel: "workspace" },
    {
      profiles: [
        {
          name: "write-docs",
          description: "Write docs.",
          adapter: "claude-code",
          mode: "implement",
          systemPrompt: "Update docs only.",
          requireConfirmation: true,
          readOnly: false,
          canModifyWorkspace: true,
          recommendedUse: "Use for bounded docs edits.",
        },
      ],
    },
  );
  const service = new AgentWorkerService({ defaultCwd: workspace, configDir });

  const profiles = await service.listProfiles(workspace);

  assert.ok(profiles.some((profile) => profile.name === "planner"));
  const custom = profiles.find((profile) => profile.name === "write-docs");
  assert.equal(custom?.canModifyWorkspace, true);
  assert.equal(custom?.requireConfirmation, true);
});

test("AgentWorkerService applies workspace config defaults without weakening explicit requests", async () => {
  const root = await makeTempDir("service-config");
  const configDir = join(root, "config");
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  await updateWorkspaceConfig(
    { configDir, scopeKey: workspace, scopeLabel: "workspace" },
    { defaultProfile: "verifier", defaultAdapter: "codex-cli", defaultTimeoutMs: 1234 },
  );
  const service = new AgentWorkerService({ defaultCwd: workspace, configDir });

  const configured = await service.resolveRequestWithConfig({ task: "check" });
  assert.equal(configured.profile, "verifier");
  assert.equal(configured.adapter, "claude-code");
  assert.equal(configured.timeoutMs, 1234);
  assert.equal(configured.requireConfirmation, true);

  const explicit = await service.resolveRequestWithConfig({ task: "check", adapter: "demo", timeoutMs: 999 });
  assert.equal(explicit.adapter, "demo");
  assert.equal(explicit.timeoutMs, 999);
});

test("AgentWorkerService lets direct request override profile fields", () => {
  const service = new AgentWorkerService();
  const resolved = service.resolveRequest({
    profile: "planner",
    adapter: "codex-cli",
    mode: "custom",
    systemPrompt: "Use this specific instruction.",
    task: "answer",
    requireConfirmation: false,
  });

  assert.equal(resolved.adapter, "codex-cli");
  assert.equal(resolved.mode, "custom");
  assert.equal(resolved.requireConfirmation, false);
  assert.match(resolved.task, /Use this specific instruction/);
});

test("AgentWorkerService resolveCwd is per-run and has no selected workspace fallback", () => {
  const service = new AgentWorkerService({ defaultCwd: "/tmp/default" });

  assert.equal(service.resolveCwd(undefined, "/tmp/current"), "/tmp/current");
  assert.equal(service.resolveCwd("/tmp/explicit", "/tmp/current"), "/tmp/explicit");
});

test("waitForRunWithLimit reports caller wait timeout without cancelling the run", async () => {
  const pending = new Promise<WorkerRun>(() => undefined);
  const currentRun: WorkerRun = {
    id: "run_wait",
    adapter: "demo",
    taskPreview: "wait",
    cwd: "/tmp/project",
    status: "running",
    startedAt: 1000,
    lastActivityAt: 1100,
    logPath: "/tmp/log",
    usage: { source: "unknown" },
    activity: [],
  };

  const result = await waitForRunWithLimit(pending, () => currentRun, 5);

  assert.equal(result.completed, false);
  assert.equal(result.run.status, "running");
});

test("AgentWorkerService starts profile runs with original task preview metadata", async () => {
  let startInput: Record<string, unknown> | undefined;
  const manager = {
    startRun: async (input: Record<string, unknown>) => {
      startInput = input;
      return makeServiceRun({ taskPreview: input.taskPreview as string });
    },
  } as unknown as WorkerManager;
  const service = new AgentWorkerService({ manager });

  await service.start({ profile: "reviewer", task: "Review WIN-123 diff", cwd: process.cwd() });

  assert.match(startInput?.task as string, /^System prompt:/);
  assert.equal(startInput?.taskPreview, "Review WIN-123 diff");
});

test("AgentWorkerService starts runs with workspace scope metadata", async () => {
  const root = await makeTempDir("service-scope");
  const repo = join(root, "repo");
  const nested = join(repo, "packages", "app");
  await mkdir(join(repo, ".git"), { recursive: true });
  await mkdir(nested, { recursive: true });

  let startInput: Record<string, unknown> | undefined;
  const manager = {
    startRun: async (input: Record<string, unknown>) => {
      startInput = input;
      return makeServiceRun({ cwd: input.cwd as string });
    },
  } as unknown as WorkerManager;
  const service = new AgentWorkerService({ manager });

  await service.start({ adapter: "demo", task: "scope me", cwd: nested });

  assert.equal(startInput?.scopeKey, repo);
  assert.equal(startInput?.scopeLabel, "repo");
  assert.equal(startInput?.gitRoot, repo);
  assert.equal(startInput?.workspaceKey, repo);
});

test("AgentWorkerService defaults history listing to current workspace scope", async () => {
  const root = await makeTempDir("service-history-scope");
  const repo = join(root, "repo");
  const nested = join(repo, "packages", "app");
  await mkdir(join(repo, ".git"), { recursive: true });
  await mkdir(nested, { recursive: true });

  const historyOptions: unknown[] = [];
  const manager = {
    listRunHistory: async (options: unknown) => {
      historyOptions.push(options);
      return [];
    },
  } as unknown as WorkerManager;
  const service = new AgentWorkerService({ manager });

  await service.listRunHistory({ limit: 5, cwd: nested });
  await service.listRunHistory({ limit: 10, allScopes: true, cwd: nested });

  assert.deepEqual(historyOptions, [
    { limit: 5, scopeKey: repo },
    { limit: 10, allScopes: true },
  ]);
});

test("AgentWorkerService lists historical-only runs as informational after restart", async () => {
  const historicalRun: WorkerRun = {
    id: "run_historical",
    adapter: "demo",
    taskPreview: "historical",
    cwd: "/tmp/project",
    status: "completed",
    startedAt: 1000,
    endedAt: 2000,
    exitCode: 0,
    logPath: "/tmp/log",
    usage: { source: "unknown" },
    activity: [],
  };
  const manager = {
    getRun: () => undefined,
    listRuns: () => [],
    listRunHistory: async () => [{
      runId: historicalRun.id,
      status: historicalRun.status,
      adapter: historicalRun.adapter,
      taskPreview: historicalRun.taskPreview,
      cwd: historicalRun.cwd,
      startedAt: historicalRun.startedAt,
      endedAt: historicalRun.endedAt,
      elapsedMs: 1000,
      exitCode: 0,
      usage: historicalRun.usage,
      activity: [],
      logPath: historicalRun.logPath,
      controllable: false,
      historical: true,
    }],
  } as unknown as WorkerManager;
  const service = new AgentWorkerService({ manager });

  const history = await service.listRunHistory();

  assert.equal(history[0]?.runId, "run_historical");
  assert.equal(history[0]?.historical, true);
  assert.equal(history[0]?.controllable, false);
});

test("workerResultFromRun includes original task preview when available", () => {
  const run = makeServiceRun({ originalTaskPreview: "Review WIN-123 diff" });

  const result = workerResultFromRun(run);

  assert.equal(result.originalTaskPreview, "Review WIN-123 diff");
});

test("workerResultFromRun includes workspace scope metadata", () => {
  const run = makeServiceRun({
    scopeKey: "/tmp/project",
    scopeLabel: "project",
    gitRoot: "/tmp/project",
  });

  const result = workerResultFromRun(run);

  assert.equal(result.scopeKey, "/tmp/project");
  assert.equal(result.scopeLabel, "project");
  assert.equal(result.gitRoot, "/tmp/project");
});

test("workerResultFromRun returns rich compact public result without raw event payloads", () => {
  const run: WorkerRun = {
    id: "run_123",
    adapter: "codex-cli",
    taskPreview: "task",
    cwd: "/tmp/project",
    pid: 12345,
    status: "completed",
    startedAt: 1000,
    endedAt: 2000,
    exitCode: 0,
    logPath: "/tmp/log",
    usage: { source: "reported", inputTokens: 1, outputTokens: 2 },
    activity: ["codex turn completed"],
    finalTextPreview: "OK",
  };

  assert.deepEqual(workerResultFromRun(run, { metadata: { source: "test" } }), {
    runId: "run_123",
    status: "completed",
    adapter: "codex-cli",
    taskPreview: "task",
    cwd: "/tmp/project",
    pid: 12345,
    startedAt: 1000,
    endedAt: 2000,
    elapsedMs: 1000,
    exitCode: 0,
    finalText: "OK",
    usage: { source: "reported", inputTokens: 1, outputTokens: 2 },
    activity: ["codex turn completed"],
    logPath: "/tmp/log",
    metadata: { source: "test" },
  });
});

function makeServiceRun(overrides: Partial<WorkerRun> = {}): WorkerRun {
  return {
    id: "run_service",
    adapter: "demo",
    taskPreview: "task",
    cwd: "/tmp/project",
    status: "running",
    startedAt: 1000,
    logPath: "/tmp/log",
    usage: { source: "unknown" },
    activity: [],
    ...overrides,
  };
}

async function makeTempDir(name: string): Promise<string> {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return root;
}
