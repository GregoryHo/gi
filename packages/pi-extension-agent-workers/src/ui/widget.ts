import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { AgentWorkerService } from "../core/service.ts";
import type { WorkerRunHistoryEntry, WorkerStatus } from "../core/worker-types.ts";

export const AGENT_WORKERS_WIDGET_KEY = "agent-workers";
export const DEFAULT_WIDGET_REFRESH_MS = 5_000;
const DEFAULT_WIDGET_LIMIT = 3;
const DEFAULT_WIDGET_WIDTH = 116;
const COMPACT_CARD_MAX_WIDTH = 56;
const COMPACT_CARD_GAP = "  ";

interface WidgetComponentLike {
  render(width: number): string[];
  invalidate(): void;
}

type WidgetContent = string[] | ((tui?: unknown, theme?: unknown) => WidgetComponentLike);

export interface WidgetContextLike {
  cwd?: string;
  hasUI?: boolean;
  ui?: {
    setWidget?(key: string, content?: WidgetContent, options?: { placement?: "aboveEditor" | "belowEditor" }): void;
  };
}

interface RenderWidgetOptions {
  now?: number;
  width?: number;
  limit?: number;
}

export function renderWorkerWidget(entries: WorkerRunHistoryEntry[], options: RenderWidgetOptions = {}): string[] {
  const width = options.width ?? DEFAULT_WIDGET_WIDTH;
  const visible = selectWidgetEntries(entries, options.limit ?? DEFAULT_WIDGET_LIMIT);
  const lines = [truncateLine("Agent workers", width)];

  if (visible.length === 0) {
    lines.push(truncateLine("No worker runs yet.", width));
    return lines;
  }

  const now = options.now ?? Date.now();
  if (width >= 120) {
    const columnWidth = Math.min(COMPACT_CARD_MAX_WIDTH, Math.floor((width - COMPACT_CARD_GAP.length) / 2));
    for (let index = 0; index < visible.length; index += 2) {
      const left = renderWorkerCard(visible[index]!, columnWidth, now);
      const rightEntry = visible[index + 1];
      const right = rightEntry ? renderWorkerCard(rightEntry, columnWidth, now) : [];
      const rowHeight = Math.max(left.length, right.length);
      for (let row = 0; row < rowHeight; row += 1) {
        lines.push(`${(left[row] ?? "").padEnd(columnWidth)}${COMPACT_CARD_GAP}${right[row] ?? ""}`.slice(0, width));
      }
    }
    return lines;
  }

  const cardWidth = Math.min(COMPACT_CARD_MAX_WIDTH, width);
  visible.forEach((entry, index) => {
    if (index > 0) lines.push(truncateLine("", cardWidth));
    lines.push(...renderWorkerCard(entry, cardWidth, now));
  });
  return lines;
}

export async function updateAgentWorkersWidget(ctx: WidgetContextLike, service: AgentWorkerService): Promise<void> {
  if (!ctx.hasUI || !ctx.ui?.setWidget) return;
  const config = await service.getWorkspaceConfig(ctx.cwd);
  const limit = config.widgetLimit ?? DEFAULT_WIDGET_LIMIT;
  const entries = await service.listRunHistory({ limit, cwd: ctx.cwd });
  ctx.ui.setWidget(AGENT_WORKERS_WIDGET_KEY, () => createWorkerWidgetComponent(entries, { limit }), { placement: config.widgetPlacement ?? "aboveEditor" });
}

function selectWidgetEntries(entries: WorkerRunHistoryEntry[], limit: number): WorkerRunHistoryEntry[] {
  const selected = new Set(
	entries.filter((entry) => entry.status === "running" || entry.status === "queued" || entry.status === "failed" || entry.status === "timed_out").slice(0, limit),
  );
  const latestCancelled = entries.find((entry) => entry.status === "cancelled");
  if (latestCancelled && selected.size < limit) selected.add(latestCancelled);
  const latestCompleted = entries.find((entry) => entry.status === "completed");
  if (latestCompleted && selected.size < limit) selected.add(latestCompleted);
  return entries.filter((entry) => selected.has(entry)).slice(0, limit);
}

