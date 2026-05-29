import { basename } from "node:path";

import type { WorkerRunHistoryEntry, WorkerStatus } from "./worker-types.ts";

export const WORKER_UI_POC_WIDGET_KEY = "agent-workers-ui-poc";
export const WORKER_UI_POC_STATUS_KEY = "agent-workers-ui-poc";
export const WORKER_UI_POC_CARD_REFRESH_MS = 5_000;
const WORKER_UI_POC_CARD_MAX_WIDTH = 56;
const WORKER_UI_POC_CARD_GAP = "  ";

export type WorkerUiPocMode = "all" | "widget" | "wide-widget" | "card-widget" | "footer" | "cockpit" | "sidepanel" | "clear";
export type WorkerUiPocAction = "closed" | "wait" | "cancel" | "log" | "history-scope";

export interface WorkerUiPocComponent {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate(): void;
  dispose?(): void;
}

type TimerRef = unknown;

interface WorkerCardWidgetOptions {
  entries: WorkerRunHistoryEntry[];
  refreshIntervalMs?: number;
  loadEntries?: () => Promise<WorkerRunHistoryEntry[]>;
  requestRender?: () => void;
  now?: () => number;
  setIntervalFn?: (callback: () => void, ms: number) => TimerRef;
  clearIntervalFn?: (timer: TimerRef) => void;
}

interface WorkerUiPocThemeLike {
  fg?(color: string, text: string): string;
}

export function createWorkerUiPocWidget(entries: WorkerRunHistoryEntry[]): WorkerUiPocComponent {
  return createStaticComponent((width) => {
    const lines = [truncate("Agent workers UI PoC — component widget", width)];
    const visible = entries.slice(0, 3);
    if (visible.length === 0) return [...lines, truncate("No worker history in this workspace.", width)];
    return [...lines, ...visible.flatMap((entry, index) => renderCompactEntry(entry, index, width))];
  });
}

export function createWorkerWideWidget(entries: WorkerRunHistoryEntry[]): WorkerUiPocComponent {
  return createStaticComponent((width) => {
    const visible = entries.slice(0, 8);
    const lines = [truncate(`Agent workers wide widget PoC — ${visible.length}/${entries.length} shown`, width)];
    if (visible.length === 0) return [...lines, truncate("No worker history in this workspace.", width)];

    if (width >= 120) {
      const columnWidth = Math.floor((width - 3) / 2);
      for (let index = 0; index < visible.length; index += 2) {
        const left = compactOneLine(visible[index]!, index, columnWidth);
        const rightEntry = visible[index + 1];
        const right = rightEntry ? compactOneLine(rightEntry, index + 1, columnWidth) : "";
        lines.push(`${left.padEnd(columnWidth)} │ ${right}`.slice(0, width));
      }
      return lines;
    }

    return [...lines, ...visible.map((entry, index) => compactOneLine(entry, index, width))];
  });
}

