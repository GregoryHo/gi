import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { readWorkspaceConfig, updateWorkspaceConfig, validateWorkspaceConfigPatch, type WorkspaceAgentWorkerConfig } from "../config/index.ts";
import { readLogTail } from "../state/logs.ts";
import { parseWorkerHistoryArgs, parseWorkerRunArgs, parseWorkerWaitArgs } from "./args.ts";
import { formatWorkerHistoryEntryLines, formatWorkerKillLines, formatWorkerRunLines, getAgentWorkersHelpLines } from "./format.ts";
import type { ResolvedWorkerRequest } from "../core/request-types.ts";
import { AgentWorkerService } from "../core/service.ts";
import {
  discoverWorkspaceCandidates,
  formatWorkspacePreflightLines,
  formatWorkspaceStatusLines,
  normalizeWorkspacePath,
  resolveWorkspaceScope,
  validateWorkerWorkspace,
} from "../state/workspaces.ts";

const PACKAGE_KEY = "agent-workers";
const DEFAULT_LOG_TAIL_LINES = 40;

export {
  parseWorkerHistoryArgs,
  parseWorkerRunArgs,
  parseWorkerWaitArgs,
  type ParsedWorkerHistoryArgs,
  type ParsedWorkerRunArgs,
  type ParsedWorkerWaitArgs,
} from "./args.ts";
export {
  formatWorkerHistoryEntryLines,
  formatWorkerKillLines,
  formatWorkerRunLines,
  getAgentWorkersHelpLines,
} from "./format.ts";


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
