import type { WorkerRun, WorkerRunHistoryEntry } from "../core/worker-types.ts";

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

export function formatWorkerKillLines(run: WorkerRun): string[] {
  const prefix = run.status === "cancelled" ? "Cancellation requested." : `Worker is already ${run.status}.`;
  return [prefix, ...formatWorkerRunLines(run)];
}
