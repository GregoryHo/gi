import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import type { ResolvedWorkerRequest, WorkerAdapterName, WorkerMode, WorkerRequest } from "../core/request-types.ts";
import { AgentWorkerService } from "../core/service.ts";
import type { WorkerRun } from "../core/worker-types.ts";
import { validateWorkerWorkspace } from "../state/workspaces.ts";

interface WorkerStartToolParams {
  profile?: string;
  adapter?: WorkerAdapterName;
  task: string;
  systemPrompt?: string;
  mode?: WorkerMode;
  cwd?: string;
  model?: string;
  timeoutMs?: number;
  requireConfirmation?: boolean;
}

interface WorkerStatusToolParams {
  runId?: string;
}

interface WorkerListRunsToolParams {
  limit?: number;
  scope?: "current" | "all";
}

interface WorkerWaitToolParams {
  runId: string;
  waitMs?: number;
}

interface WorkerCancelToolParams {
  runId: string;
}

interface ToolContextLike {
  cwd?: string;
  hasUI?: boolean;
  ui?: {
    confirm?(title: string, message: string): Promise<boolean>;
  };
}

export function registerAgentWorkerTools(pi: ExtensionAPI, service = new AgentWorkerService()): void {
  pi.registerTool({
    name: "agent_worker_start",
    label: "Agent Worker Start",
    description: "Start one agent worker through the generic agent-workers runtime. Domain-independent.",
    promptSnippet: "Delegate a bounded task to an agent worker using a profile or explicit adapter",
    promptGuidelines: [
      "Use agent_worker_start when the user explicitly asks to delegate work to Claude, Codex, or an agent worker.",
      "For Jira workflows, first use Jira tools to fetch issue context, then pass a generic task here; do not assume Jira-specific behavior in agent-workers.",
      "Ask the user before starting real Claude/Codex workers unless the user clearly requested worker delegation.",
      "Use planner or reviewer profiles for read-only planning/review style delegation.",
    ],
    parameters: Type.Object({
      profile: Type.Optional(Type.String({ description: "Optional worker profile, for example planner or reviewer." })),
      adapter: Type.Optional(
        StringEnum(["demo", "claude-code", "codex-cli", "pi-sdk"] as const, { description: "Optional explicit worker adapter." }),
      ),
      task: Type.String({ description: "Task or prompt to delegate to the worker." }),
      systemPrompt: Type.Optional(Type.String({ description: "Optional system prompt to wrap around the task." })),
      mode: Type.Optional(StringEnum(["plan", "review", "implement", "custom"] as const)),
      cwd: Type.Optional(Type.String({ description: "Optional working directory. Defaults to the current pi cwd." })),
      model: Type.Optional(Type.String({ description: "Optional model hint for future adapter support." })),
      timeoutMs: Type.Optional(Type.Number({ description: "Optional timeout hint for future adapter support." })),
      requireConfirmation: Type.Optional(
        Type.Boolean({ description: "Optional confirmation hint. Real adapters still require confirmation by default." }),
      ),
    }),
    async execute(_toolCallId, params: WorkerStartToolParams, _signal, _onUpdate, ctx: ToolContextLike) {
      const effectiveCwd = service.resolveCwd(params.cwd, ctx.cwd);
      const validation = validateWorkerWorkspace(effectiveCwd, { task: params.task });
      if (validation.errors.length > 0) {
        return toolResult("Worker workspace is invalid.", { cwd: effectiveCwd, errors: validation.errors });
      }

      const request: WorkerRequest = {
        profile: params.profile,
        adapter: params.adapter,
        task: params.task,
        systemPrompt: params.systemPrompt,
        mode: params.mode,
        cwd: effectiveCwd,
        model: params.model,
        timeoutMs: params.timeoutMs,
        requireConfirmation: params.requireConfirmation,
      };
      const resolved = await service.resolveRequestWithConfig(request);
      if (requiresConfirmation(resolved)) {
        const confirmed = await confirmWorkerStart(resolved, ctx);
        if (!confirmed) {
          return toolResult(`Canceled: worker ${resolved.adapter} was not confirmed.`, {
            cancelled: true,
            adapter: resolved.adapter,
          });
        }
      }

      const run = await service.start(request);
      const summary = workerRunSummary(run);
      return toolResult(`Started worker ${summary.runId} with ${summary.adapter}.`, {
        ...summary,
        ...(validation.warnings.length > 0 ? { warnings: validation.warnings } : {}),
      });
    },
  });

  pi.registerTool({
    name: "agent_worker_status",
    label: "Agent Worker Status",
    description: "Return compact status for one agent worker run or all known runs.",
    promptSnippet: "Check delegated agent worker status",
    promptGuidelines: [
      "Use agent_worker_status after starting a worker to check completion, usage, activity, and final text preview.",
      "Do not request raw logs unless the user explicitly asks; use the returned logPath as an artifact pointer.",
    ],
    parameters: Type.Object({
      runId: Type.Optional(Type.String({ description: "Optional worker run id. If omitted, all runs are returned." })),
    }),
    async execute(_toolCallId, params: WorkerStatusToolParams) {
      if (params.runId) {
        const run = service.getRun(params.runId);
        if (!run) return toolResult(`Unknown worker run: ${params.runId}`, { runId: params.runId, found: false });
        const summary = workerRunSummary(run);
        return toolResult(`Worker ${summary.runId} is ${summary.status}.`, { run: summary });
      }

      const runs = service.listRuns().map(workerRunSummary);
      return toolResult(`Found ${runs.length} worker run(s).`, { runs });
    },
  });

  pi.registerTool({
    name: "agent_worker_list_runs",
    label: "Agent Worker List Runs",
    description: "List recent agent worker runs, including historical informational summaries after restart.",
    promptSnippet: "List recent delegated agent worker runs",
    promptGuidelines: [
      "Use agent_worker_list_runs when the user asks for recent worker history or needs post-restart run visibility.",
      "Historical-only runs are informational; do not try to cancel or wait on runs where controllable is false.",
    ],
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "Optional maximum number of recent runs to return." })),
      scope: Type.Optional(
        StringEnum(["current", "all"] as const, {
          description: "History scope. Defaults to current workspace; use all for all workspaces.",
        }),
      ),
    }),
    async execute(_toolCallId, params: WorkerListRunsToolParams, _signal, _onUpdate, ctx: ToolContextLike) {
      const allScopes = params.scope === "all";
      const runs = await service.listRunHistory({
        ...(params.limit === undefined ? {} : { limit: params.limit }),
        ...(allScopes ? { allScopes: true } : { cwd: ctx.cwd }),
      });
      const message = runs.length === 0 && !allScopes
        ? `Found 0 recent worker run(s) for current workspace. Use scope: "all" to list all workspace history.`
        : `Found ${runs.length} recent worker run(s).`;
      return toolResult(message, { runs });
    },
  });

  pi.registerTool({
    name: "agent_worker_wait",
    label: "Agent Worker Wait",
    description: "Wait for one agent worker to complete, with an optional caller wait limit.",
    promptSnippet: "Wait for delegated agent worker completion",
    promptGuidelines: [
      "Use agent_worker_wait when you need a worker's final result before continuing.",
      "Use waitMs to avoid blocking indefinitely; a wait timeout does not cancel the worker.",
    ],
    parameters: Type.Object({
      runId: Type.String({ description: "Worker run id to wait for." }),
      waitMs: Type.Optional(Type.Number({ description: "Optional caller wait limit in milliseconds. Does not cancel the worker." })),
    }),
    async execute(_toolCallId, params: WorkerWaitToolParams) {
      const result = await service.waitForRun(params.runId, params.waitMs);
      const summary = workerRunSummary(result.run);
      return toolResult(
        result.completed ? `Worker ${summary.runId} completed with status ${summary.status}.` : `Worker ${summary.runId} is still ${summary.status}.`,
        { run: summary, completed: result.completed },
      );
    },
  });

  pi.registerTool({
    name: "agent_worker_cancel",
    label: "Agent Worker Cancel",
    description: "Cancel one running agent worker through the shared agent-workers runtime.",
    promptSnippet: "Cancel a delegated agent worker run",
    promptGuidelines: ["Use agent_worker_cancel when the user asks to stop or cancel a specific worker run."],
    parameters: Type.Object({
      runId: Type.String({ description: "Worker run id to cancel." }),
    }),
    async execute(_toolCallId, params: WorkerCancelToolParams) {
      const run = service.cancelRun(params.runId);
      const summary = workerRunSummary(run);
      return toolResult(`Worker ${summary.runId} is ${summary.status}.`, { run: summary });
    },
  });

  pi.registerTool({
    name: "agent_worker_list_profiles",
    label: "Agent Worker List Profiles",
    description: "List built-in and workspace custom agent worker profiles available for generic worker delegation.",
    promptSnippet: "List available agent worker profiles",
    promptGuidelines: [
      "Use agent_worker_list_profiles before choosing a profile when the user did not specify one.",
      "Profiles are generic; compose them with other extension tool results as needed.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx: ToolContextLike) {
      const profiles = await service.listProfiles(ctx.cwd);
      return toolResult(
        `Available worker profiles: ${profiles.map((profile) => profile.name).join(", ")}.`,
        { profiles },
      );
    },
  });
}

