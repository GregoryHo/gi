import type { WorkerUsage } from "./worker-events.ts";
import type { WorkerStatus } from "./worker-types.ts";

export type WorkerMode = "plan" | "review" | "implement" | "custom";

export type WorkerAdapterName = "demo" | "claude-code" | "codex-cli";

export interface WorkerRequest {
  adapter?: WorkerAdapterName;
  profile?: string;
  mode?: WorkerMode;
  task: string;
  systemPrompt?: string;
  cwd?: string;
  model?: string;
  timeoutMs?: number;
  durationMs?: number;
  requireConfirmation?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ResolvedWorkerRequest {
  adapter: WorkerAdapterName;
  profile?: string;
  mode: WorkerMode;
  task: string;
  cwd: string;
  systemPrompt?: string;
  model?: string;
  timeoutMs?: number;
  durationMs?: number;
  requireConfirmation: boolean;
  readOnly: boolean;
  canModifyWorkspace: boolean;
  metadata?: Record<string, unknown>;
}

export interface WorkerProfile {
  name: string;
  description: string;
  adapter: WorkerAdapterName;
  mode: WorkerMode;
  systemPrompt?: string;
  model?: string;
  requireConfirmation: boolean;
  readOnly: boolean;
  canModifyWorkspace: boolean;
  recommendedUse: string;
  defaultTimeoutMs?: number;
}

export interface WorkerResult {
  runId: string;
  status: WorkerStatus;
  statusReason?: string;
  adapter?: string;
  profile?: string;
  mode?: string;
  slot?: number;
  readOnly?: boolean;
  canModifyWorkspace?: boolean;
  workspaceKey?: string;
  scopeKey?: string;
  scopeLabel?: string;
  gitRoot?: string;
  taskPreview?: string;
  originalTaskPreview?: string;
  cwd?: string;
  pid?: number;
  startedAt?: number;
  endedAt?: number;
  elapsedMs?: number;
  lastActivityAt?: number;
  timeoutMs?: number;
  exitCode?: number;
  finalText?: string;
  usage: WorkerUsage;
  activity: string[];
  logPath: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
