import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { WorkerRun, WorkerRunHistoryEntry } from "./worker-types.ts";

const INDEX_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 100;

interface RunIndexFile {
  version: number;
  runs: WorkerRunHistoryEntry[];
}

interface RunArtifactIndexOptions {
  maxEntries?: number;
}

export interface RunHistoryListOptions {
  limit?: number;
  scopeKey?: string;
  allScopes?: boolean;
}

export class RunArtifactIndex {
  private readonly indexPath: string;
  private readonly maxEntries: number;

  constructor(artifactRoot: string, options: RunArtifactIndexOptions = {}) {
    this.indexPath = getRunIndexPath(artifactRoot);
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async upsertRun(run: WorkerRun): Promise<void> {
    const current = await this.readIndex();
    const entry = workerRunToHistoryEntry(run, { controllable: false, historical: true });
    const nextRuns = [entry, ...current.runs.filter((candidate) => candidate.runId !== entry.runId)]
      .sort(compareHistoryEntries)
      .slice(0, this.maxEntries);
    await this.writeIndex({ version: INDEX_VERSION, runs: nextRuns });
  }

  async listRuns(options: number | RunHistoryListOptions = this.maxEntries): Promise<WorkerRunHistoryEntry[]> {
    const normalized = normalizeListOptions(options, this.maxEntries);
    const current = await this.readIndex();
    return current.runs
      .filter((entry) => normalized.allScopes || normalized.scopeKey === undefined || historyEntryMatchesScope(entry, normalized.scopeKey))
      .map((entry) => markStaleHistoricalActiveRun({ ...entry, usage: { ...entry.usage }, activity: [...entry.activity], controllable: false, historical: true }))
      .sort(compareHistoryEntries)
      .slice(0, normalized.limit);
  }

  private async readIndex(): Promise<RunIndexFile> {
    try {
      const raw = await readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<RunIndexFile>;
      if (!Array.isArray(parsed.runs)) return { version: INDEX_VERSION, runs: [] };
      return { version: parsed.version ?? INDEX_VERSION, runs: parsed.runs.filter(isHistoryEntry) };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return { version: INDEX_VERSION, runs: [] };
      throw error;
    }
  }

  private async writeIndex(index: RunIndexFile): Promise<void> {
    await mkdir(dirname(this.indexPath), { recursive: true, mode: 0o700 });
    const tempPath = `${this.indexPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.indexPath);
  }
}

export function getRunIndexPath(artifactRoot: string): string {
  return join(artifactRoot, "runs-index.json");
}

export function workerRunToHistoryEntry(
  run: WorkerRun,
  options: { controllable: boolean; historical: boolean },
  now = Date.now(),
): WorkerRunHistoryEntry {
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
    elapsedMs: (run.endedAt ?? now) - run.startedAt,
    ...(run.lastActivityAt === undefined ? {} : { lastActivityAt: run.lastActivityAt }),
    ...(run.timeoutMs === undefined ? {} : { timeoutMs: run.timeoutMs }),
    ...(run.exitCode === undefined ? {} : { exitCode: run.exitCode }),
    usage: { ...run.usage },
    activity: [...(run.activity ?? [])],
    ...(run.finalTextPreview ? { finalText: run.finalTextPreview } : {}),
    logPath: run.logPath,
    controllable: options.controllable,
    historical: options.historical,
    indexedAt: now,
  };
}

function markStaleHistoricalActiveRun(entry: WorkerRunHistoryEntry): WorkerRunHistoryEntry {
  if (entry.controllable || (entry.status !== "running" && entry.status !== "queued")) return entry;
  const endedAt = entry.lastActivityAt ?? entry.indexedAt ?? entry.startedAt;
  return {
    ...entry,
    status: "failed",
    statusReason: "stale_historical",
    endedAt,
    elapsedMs: endedAt - entry.startedAt,
  };
}

function historyEntryMatchesScope(entry: WorkerRunHistoryEntry, scopeKey: string): boolean {
  return entry.scopeKey === scopeKey || entry.workspaceKey === scopeKey || entry.cwd === scopeKey;
}

function normalizeListOptions(options: number | RunHistoryListOptions, defaultLimit: number): Required<Pick<RunHistoryListOptions, "allScopes">> & Pick<RunHistoryListOptions, "scopeKey"> & { limit: number } {
  if (typeof options === "number") return { limit: options, allScopes: true };
  return {
    limit: options.limit ?? defaultLimit,
    ...(options.scopeKey === undefined ? {} : { scopeKey: options.scopeKey }),
    allScopes: options.allScopes ?? false,
  };
}

function compareHistoryEntries(a: WorkerRunHistoryEntry, b: WorkerRunHistoryEntry): number {
  return (b.startedAt || 0) - (a.startedAt || 0);
}

function isHistoryEntry(value: unknown): value is WorkerRunHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { runId?: unknown; status?: unknown; adapter?: unknown; taskPreview?: unknown; cwd?: unknown; startedAt?: unknown; logPath?: unknown };
  return (
    typeof candidate.runId === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.adapter === "string" &&
    typeof candidate.taskPreview === "string" &&
    typeof candidate.cwd === "string" &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.logPath === "string"
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