export function workerRunSummary(run: WorkerRun): Record<string, unknown> {
  return {
    runId: run.id,
    status: run.status,
    ...(run.statusReason ? { statusReason: run.statusReason } : {}),
    adapter: run.adapter,
    ...(run.profile ? { profile: run.profile } : {}),
    ...(run.mode ? { mode: run.mode } : {}),
    ...(run.slot === undefined ? {} : { slot: run.slot }),
    ...(run.readOnly === undefined ? {} : { readOnly: run.readOnly }),
    ...(run.canModifyWorkspace === undefined ? {} : { canModifyWorkspace: run.canModifyWorkspace }),
    ...(run.workspaceKey === undefined ? {} : { workspaceKey: run.workspaceKey }),
    ...(run.scopeKey === undefined ? {} : { scopeKey: run.scopeKey }),
    ...(run.scopeLabel === undefined ? {} : { scopeLabel: run.scopeLabel }),
    ...(run.gitRoot === undefined ? {} : { gitRoot: run.gitRoot }),
    taskPreview: run.taskPreview,
    ...(run.originalTaskPreview === undefined ? {} : { originalTaskPreview: run.originalTaskPreview }),
    cwd: run.cwd,
    ...(run.pid === undefined ? {} : { pid: run.pid }),
    startedAt: run.startedAt,
    ...(run.endedAt === undefined ? {} : { endedAt: run.endedAt }),
    elapsedMs: (run.endedAt ?? Date.now()) - run.startedAt,
    ...(run.lastActivityAt === undefined ? {} : { lastActivityAt: run.lastActivityAt }),
    ...(run.timeoutMs === undefined ? {} : { timeoutMs: run.timeoutMs }),
    ...(run.exitCode === undefined ? {} : { exitCode: run.exitCode }),
    usage: { ...run.usage },
    activity: [...(run.activity ?? [])],
    ...(run.finalTextPreview ? { finalText: run.finalTextPreview } : {}),
    logPath: run.logPath,
  };
}

function requiresConfirmation(request: ResolvedWorkerRequest): boolean {
  return request.requireConfirmation || request.adapter === "claude-code" || request.adapter === "codex-cli" || request.adapter === "pi-sdk";
}

async function confirmWorkerStart(request: ResolvedWorkerRequest, ctx: ToolContextLike): Promise<boolean> {
  if (!ctx.hasUI || !ctx.ui?.confirm) return false;
  return ctx.ui.confirm(
    "Start agent worker?",
    [
      `Adapter: ${request.adapter}`,
      request.profile ? `Profile: ${request.profile}` : undefined,
      `Workspace: ${request.cwd}`,
      ...validateWorkerWorkspace(request.cwd, { task: request.task }).warnings.map((warning) => `Warning: ${warning}`),
      "This will start a local external worker process in the selected working directory.",
      "The extension does not add permission/sandbox bypass flags, but the CLI may read or modify files according to its own policy.",
      "Continue?",
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  );
}

function toolResult(content: string, details: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: content }], details };
}