export function createWorkerCardWidget(options: WorkerCardWidgetOptions): WorkerUiPocComponent {
  let entries = options.entries;
  const now = options.now ?? Date.now;
  let refreshing = false;
  let timer: TimerRef | undefined;

  const refresh = () => {
    if (!options.loadEntries || refreshing) return;
    refreshing = true;
    options
      .loadEntries()
      .then((nextEntries) => {
        entries = nextEntries;
        component.invalidate();
        options.requestRender?.();
      })
      .catch(() => undefined)
      .finally(() => {
        refreshing = false;
      });
  };

  const component: WorkerUiPocComponent = {
    render(width: number): string[] {
      const visible = entries.slice(0, 6);
      const lines = [truncate(`Agent workers card widget PoC — refresh ${Math.round((options.refreshIntervalMs ?? WORKER_UI_POC_CARD_REFRESH_MS) / 1000)}s`, width)];
      if (visible.length === 0) return [...lines, truncate("No worker history in this workspace.", width)];

      if (width >= 120) {
        const columnWidth = Math.min(WORKER_UI_POC_CARD_MAX_WIDTH, Math.floor((width - WORKER_UI_POC_CARD_GAP.length) / 2));
        for (let index = 0; index < visible.length; index += 2) {
          const left = renderWorkerCard(visible[index]!, columnWidth, now());
          const rightEntry = visible[index + 1];
          const right = rightEntry ? renderWorkerCard(rightEntry, columnWidth, now()) : [];
          const rowHeight = Math.max(left.length, right.length);
          for (let row = 0; row < rowHeight; row += 1) {
            lines.push(`${(left[row] ?? "").padEnd(columnWidth)}${WORKER_UI_POC_CARD_GAP}${right[row] ?? ""}`.slice(0, width));
          }
        }
        return lines;
      }

      const cardWidth = Math.min(WORKER_UI_POC_CARD_MAX_WIDTH, width);
      for (const entry of visible) lines.push(...renderWorkerCard(entry, cardWidth, now()));
      if (entries.length > visible.length) lines.push(truncate(`… ${entries.length - visible.length} more`, width));
      return lines;
    },
    invalidate(): void {},
    dispose(): void {
      if (timer) options.clearIntervalFn?.(timer) ?? clearInterval(timer as ReturnType<typeof setInterval>);
      timer = undefined;
    },
  };

  const refreshIntervalMs = options.refreshIntervalMs ?? WORKER_UI_POC_CARD_REFRESH_MS;
  if (options.loadEntries && refreshIntervalMs > 0) {
    timer = (options.setIntervalFn ?? setInterval)(refresh, refreshIntervalMs);
  }

  return component;
}

export function createWorkerUiPocFooter(entries: WorkerRunHistoryEntry[]): WorkerUiPocComponent {
  return createStaticComponent((width) => {
    const running = entries.filter((entry) => entry.status === "running" || entry.status === "queued").length;
    const failed = entries.filter((entry) => entry.status === "failed" || entry.status === "timed_out").length;
    const latest = entries[0];
    const latestText = latest ? ` latest ${latest.runId} ${latest.status}` : " no recent workers";
    return [truncate(`workers: ${running} active · ${failed} needs attention ·${latestText}`, width)];
  });
}

export function createWorkerCockpitPocComponent(
  entries: WorkerRunHistoryEntry[],
  done: (action: WorkerUiPocAction) => void,
  options: { title?: string; maxEntries?: number } = {},
): WorkerUiPocComponent {
  let selected = 0;
  let historyScope: "current" | "all" = "current";
  return {
    render(width: number): string[] {
      const visible = entries.slice(0, options.maxEntries ?? 8);
      const lines = [
        options.title ?? "Agent workers cockpit PoC",
        `Scope: ${historyScope} · ↑/↓ select · w wait · c cancel · l log · h scope · q close`,
        "",
      ];
      if (visible.length === 0) lines.push("No worker history available.");
      visible.forEach((entry, index) => {
        const marker = index === selected ? ">" : " ";
        lines.push(`${marker} ${entry.runId} ${statusIcon(entry.status)} ${entry.status} ${entry.profile ?? entry.mode ?? entry.adapter}`);
        lines.push(`  ${entry.taskPreview}`);
      });
      if (entries.length > visible.length) lines.push(`… ${entries.length - visible.length} more not shown in PoC`);
      return lines.map((line) => truncate(line, width));
    },
    handleInput(data: string): void {
      const key = keyName(data);
      const maxSelected = Math.max(0, Math.min(entries.length, options.maxEntries ?? 8) - 1);
      if ((key === "up" || key === "k") && selected > 0) selected -= 1;
      else if ((key === "down" || key === "j") && selected < maxSelected) selected += 1;
      else if (key === "w") done("wait");
      else if (key === "c") done("cancel");
      else if (key === "l") done("log");
      else if (key === "h") {
        historyScope = historyScope === "current" ? "all" : "current";
        done("history-scope");
      } else if (key === "q" || key === "escape") done("closed");
    },
    invalidate(): void {},
  };
}