function createWorkerWidgetComponent(entries: WorkerRunHistoryEntry[], options: RenderWidgetOptions = {}): WidgetComponentLike {
  return {
    render(width: number): string[] {
      return renderWorkerWidget(entries, { ...options, width });
    },
    invalidate(): void {},
  };
}

export function clearAgentWorkersWidget(ctx: WidgetContextLike): void {
  if (!ctx.hasUI || !ctx.ui?.setWidget) return;
  ctx.ui.setWidget(AGENT_WORKERS_WIDGET_KEY, undefined);
}

export function registerAgentWorkerWidget(
  pi: ExtensionAPI,
  service: AgentWorkerService,
  options: {
    refreshMs?: number;
    setIntervalFn?: (callback: () => void, ms: number) => unknown;
    clearIntervalFn?: (timer: unknown) => void;
  } = {},
): void {
  let latestCtx: WidgetContextLike | undefined;
  let refreshTimer: unknown;
  const refresh = () => {
    if (!latestCtx) return;
    void updateAgentWorkersWidget(latestCtx, service).catch(() => undefined);
  };

  service.onRunChange(refresh);

  pi.on("session_start", async (_event, ctx) => {
    latestCtx = ctx;
    await updateAgentWorkersWidget(ctx, service);
    const refreshMs = options.refreshMs ?? DEFAULT_WIDGET_REFRESH_MS;
    if (refreshTimer === undefined && refreshMs > 0) {
      refreshTimer = (options.setIntervalFn ?? setInterval)(refresh, refreshMs);
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (refreshTimer !== undefined) {
      if (options.clearIntervalFn) options.clearIntervalFn(refreshTimer);
      else clearInterval(refreshTimer as ReturnType<typeof setInterval>);
      refreshTimer = undefined;
    }
    clearAgentWorkersWidget(ctx);
    latestCtx = undefined;
  });
}

function renderWorkerCard(entry: WorkerRunHistoryEntry, width: number, now: number): string[] {
  const profileOrMode = entry.profile ?? entry.mode ?? "n/a";
  const reason = entry.statusReason ?? entry.status;
  const slotPrefix = entry.slot === undefined ? "" : `#${entry.slot} `;
  const title = `${slotPrefix}${entry.runId} ${statusIcon(entry.status)} ${entry.status}`;
  const borderWidth = Math.max(16, width);
  const top = `┌─ ${title} `;
  const topLine = `${top}${"─".repeat(Math.max(1, borderWidth - top.length - 1))}┐`;
  const bottomLine = `└${"─".repeat(Math.max(1, borderWidth - 2))}┘`;
  return [
    truncateLine(topLine, width),
    cardLine(`adapter: ${entry.adapter}`, width),
    cardLine(`profile: ${profileOrMode} · duration: ${formatElapsed(durationMs(entry, now))}`, width),
    cardLine(`started: ${formatClockTime(entry.startedAt)} · reason: ${reason}`, width),
    cardLine(`task: ${entry.taskPreview}`, width),
    truncateLine(bottomLine, width),
  ];
}

function durationMs(entry: WorkerRunHistoryEntry, now: number): number {
  if (entry.endedAt !== undefined) return entry.endedAt - entry.startedAt;
  if (entry.status === "running" || entry.status === "queued") return now - entry.startedAt;
  return entry.elapsedMs;
}

function cardLine(text: string, width: number): string {
  if (width <= 4) return truncateLine(text, width);
  const innerWidth = width - 4;
  return `│ ${truncateLine(text, innerWidth).padEnd(innerWidth)} │`;
}

function truncateLine(text: string, width: number): string {
  if (width < 1) return "";
  if (text.length <= width) return text;
  if (width === 1) return "…";
  return `${text.slice(0, width - 1)}…`;
}

function statusIcon(status: WorkerStatus): string {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    case "cancelled":
      return "⊘";
    case "timed_out":
      return "⏱";
    case "queued":
      return "○";
    case "running":
      return "▶";
  }
}

function formatClockTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
