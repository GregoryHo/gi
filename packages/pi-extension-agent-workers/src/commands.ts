import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { readWorkspaceConfig, updateWorkspaceConfig, validateWorkspaceConfigPatch, type WorkspaceAgentWorkerConfig } from "./config.ts";
import { readLogTail } from "./logs.ts";
import type { ResolvedWorkerRequest, WorkerAdapterName } from "./request-types.ts";
import { AgentWorkerService } from "./service.ts";
import {
  discoverWorkspaceCandidates,
  formatWorkspacePreflightLines,
  formatWorkspaceStatusLines,
  normalizeWorkspacePath,
  resolveWorkspaceScope,
  validateWorkerWorkspace,
} from "./workspaces.ts";
import type { WorkerRun, WorkerRunHistoryEntry } from "./worker-types.ts";

const PACKAGE_KEY = "agent-workers";
const DEFAULT_LOG_TAIL_LINES = 40;
const MAX_DEMO_DURATION_MS = 60_000;
const MAX_WORKER_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

export type ParsedWorkerRunArgs =
  | {
      ok: true;
      adapter?: WorkerAdapterName;
      profile?: string;
      task: string;
      durationMs?: number;
      timeoutMs?: number;
      cwd?: string;
      pickCwd?: boolean;
      confirmedRealWorker?: boolean;
    }
  | { ok: false; message: string };

export type ParsedWorkerWaitArgs =
  | { ok: true; runId: string; waitMs?: number }
  | { ok: false; message: string };

export type ParsedWorkerHistoryArgs =
  | { ok: true; limit?: number; allScopes?: boolean }
  | { ok: false; message: string };