export function formatWorkerUiPocLines(mode: WorkerUiPocMode, entries: WorkerRunHistoryEntry[]): string[] {
  const base = [`Worker UI PoC mode: ${mode}`, `sample runs: ${entries.length}`];
  switch (mode) {
    case "widget":
      return [...base, "surface: component/factory widget below editor", "purpose: baseline widget component capability"];
    case "wide-widget":
      return [...base, "surface: width-aware component widget below editor", "purpose: test whether render(width) can reduce widget height with multi-column layout"];
    case "card-widget":
      return [...base, "surface: interval-refreshing card/item widget below editor", `refresh: ${WORKER_UI_POC_CARD_REFRESH_MS / 1000}s`, "fields: adapter, profile, run id, duration, task, reason"];
    case "footer":
      return [...base, "surface: custom footer + status", "purpose: test footer ownership; use /worker-ui-poc clear to restore default"];
    case "cockpit":
      return [...base, "surface: overlay cockpit", "purpose: test focused inspect/control interaction"];
    case "sidepanel":
      return [...base, "surface: right-anchored overlay sidepanel", "purpose: test width/maxHeight/responsive overlay as widget-height escape hatch"];
    case "all":
      return [...base, "surfaces: widget + footer/status + overlay cockpit", "purpose: stress test; expected to be visually cluttered, not final UX"];
    case "clear":
      return ["Worker UI PoC surfaces cleared."];
  }
}

export function styleWorkerUiPocStatus(theme?: WorkerUiPocThemeLike): string {
  const text = "workers-poc";
  return theme?.fg ? theme.fg("accent", text) : text;
}

function createStaticComponent(renderFn: (width: number) => string[]): WorkerUiPocComponent {
  return { render: renderFn, invalidate(): void {} };
}

function compactOneLine(entry: WorkerRunHistoryEntry, index: number, width: number): string {
  return truncate(`${index + 1}. ${statusIcon(entry.status)} ${entry.status} ${entry.taskPreview} · ${entry.profile ?? entry.mode ?? entry.adapter}`, width);
}

function renderWorkerCard(entry: WorkerRunHistoryEntry, width: number, nowMs: number): string[] {
  const durationMs = entry.elapsedMs ?? (entry.endedAt ?? nowMs) - entry.startedAt;
  const profile = entry.profile ?? entry.mode ?? "n/a";
  const reason = entry.statusReason ?? "n/a";
  const title = `${entry.runId} ${statusIcon(entry.status)} ${entry.status}`;
  const topPrefix = `┌─ ${title} `;
  const borderWidth = Math.max(16, width);
  return [
    truncate(`${topPrefix}${"─".repeat(Math.max(1, borderWidth - topPrefix.length - 1))}┐`, width),
    cardLine(`adapter: ${entry.adapter}`, width),
    cardLine(`profile: ${profile} · duration: ${formatDuration(durationMs)}`, width),
    cardLine(`task: ${entry.taskPreview}`, width),
    cardLine(`reason: ${reason}`, width),
    truncate(`└${"─".repeat(Math.max(1, borderWidth - 2))}┘`, width),
  ];
}

function cardLine(text: string, width: number): string {
  if (width <= 4) return truncate(text, width);
  const innerWidth = width - 4;
  return `│ ${truncate(text, innerWidth).padEnd(innerWidth)} │`;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return remainder === 0 ? `${minutes}m` : `${minutes}m${remainder}s`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  return minuteRemainder === 0 ? `${hours}h` : `${hours}h${minuteRemainder}m`;
}

function renderCompactEntry(entry: WorkerRunHistoryEntry, index: number, width: number): string[] {
  const title = `${index + 1}. ${entry.runId} ${statusIcon(entry.status)} ${entry.status} · ${basename(entry.cwd) || entry.cwd}`;
  return [truncate(title, width), truncate(`   ${entry.taskPreview}`, width)];
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

function keyName(data: string): string {
  if (data === "\u001b[A") return "up";
  if (data === "\u001b[B") return "down";
  if (data === "\u001b") return "escape";
  return data.toLowerCase();
}

function truncate(text: string, width: number): string {
  if (width < 1) return "";
  if (text.length <= width) return text;
  if (width === 1) return "…";
  return `${text.slice(0, width - 1)}…`;
}
