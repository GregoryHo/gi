import type { EventEmitter } from "node:events";
import type { Readable } from "node:stream";

import type { WorkerEvent, WorkerUsage } from "./worker-events.ts";

export type WorkerStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "timed_out";
export type WorkerStatusReason = "exit_zero" | "exit_nonzero" | "cancelled" | "timed_out" | "spawn_error" | "stale_historical";

export interface WorkerRun {
  id: string;
  adapter: string;
  taskPreview: string;
  originalTaskPreview?: string;
  cwd: string;
  pid?: number;
  status: WorkerStatus;
  statusReason?: WorkerStatusReason;
  profile?: string;
  mode?: string;
  slot?: number;
  readOnly?: boolean;
  canModifyWorkspace?: boolean;
  workspaceKey?: string;
  scopeKey?: string;
  scopeLabel?: string;
  gitRoot?: string;
  startedAt: number;
  endedAt?: number;
  lastActivityAt?: number;
  exitCode?: number;
  timeoutMs?: number;
  logPath: string;
  usage: WorkerUsage;
  activity?: string[];
  finalTextPreview?: string;
}

export interface WorkerRunHistoryEntry {
  runId: string;
  status: WorkerStatus;
  statusReason?: WorkerStatusReason;
  adapter: string;
  profile?: string;
  mode?: string;
  slot?: number;
  readOnly?: boolean;
  canModifyWorkspace?: boolean;
  workspaceKey?: string;
  scopeKey?: string;
  scopeLabel?: string;
  gitRoot?: string;
  taskPreview: string;
  originalTaskPreview?: string;
  cwd: string;
  pid?: number;
  startedAt: number;
  endedAt?: number;
  elapsedMs: number;
  lastActivityAt?: number;
  timeoutMs?: number;
  exitCode?: number;
  usage: WorkerUsage;
  activity: string[];
  finalText?: string;
  logPath: string;
  controllable: boolean;
  historical: boolean;
  indexedAt?: number;
}

export interface WorkerSpawnSpec {
  command: string;
  args: string[];
  cwd: string;
  shell?: false;
}

export interface WorkerRunOptions {
  durationMs?: number;
}

export interface WorkerAdapter {
  name: string;
  createSpawnSpec(task: string, cwd: string, options?: WorkerRunOptions): WorkerSpawnSpec;
  parseOutputLine?(line: string, stream: "stdout" | "stderr", timestamp: number): WorkerEvent[];
  validate?(): void | Promise<void>;
}

export interface ChildProcessLike extends EventEmitter {
  pid?: number;
  stdout?: Readable | null;
  stderr?: Readable | null;
  killed?: boolean;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnLike = (
  command: string,
  args: string[],
  options: { cwd: string; shell: false; stdio: ["ignore", "pipe", "pipe"] },
) => ChildProcessLike;