export function parseWorkerRunArgs(args: string): ParsedWorkerRunArgs {
  const trimmed = args.trim();
  if (!trimmed) return workerRunUsage();

  const parts = trimmed.split(/\s+/);
  let adapter: string | undefined;
  let profile: string | undefined;
  let durationMs: number | undefined;
  let timeoutMs: number | undefined;
  let cwd: string | undefined;
  let pickCwd = false;
  let confirmedRealWorker = false;
  let index = 0;

  while (index < parts.length) {
    const flag = parts[index];
    if (flag === "--adapter") {
      adapter = parts[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (flag === "--profile") {
      profile = parts[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (flag === "--yes") {
      confirmedRealWorker = true;
      index += 1;
      continue;
    }
    if (flag === "--cwd") {
      cwd = parts[index + 1] ?? "";
      if (!cwd) return { ok: false, message: "--cwd requires a path." };
      index += 2;
      continue;
    }
    if (flag === "--pick-cwd") {
      pickCwd = true;
      index += 1;
      continue;
    }
    if (flag === "--duration-ms") {
      const rawDuration = parts[index + 1] ?? "";
      durationMs = Number(rawDuration);
      if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > MAX_DEMO_DURATION_MS) {
        return { ok: false, message: `--duration-ms must be between 1 and ${MAX_DEMO_DURATION_MS}.` };
      }
      index += 2;
      continue;
    }
    if (flag === "--timeout-ms") {
      const rawTimeout = parts[index + 1] ?? "";
      timeoutMs = Number(rawTimeout);
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_WORKER_TIMEOUT_MS) {
        return { ok: false, message: `--timeout-ms must be between 1 and ${MAX_WORKER_TIMEOUT_MS}.` };
      }
      index += 2;
      continue;
    }
    break;
  }

  if (adapter !== undefined && !isWorkerAdapterName(adapter)) {
    return { ok: false, message: `Unknown adapter: ${adapter}. Available adapters: demo, claude-code, codex-cli.` };
  }

  const task = parts.slice(index).join(" ").trim();
  if (!task) return workerRunUsage();
  return {
    ok: true,
    ...(adapter === undefined && profile === undefined ? { adapter: "demo" as const } : {}),
    ...(adapter === undefined ? {} : { adapter }),
    ...(profile === undefined ? {} : { profile }),
    task,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(pickCwd ? { pickCwd } : {}),
    ...(confirmedRealWorker ? { confirmedRealWorker } : {}),
  };
}

export function parseWorkerHistoryArgs(args: string): ParsedWorkerHistoryArgs {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  let limit: number | undefined;
  let allScopes = false;
  let index = 0;
  while (index < parts.length) {
    const flag = parts[index];
    if (flag === "--all") {
      allScopes = true;
      index += 1;
      continue;
    }
    if (flag === "--limit") {
      const rawLimit = parts[index + 1] ?? "";
      limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return { ok: false, message: "--limit must be between 1 and 100." };
      }
      index += 2;
      continue;
    }
    return { ok: false, message: `Unknown worker-history option: ${flag}` };
  }
  return { ok: true, ...(limit === undefined ? {} : { limit }), ...(allScopes ? { allScopes } : {}) };
}

export function parseWorkerWaitArgs(args: string): ParsedWorkerWaitArgs {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const runId = parts[0] ?? "";
  if (!runId || runId.startsWith("--")) return workerWaitUsage();

  let waitMs: number | undefined;
  let index = 1;
  while (index < parts.length) {
    const flag = parts[index];
    if (flag === "--wait-ms") {
      const rawWait = parts[index + 1] ?? "";
      waitMs = Number(rawWait);
      if (!Number.isInteger(waitMs) || waitMs < 1 || waitMs > MAX_WAIT_MS) {
        return { ok: false, message: `--wait-ms must be between 1 and ${MAX_WAIT_MS}.` };
      }
      index += 2;
      continue;
    }
    return { ok: false, message: `Unknown worker-wait option: ${flag}` };
  }

  return { ok: true, runId, ...(waitMs === undefined ? {} : { waitMs }) };
}

export function getAgentWorkersHelpLines(): string[] {
  return [
    "Agent workers extension is loaded.",
    "Worker commands:",
    "  /worker-workspace",
    "  /worker-workspace-pick",
    "  /worker-run --cwd <path> [--adapter demo|claude-code|codex-cli] <task>",
    "  /worker-run --pick-cwd [--adapter demo|claude-code|codex-cli] <task>",
    "  /worker-run --timeout-ms <ms> [--adapter demo|claude-code|codex-cli] <task>",
    "  /worker-run --profile planner <task>",
    "  /worker-run --profile reviewer <task>",
    "  /worker-run --profile implementer <task>",
    "  /worker-run --profile verifier <task>",
    "  /worker-run [--adapter demo] [--duration-ms 10000] <task>",
    "  /worker-run --adapter claude-code <task>",
    "  /worker-run --adapter codex-cli <task>",
    "  /worker-status [id]",
    "  /worker-history [--all] [--limit <n>]",
    "  /worker-wait <id> [--wait-ms <ms>]",
    "  /worker-log <id>",
    "  /worker-kill <id>",
    "Real worker adapters require explicit confirmation in UI or --yes in non-UI mode.",
    "Safety: no arbitrary shell command execution; real adapters use shell: false and no bypass flags.",
    "Missing usage remains usage.source = unknown",
  ];
}

export function formatWorkerRunLines(run: WorkerRun, now = Date.now()): string[] {
  const elapsedSeconds = Math.max(0, Math.round(((run.endedAt ?? now) - run.startedAt) / 1000));
  const lines = [
    `${run.id} — ${run.status}`,
    `adapter: ${run.adapter}`,
    ...(run.profile ? [`profile: ${run.profile}`] : []),
    ...(run.mode ? [`mode: ${run.mode}`] : []),
    ...(run.slot === undefined ? [] : [`slot: ${run.slot}`]),
    ...(run.readOnly === undefined ? [] : [`readOnly: ${run.readOnly}`]),
    ...(run.canModifyWorkspace === undefined ? [] : [`canModifyWorkspace: ${run.canModifyWorkspace}`]),
    ...(run.workspaceKey === undefined ? [] : [`workspaceKey: ${run.workspaceKey}`]),
    ...(run.scopeKey === undefined ? [] : [`scopeKey: ${run.scopeKey}`]),
    ...(run.scopeLabel === undefined ? [] : [`scopeLabel: ${run.scopeLabel}`]),
    ...(run.gitRoot === undefined ? [] : [`gitRoot: ${run.gitRoot}`]),
    `task: ${run.taskPreview}`,
    `cwd: ${run.cwd}`,
    `pid: ${run.pid ?? "unknown"}`,
    `startedAt: ${run.startedAt}`,
    ...(run.endedAt === undefined ? [] : [`endedAt: ${run.endedAt}`]),
    ...(run.lastActivityAt === undefined ? [] : [`lastActivityAt: ${run.lastActivityAt}`]),
    `elapsed: ${elapsedSeconds}s`,
    ...(run.timeoutMs === undefined ? [] : [`timeoutMs: ${run.timeoutMs}`]),
    ...(run.statusReason ? [`statusReason: ${run.statusReason}`] : []),
    `exitCode: ${run.exitCode ?? "n/a"}`,
    `log: ${run.logPath}`,
    `usage.source: ${run.usage.source}`,
  ];
  if (run.usage.inputTokens !== undefined) lines.push(`usage.inputTokens: ${run.usage.inputTokens}`);
  if (run.usage.outputTokens !== undefined) lines.push(`usage.outputTokens: ${run.usage.outputTokens}`);
  if (run.usage.cacheReadTokens !== undefined) lines.push(`usage.cacheReadTokens: ${run.usage.cacheReadTokens}`);
  if (run.usage.cacheWriteTokens !== undefined) lines.push(`usage.cacheWriteTokens: ${run.usage.cacheWriteTokens}`);
  if (run.usage.reasoningOutputTokens !== undefined) {
    lines.push(`usage.reasoningOutputTokens: ${run.usage.reasoningOutputTokens}`);
  }
  if (run.usage.costUsd !== undefined) lines.push(`usage.costUsd: ${run.usage.costUsd}`);
  if (run.activity && run.activity.length > 0) lines.push(`activity: ${run.activity.join(" | ")}`);
  if (run.finalTextPreview) lines.push(`final: ${run.finalTextPreview}`);
  return lines;
}

export function formatWorkerHistoryEntryLines(entry: WorkerRunHistoryEntry): string[] {
  const elapsedSeconds = Math.max(0, Math.round(entry.elapsedMs / 1000));
  const lines = [
    `${entry.runId} — ${entry.status}${entry.controllable ? "" : " — historical"}`,
    `adapter: ${entry.adapter}`,
    ...(entry.profile ? [`profile: ${entry.profile}`] : []),
    ...(entry.mode ? [`mode: ${entry.mode}`] : []),
    ...(entry.slot === undefined ? [] : [`slot: ${entry.slot}`]),
    ...(entry.readOnly === undefined ? [] : [`readOnly: ${entry.readOnly}`]),
    ...(entry.canModifyWorkspace === undefined ? [] : [`canModifyWorkspace: ${entry.canModifyWorkspace}`]),
    ...(entry.workspaceKey === undefined ? [] : [`workspaceKey: ${entry.workspaceKey}`]),
    ...(entry.scopeKey === undefined ? [] : [`scopeKey: ${entry.scopeKey}`]),
    ...(entry.scopeLabel === undefined ? [] : [`scopeLabel: ${entry.scopeLabel}`]),
    ...(entry.gitRoot === undefined ? [] : [`gitRoot: ${entry.gitRoot}`]),
    `task: ${entry.taskPreview}`,
    `cwd: ${entry.cwd}`,
    ...(entry.pid === undefined ? [] : [`pid: ${entry.pid}`]),
    `startedAt: ${entry.startedAt}`,
    ...(entry.endedAt === undefined ? [] : [`endedAt: ${entry.endedAt}`]),
    ...(entry.lastActivityAt === undefined ? [] : [`lastActivityAt: ${entry.lastActivityAt}`]),
    `elapsed: ${elapsedSeconds}s`,
    ...(entry.timeoutMs === undefined ? [] : [`timeoutMs: ${entry.timeoutMs}`]),
    ...(entry.statusReason ? [`statusReason: ${entry.statusReason}`] : []),
    `exitCode: ${entry.exitCode ?? "n/a"}`,
    `controllable: ${entry.controllable}`,
    `log: ${entry.logPath}`,
    `usage.source: ${entry.usage.source}`,
  ];
  if (entry.activity.length > 0) lines.push(`activity: ${entry.activity.join(" | ")}`);
  if (entry.finalText) lines.push(`final: ${entry.finalText}`);
  return lines;
}

export function registerAgentWorkerCommands(
  pi: ExtensionAPI,
  service = new AgentWorkerService(),
  options: { configDir?: string } = {},
): void {
  pi.registerCommand("agent-workers", {
    description: "Show agent worker extension status and commands",
    handler: async (_args, ctx) => {
      const runs = service.listRuns();
      const lines = getAgentWorkersHelpLines();
      if (runs.length > 0) {
        lines.push("", "Runs:");
        for (const run of runs) lines.push(`  ${run.id} — ${run.status} — ${run.taskPreview}`);
      }
      emitLines(pi, ctx, lines, "Agent workers status");
    },
  });

  pi.registerCommand("worker-config", {
    description: "Show or update workspace-scoped agent worker config",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const scope = resolveWorkspaceScope(ctx.cwd);
      const ref = { ...(options.configDir ? { configDir: options.configDir } : {}), scopeKey: scope.scopeKey, scopeLabel: scope.scopeLabel };
      try {
        if (parts.length === 0) {
          const config = await readWorkspaceConfig(ref);
          emitLines(pi, ctx, formatWorkerConfigLines(config), "Worker config");
          return;
        }
        if (parts[0] !== "set" || parts.length !== 3) {
          emitLines(pi, ctx, ["Usage: /worker-config [set <key> <value>]"], "Worker config usage", "warning");
          return;
        }
        const patch = validateWorkspaceConfigPatch(parts[1]!, parts[2]!);
        const config = await updateWorkspaceConfig(ref, patch);
        emitLines(pi, ctx, ["Updated worker config.", ...formatWorkerConfigLines(config)], "Worker config updated");
      } catch (error) {
        emitLines(pi, ctx, [errorMessage(error)], "Worker config failed", "error");
      }
    },
  });

  pi.registerCommand("worker-workspace", {
    description: "Show the current agent worker workspace",
    handler: async (_args, ctx) => {
      emitLines(pi, ctx, formatWorkspaceStatusLines(ctx.cwd), "Worker workspace");
    },
  });

  pi.registerCommand("worker-workspace-pick", {
    description: "Pick the agent worker workspace using native pi UI",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI || !ctx.ui.select) {
        emitLines(pi, ctx, ["/worker-workspace-pick requires interactive UI."], "Worker workspace", "warning");
        return;
      }

      const candidates = discoverWorkspaceCandidates({ currentCwd: ctx.cwd });
      const manual = "Enter path manually...";
      const choices = [...candidates.map((candidate) => candidate.path), manual];
      const choice = await ctx.ui.select("Select worker workspace", choices);
      if (!choice) {
        emitLines(pi, ctx, ["Workspace selection canceled."], "Worker workspace", "warning");
        return;
      }

      let selected = choice;
      if (choice === manual) {
        if (!ctx.ui.input) {
          emitLines(pi, ctx, ["Manual workspace entry requires input support."], "Worker workspace", "warning");
          return;
        }
        const entered = await ctx.ui.input("Worker workspace path", ctx.cwd);
        if (!entered) {
          emitLines(pi, ctx, ["Workspace selection canceled."], "Worker workspace", "warning");
          return;
        }
        selected = entered;
      }

      const normalized = normalizeWorkspacePath(selected);
      const validation = validateWorkerWorkspace(normalized);
      if (validation.errors.length > 0) {
        emitLines(pi, ctx, validation.errors, "Worker workspace invalid", "error");
        return;
      }
      emitLines(pi, ctx, ["Picked worker workspace for copy/use.", ...formatWorkspacePreflightLines(validation), `run with: /worker-run --cwd ${normalized} <task>`], "Worker workspace picked");
    },
  });

  pi.registerCommand("worker-run", {
    description: "Start one worker using demo, claude-code, or codex-cli adapter",
    handler: async (args, ctx) => {
      const parsed = parseWorkerRunArgs(args);
      if (!parsed.ok) {
        emitLines(pi, ctx, [parsed.message], "Worker run usage");
        return;
      }

      try {
        const pickedCwd = parsed.pickCwd ? await pickWorkerCwd(ctx) : undefined;
        if (parsed.pickCwd && !pickedCwd) {
          emitLines(pi, ctx, ["Workspace selection canceled."], "Worker workspace", "warning");
          return;
        }
        const effectiveCwd = service.resolveCwd(parsed.cwd ?? pickedCwd, ctx.cwd);
        const validation = validateWorkerWorkspace(effectiveCwd, { task: parsed.task });
        if (validation.errors.length > 0) {
          emitLines(pi, ctx, validation.errors, "Worker workspace invalid", "error");
          return;
        }

        const resolved = await service.resolveRequestWithConfig({
          adapter: parsed.adapter,
          profile: parsed.profile,
          task: parsed.task,
          cwd: effectiveCwd,
          durationMs: parsed.durationMs,
          timeoutMs: parsed.timeoutMs,
        });
        if (resolved.requireConfirmation && !parsed.confirmedRealWorker) {
          const confirmed = await confirmRealWorkerRun(resolved, ctx);
          if (!confirmed) {
            emitLines(pi, ctx, [`Canceled: worker ${resolved.adapter} was not confirmed.`], "Worker start canceled", "warning");
            return;
          }
        }

        const run = await service.start({
          adapter: parsed.adapter,
          profile: parsed.profile,
          task: parsed.task,
          cwd: effectiveCwd,
          durationMs: parsed.durationMs,
          timeoutMs: parsed.timeoutMs,
          requireConfirmation: parsed.confirmedRealWorker ? false : undefined,
        });
        emitLines(pi, ctx, ["Started worker run.", ...formatWorkspacePreflightLines(validation), ...formatWorkerRunLines(run)], "Worker started");
      } catch (error) {
        emitLines(pi, ctx, [errorMessage(error)], "Worker start failed", "error");
      }
    },
  });

  pi.registerCommand("worker-status", {
    description: "Show worker status",
    handler: async (args, ctx) => {
      const id = args.trim();
      if (id) {
        const run = service.getRun(id);
        emitLines(pi, ctx, run ? formatWorkerRunLines(run) : [`Unknown worker run: ${id}`], "Worker status");
        return;
      }

      const runs = service.listRuns();
      if (runs.length === 0) {
        emitLines(pi, ctx, ["No worker runs yet."], "Worker status");
        return;
      }
      emitLines(pi, ctx, runs.flatMap((run, index) => (index === 0 ? formatWorkerRunLines(run) : ["", ...formatWorkerRunLines(run)])), "Worker status");
    },
  });

  pi.registerCommand("worker-history", {
    description: "Show recent worker run history",
    handler: async (args, ctx) => {
      const parsed = parseWorkerHistoryArgs(args);
      if (!parsed.ok) {
        emitLines(pi, ctx, [parsed.message], "Worker history usage");
        return;
      }

      try {
        const scope = resolveWorkspaceScope(ctx.cwd);
        const config = await readWorkspaceConfig({
          ...(options.configDir ? { configDir: options.configDir } : {}),
          scopeKey: scope.scopeKey,
          scopeLabel: scope.scopeLabel,
        });
        const allScopes = parsed.allScopes || config.historyScope === "all";
        const limit = parsed.limit ?? config.historyLimit;
        const runs = await service.listRunHistory({
          ...(limit === undefined ? {} : { limit }),
          ...(allScopes ? { allScopes: true } : { cwd: ctx.cwd }),
        });
        if (runs.length === 0) {
          emitLines(
            pi,
            ctx,
            allScopes
              ? ["No worker run history yet."]
              : ["No worker run history for current workspace.", "Use /worker-history --all to list all workspace history."],
            "Worker history",
          );
          return;
        }
        emitLines(
          pi,
          ctx,
          runs.flatMap((run, index) => (index === 0 ? formatWorkerHistoryEntryLines(run) : ["", ...formatWorkerHistoryEntryLines(run)])),
          "Worker history",
        );
      } catch (error) {
        emitLines(pi, ctx, [errorMessage(error)], "Worker history failed", "error");
      }
    },
  });

  pi.registerCommand("worker-wait", {
    description: "Wait for a worker to finish",
    handler: async (args, ctx) => {
      const parsed = parseWorkerWaitArgs(args);
      if (!parsed.ok) {
        emitLines(pi, ctx, [parsed.message], "Worker wait usage");
        return;
      }

      try {
        const result = await service.waitForRun(parsed.runId, parsed.waitMs);
        emitLines(
          pi,
          ctx,
          [
            result.completed ? "Worker wait completed." : "Worker is still running after wait limit.",
            ...formatWorkerRunLines(result.run),
          ],
          "Worker wait",
        );
      } catch (error) {
        emitLines(pi, ctx, [errorMessage(error)], "Worker wait failed", "error");
      }
    },
  });

  pi.registerCommand("worker-log", {
    description: "Show a worker log tail",
    handler: async (args, ctx) => {
      const id = args.trim().split(/\s+/, 1)[0] ?? "";
      if (!id) {
        emitLines(pi, ctx, ["Usage: /worker-log <id>"], "Worker log usage");
        return;
      }

      const run = service.getRun(id);
      if (!run) {
        emitLines(pi, ctx, [`Unknown worker run: ${id}`], "Worker log");
        return;
      }

      try {
        const tail = await readLogTail(run.logPath, DEFAULT_LOG_TAIL_LINES);
        emitLines(pi, ctx, [`Log tail for ${id}:`, tail || "(log is empty)"], "Worker log");
      } catch (error) {
        emitLines(pi, ctx, [errorMessage(error)], "Worker log failed", "error");
      }
    },
  });

  pi.registerCommand("worker-kill", {
    description: "Cancel a running worker",
    handler: async (args, ctx) => {
      const id = args.trim();
      if (!id) {
        emitLines(pi, ctx, ["Usage: /worker-kill <id>"], "Worker kill usage");
        return;
      }

      try {
        const run = service.cancelRun(id);
        emitLines(pi, ctx, formatWorkerKillLines(run), "Worker kill");
      } catch (error) {
        emitLines(pi, ctx, [errorMessage(error)], "Worker kill failed", "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    service.cancelAll();
  });
}

export function formatWorkerKillLines(run: WorkerRun): string[] {
  const prefix = run.status === "cancelled" ? "Cancellation requested." : `Worker is already ${run.status}.`;
  return [prefix, ...formatWorkerRunLines(run)];
}

function formatWorkerConfigLines(config: WorkspaceAgentWorkerConfig): string[] {
  return [
    "Agent worker workspace config",
    `scopeLabel: ${config.scopeLabel}`,
    `scopeKey: ${config.scopeKey}`,
    `defaultProfile: ${config.defaultProfile ?? "unset"}`,
    `defaultAdapter: ${config.defaultAdapter ?? "unset"}`,
    `defaultTimeoutMs: ${config.defaultTimeoutMs ?? "unset"}`,
    `historyScope: ${config.historyScope ?? "current"}`,
    `historyLimit: ${config.historyLimit ?? "unset"}`,
    `widgetPlacement: ${config.widgetPlacement ?? "aboveEditor"}`,
    `widgetLimit: ${config.widgetLimit ?? "unset"}`,
    `profiles: ${config.profiles?.length ?? 0}`,
  ];
}

function isWorkerAdapterName(adapter: string): adapter is WorkerAdapterName {
  return adapter === "demo" || adapter === "claude-code" || adapter === "codex-cli";
}

async function pickWorkerCwd(ctx: {
  cwd: string;
  hasUI: boolean;
  ui: {
    select?(title: string, choices: string[]): Promise<string | undefined>;
    input?(title: string, placeholder?: string): Promise<string | undefined>;
  };
}): Promise<string | undefined> {
  if (!ctx.hasUI || !ctx.ui.select) return undefined;
  const candidates = discoverWorkspaceCandidates({ currentCwd: ctx.cwd });
  const manual = "Enter path manually...";
  const choice = await ctx.ui.select("Select worker workspace for this run", [...candidates.map((candidate) => candidate.path), manual]);
  if (!choice) return undefined;
  if (choice !== manual) return choice;
  if (!ctx.ui.input) return undefined;
  return ctx.ui.input("Worker workspace path", ctx.cwd);
}

async function confirmRealWorkerRun(
  request: ResolvedWorkerRequest,
  ctx: {
    hasUI: boolean;
    ui: {
      confirm?(title: string, message: string): Promise<boolean>;
    };
  },
): Promise<boolean> {
  if (!ctx.hasUI || !ctx.ui.confirm) return false;
  return ctx.ui.confirm(
    "Run worker adapter?",
    [
      `Adapter: ${request.adapter}`,
      `Workspace: ${request.cwd}`,
      ...validateWorkerWorkspace(request.cwd, { task: request.task }).warnings.map((warning) => `Warning: ${warning}`),
      "This will start a local external AI CLI process in the selected working directory.",
      "The extension does not add permission/sandbox bypass flags, but the CLI may read or modify files according to its own policy.",
      "Continue?",
    ].join("\n"),
  );
}

function workerRunUsage(): ParsedWorkerRunArgs {
  return {
    ok: false,
    message: "Usage: /worker-run [--cwd <path>] [--pick-cwd] [--adapter demo|claude-code|codex-cli] [--profile planner|reviewer|implementer|verifier] [--duration-ms 10000] [--timeout-ms <ms>] [--yes] <task>",
  };
}

function workerWaitUsage(): ParsedWorkerWaitArgs {
  return {
    ok: false,
    message: "Usage: /worker-wait <id> [--wait-ms <ms>]",
  };
}

function emitLines(
  pi: ExtensionAPI,
  ctx: { hasUI: boolean; ui: { notify(message: string, level: "info" | "warning" | "error"): void } },
  lines: string[],
  title: string,
  level: "info" | "warning" | "error" = "info",
): void {
  pi.sendMessage({ customType: PACKAGE_KEY, content: lines.join("\n"), display: true });
  if (ctx.hasUI) ctx.ui.notify(title, level);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
