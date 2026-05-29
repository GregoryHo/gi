import { spawn as nodeSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { once } from "node:events";

import { createClaudeCodeAdapter } from "./adapters/claude-code.ts";
import { createCodexCliAdapter } from "./adapters/codex-cli.ts";
import { createDemoAdapter } from "./adapters/demo.ts";
import { ensureLogDirectory, getDefaultArtifactRoot, getRunLogPath } from "./logs.ts";
import { RunArtifactIndex, type RunHistoryListOptions, workerRunToHistoryEntry } from "./run-index.ts";
import { textPreview, unknownUsage, type WorkerEvent } from "./worker-events.ts";
import type { ChildProcessLike, SpawnLike, WorkerAdapter, WorkerRun, WorkerRunHistoryEntry, WorkerStatus } from "./worker-types.ts";

interface WorkerManagerOptions {
  artifactRoot?: string;
  adapters?: WorkerAdapter[];
  spawn?: SpawnLike;
  onRunChange?: (run: WorkerRun) => void;
}

interface RunRecord {
  run: WorkerRun;
  child: ChildProcessLike;
  completion: Promise<WorkerRun>;
  resolveCompletion: (run: WorkerRun) => void;
  index: RunArtifactIndex;
  notifyRunChange: (run: WorkerRun) => void;
  timeout?: NodeJS.Timeout;
}

export class WorkerManager {
  private readonly artifactRoot: string;
  private readonly adapters: Map<string, WorkerAdapter>;
  private readonly spawn: SpawnLike;
  private readonly index: RunArtifactIndex;
  private readonly onRunChange?: (run: WorkerRun) => void;
  private readonly runs = new Map<string, RunRecord>();

  constructor(options: WorkerManagerOptions = {}) {
    this.artifactRoot = options.artifactRoot ?? getDefaultArtifactRoot();
    this.adapters = new Map(
      (options.adapters ?? [createDemoAdapter(), createClaudeCodeAdapter(), createCodexCliAdapter()]).map((adapter) => [
        adapter.name,
        adapter,
      ]),
    );
    this.spawn = options.spawn ?? ((command, args, spawnOptions) => nodeSpawn(command, args, spawnOptions));
    this.index = new RunArtifactIndex(this.artifactRoot);
    this.onRunChange = options.onRunChange;
  }

  async startRun(input: {
    adapter: string;
    task: string;
    cwd: string;
    durationMs?: number;
    timeoutMs?: number;
    profile?: string;
    mode?: string;
    readOnly?: boolean;
    canModifyWorkspace?: boolean;
    taskPreview?: string;
    originalTaskPreview?: string;
    workspaceKey?: string;
    scopeKey?: string;
    scopeLabel?: string;
    gitRoot?: string;
  }): Promise<WorkerRun> {
    const activeRuns = this.getActiveRuns();
    if (activeRuns.length >= 6) throw new Error("Cannot start worker: maximum of 6 active workers is already running.");

    const workspaceKey = input.workspaceKey ?? input.cwd;
    const canModifyWorkspace = input.canModifyWorkspace ?? false;
    if (canModifyWorkspace) {
      const collidingRun = activeRuns.find((run) => run.canModifyWorkspace && (run.workspaceKey ?? run.cwd) === workspaceKey);
      if (collidingRun) {
        throw new Error(`Cannot start worker: write-capable worker is already active for workspace ${workspaceKey} (${collidingRun.id}).`);
      }
    }

    const adapter = this.adapters.get(input.adapter);
    if (!adapter) throw new Error(`Unknown worker adapter: ${input.adapter}`);

    await adapter.validate?.();

    const id = `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const logPath = getRunLogPath(this.artifactRoot, id);
    await ensureLogDirectory(logPath);

    const spec = adapter.createSpawnSpec(input.task, input.cwd, { durationMs: input.durationMs });
    const startedAt = Date.now();
    const child = this.spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const run: WorkerRun = {
      id,
      adapter: adapter.name,
      taskPreview: input.taskPreview ?? previewTask(input.task),
      ...(input.originalTaskPreview === undefined ? {} : { originalTaskPreview: input.originalTaskPreview }),
      cwd: input.cwd,
      pid: child.pid,
      status: "running",
      ...(input.profile ? { profile: input.profile } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      slot: allocateSlot(activeRuns),
      readOnly: input.readOnly ?? !canModifyWorkspace,
      canModifyWorkspace,
      workspaceKey,
      ...(input.scopeKey === undefined ? {} : { scopeKey: input.scopeKey }),
      ...(input.scopeLabel === undefined ? {} : { scopeLabel: input.scopeLabel }),
      ...(input.gitRoot === undefined ? {} : { gitRoot: input.gitRoot }),
      startedAt,
      lastActivityAt: startedAt,
      ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
      logPath,
      usage: unknownUsage(),
      activity: [],
    };

    let resolveCompletion: (run: WorkerRun) => void = () => undefined;
    const completion = new Promise<WorkerRun>((resolve) => {
      resolveCompletion = resolve;
    });
    const record: RunRecord = {
      run,
      child,
      completion,
      resolveCompletion,
      index: this.index,
      notifyRunChange: (changedRun) => this.notifyRunChange(changedRun),
    };
    this.runs.set(id, record);
    await this.index.upsertRun(run);
    this.notifyRunChange(run);

    if (input.timeoutMs !== undefined) {
      record.timeout = setTimeout(() => {
        if (record.run.status !== "running" && record.run.status !== "queued") return;
        record.run.status = "timed_out";
        record.run.statusReason = "timed_out";
        record.run.lastActivityAt = Date.now();
        void record.index.upsertRun(record.run).catch(() => undefined);
        this.notifyRunChange(record.run);
        record.child.kill("SIGTERM");
      }, input.timeoutMs);
    }

    const logStream = createWriteStream(logPath, { flags: "a", mode: 0o600 });
    const writeOutput = (stream: "stdout" | "stderr", chunk: Buffer | string) => {
      run.lastActivityAt = Date.now();
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.length === 0) continue;
        logStream.write(`[${stream}] ${line}\n`);
        if (adapter.parseOutputLine) applyWorkerEvents(run, adapter.parseOutputLine(line, stream, Date.now()));
      }
    };

    child.stdout?.on("data", (chunk) => writeOutput("stdout", chunk));
    child.stderr?.on("data", (chunk) => writeOutput("stderr", chunk));

    child.on("error", (error) => {
      writeOutput("stderr", error instanceof Error ? error.message : String(error));
      record.run.statusReason = "spawn_error";
      finishRun(record, "failed", undefined, logStream);
    });

    child.on("close", (code) => {
      const status: WorkerStatus =
        run.status === "timed_out" ? "timed_out" : run.status === "cancelled" ? "cancelled" : code === 0 ? "completed" : "failed";
      if (!record.run.statusReason) {
        record.run.statusReason =
          status === "timed_out" ? "timed_out" : status === "cancelled" ? "cancelled" : status === "completed" ? "exit_zero" : "exit_nonzero";
      }
      finishRun(record, status, code ?? undefined, logStream);
    });

    return { ...run };
  }

  getRun(id: string): WorkerRun | undefined {
    const record = this.runs.get(id);
    return record ? { ...record.run } : undefined;
  }

  listRuns(): WorkerRun[] {
    return Array.from(this.runs.values()).map((record) => ({ ...record.run }));
  }

  async listRunHistory(options: number | RunHistoryListOptions = 100): Promise<WorkerRunHistoryEntry[]> {
    const normalized = typeof options === "number" ? { limit: options, allScopes: true } : options;
    const inMemory = this.listRuns()
      .map((run) => workerRunToHistoryEntry(run, { controllable: true, historical: false }))
      .filter((entry) => normalized.allScopes || normalized.scopeKey === undefined || entry.scopeKey === normalized.scopeKey || entry.workspaceKey === normalized.scopeKey || entry.cwd === normalized.scopeKey);
    const historical = await this.index.listRuns(normalized);
    const byRunId = new Map<string, WorkerRunHistoryEntry>();
    for (const entry of historical) byRunId.set(entry.runId, entry);
    for (const entry of inMemory) byRunId.set(entry.runId, entry);
    return Array.from(byRunId.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, normalized.limit ?? 100);
  }

  async waitForRun(id: string): Promise<WorkerRun> {
    const record = this.runs.get(id);
    if (!record) throw new Error(`Unknown worker run: ${id}`);
    return { ...(await record.completion) };
  }

  cancelRun(id: string): WorkerRun {
    const record = this.runs.get(id);
    if (!record) throw new Error(`Unknown worker run: ${id}`);
    if (record.run.status !== "running" && record.run.status !== "queued") return { ...record.run };

    record.run.status = "cancelled";
    record.run.statusReason = "cancelled";
    record.run.lastActivityAt = Date.now();
    void record.index.upsertRun(record.run).catch(() => undefined);
    this.notifyRunChange(record.run);
    record.child.kill("SIGTERM");
    return { ...record.run };
  }

  cancelAll(): void {
    for (const record of this.runs.values()) {
      if (record.run.status === "running" || record.run.status === "queued") this.cancelRun(record.run.id);
    }
  }

  private getActiveRuns(): WorkerRun[] {
    return this.listRuns().filter(isActiveRun);
  }

  private notifyRunChange(run: WorkerRun): void {
    this.onRunChange?.({ ...run });
  }
}

function allocateSlot(activeRuns: WorkerRun[]): number {
  const usedSlots = new Set(activeRuns.map((run) => run.slot).filter((slot): slot is number => slot !== undefined));
  for (let slot = 1; slot <= 6; slot++) {
    if (!usedSlots.has(slot)) return slot;
  }
  return activeRuns.length + 1;
}

function isActiveRun(run: WorkerRun): boolean {
  return run.status === "running" || run.status === "queued";
}

function applyWorkerEvents(run: WorkerRun, events: WorkerEvent[]): void {
  for (const event of events) {
    if (event.type === "usage") run.usage = event.usage;
    if (event.type === "activity") run.activity = [...(run.activity ?? []), event.label].slice(-5);
    if (event.type === "final" && event.text) run.finalTextPreview = textPreview(event.text, 120);
    if (event.type === "error") run.activity = [...(run.activity ?? []), `error: ${event.message}`].slice(-5);
  }
}

function finishRun(
  record: RunRecord,
  status: WorkerStatus,
  exitCode: number | undefined,
  logStream: ReturnType<typeof createWriteStream>,
): void {
  if (record.run.endedAt) return;
  if (record.timeout) clearTimeout(record.timeout);
  record.run.status = status;
  record.run.exitCode = exitCode;
  record.run.endedAt = Date.now();
  record.run.lastActivityAt = record.run.endedAt;
  logStream.end();
  void Promise.all([once(logStream, "finish"), record.index.upsertRun(record.run).catch(() => undefined)]).then(() => {
    record.notifyRunChange(record.run);
    record.resolveCompletion({ ...record.run });
  });
}

function previewTask(task: string): string {
  const trimmed = task.trim().replace(/\s+/g, " ");
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
}
