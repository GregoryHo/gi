import { readWorkspaceConfig, type WorkspaceAgentWorkerConfig } from "./config.ts";
import { getWorkerProfiles, resolveWorkerProfile } from "./profiles.ts";
import type { ResolvedWorkerRequest, WorkerProfile, WorkerRequest, WorkerResult } from "./request-types.ts";
import { textPreview } from "./worker-events.ts";
import { WorkerManager } from "./worker-manager.ts";
import { resolveWorkerCwd, resolveWorkspaceScope, validateWorkerWorkspace } from "./workspaces.ts";
import type { WorkerRun, WorkerRunHistoryEntry } from "./worker-types.ts";

interface AgentWorkerServiceOptions {
  manager?: WorkerManager;
  defaultCwd?: string;
  configDir?: string;
}

export interface AgentWorkerHistoryOptions {
  limit?: number;
  cwd?: string;
  scopeKey?: string;
  allScopes?: boolean;
}

export class AgentWorkerService {
  private readonly manager: WorkerManager;
  private readonly defaultCwd: string;
  private readonly configDir?: string;
  private readonly runChangeListeners = new Set<(run: WorkerRun) => void>();

  constructor(options: AgentWorkerServiceOptions = {}) {
    this.manager = options.manager ?? new WorkerManager({ onRunChange: (run) => this.notifyRunChange(run) });
    this.defaultCwd = options.defaultCwd ?? process.cwd();
    this.configDir = options.configDir;
  }

  resolveCwd(explicitCwd?: string, fallbackCwd?: string): string {
    return resolveWorkerCwd(explicitCwd, fallbackCwd ?? this.defaultCwd);
  }

  resolveRequest(request: WorkerRequest): ResolvedWorkerRequest {
    return this.resolveRequestWithDefaults(request, {});
  }

  async resolveRequestWithConfig(request: WorkerRequest): Promise<ResolvedWorkerRequest> {
    const cwd = this.resolveCwd(request.cwd);
    const scope = resolveWorkspaceScope(cwd);
    const config = await readWorkspaceConfig({
      ...(this.configDir ? { configDir: this.configDir } : {}),
      scopeKey: scope.scopeKey,
      scopeLabel: scope.scopeLabel,
    });
    return this.resolveRequestWithDefaults(request, {
      cwd,
      defaultProfile: request.adapter === undefined ? config.defaultProfile : undefined,
      defaultAdapter: config.defaultAdapter,
      defaultTimeoutMs: config.defaultTimeoutMs,
      customProfiles: config.profiles,
    });
  }

  async start(request: WorkerRequest): Promise<WorkerRun> {
    const resolved = await this.resolveRequestWithConfig(request);
    const validation = validateWorkerWorkspace(resolved.cwd, { task: request.task });
    if (validation.errors.length > 0) throw new Error(validation.errors.join("\n"));
    const scope = resolveWorkspaceScope(resolved.cwd);
    return this.manager.startRun({
      adapter: resolved.adapter,
      task: resolved.task,
      taskPreview: textPreview(request.task, 80),
      originalTaskPreview: textPreview(request.task, 80),
      cwd: resolved.cwd,
      durationMs: resolved.durationMs,
      timeoutMs: resolved.timeoutMs,
      profile: resolved.profile,
      mode: resolved.mode,
      readOnly: resolved.readOnly,
      canModifyWorkspace: resolved.canModifyWorkspace,
      workspaceKey: scope.scopeKey,
      scopeKey: scope.scopeKey,
      scopeLabel: scope.scopeLabel,
      ...(scope.gitRoot ? { gitRoot: scope.gitRoot } : {}),
    });
  }

  async waitForRun(id: string, waitMs?: number): Promise<{ run: WorkerRun; completed: boolean }> {
    const completion = this.manager.waitForRun(id);
    return waitForRunWithLimit(completion, () => this.getRun(id), waitMs);
  }

  getRun(id: string): WorkerRun | undefined {
    return this.manager.getRun(id);
  }

  listRuns(): WorkerRun[] {
    return this.manager.listRuns();
  }

  async listRunHistory(options?: number | AgentWorkerHistoryOptions): Promise<WorkerRunHistoryEntry[]> {
    return this.manager.listRunHistory(this.resolveHistoryOptions(options));
  }

  async listProfiles(cwd = this.defaultCwd): Promise<WorkerProfile[]> {
    const config = await this.getWorkspaceConfig(cwd);
    return getWorkerProfiles(config.profiles);
  }

  async getWorkspaceConfig(cwd = this.defaultCwd): Promise<WorkspaceAgentWorkerConfig> {
    const scope = resolveWorkspaceScope(cwd);
    return readWorkspaceConfig({
      ...(this.configDir ? { configDir: this.configDir } : {}),
      scopeKey: scope.scopeKey,
      scopeLabel: scope.scopeLabel,
    });
  }

  cancelRun(id: string): WorkerRun {
    return this.manager.cancelRun(id);
  }

  cancelAll(): void {
    this.manager.cancelAll();
  }

  onRunChange(listener: (run: WorkerRun) => void): () => void {
    this.runChangeListeners.add(listener);
    return () => this.runChangeListeners.delete(listener);
  }

  private notifyRunChange(run: WorkerRun): void {
    for (const listener of this.runChangeListeners) listener({ ...run });
  }

  private resolveHistoryOptions(options?: number | AgentWorkerHistoryOptions): { limit?: number; scopeKey?: string; allScopes?: boolean } {
    if (typeof options === "number") return { limit: options, allScopes: true };
    if (options?.allScopes) return { ...(options.limit === undefined ? {} : { limit: options.limit }), allScopes: true };
    const scopeKey = options?.scopeKey ?? resolveWorkspaceScope(options?.cwd ?? this.defaultCwd).scopeKey;
    return {
      ...(options?.limit === undefined ? {} : { limit: options.limit }),
      scopeKey,
    };
  }
  private resolveRequestWithDefaults(
    request: WorkerRequest,
    defaults: { cwd?: string; defaultProfile?: string; defaultAdapter?: WorkerRequest["adapter"]; defaultTimeoutMs?: number; customProfiles?: WorkerProfile[] },
  ): ResolvedWorkerRequest {
    const profileName = request.profile ?? defaults.defaultProfile;
    const profile = profileName ? resolveWorkerProfile(profileName, defaults.customProfiles) : undefined;
    const systemPrompt = request.systemPrompt ?? profile?.systemPrompt;
    const task = systemPrompt ? formatPromptedTask(systemPrompt, request.task) : request.task;

    const adapter = request.adapter ?? profile?.adapter ?? defaults.defaultAdapter ?? "demo";
    const readOnly = profile ? profile.readOnly : adapter === "demo";
    const canModifyWorkspace = profile ? profile.canModifyWorkspace : adapter !== "demo";

    return {
      adapter,
      ...(profileName ? { profile: profileName } : {}),
      mode: request.mode ?? profile?.mode ?? "custom",
      task,
      cwd: defaults.cwd ?? this.resolveCwd(request.cwd),
      ...(systemPrompt ? { systemPrompt } : {}),
      ...(request.model ?? profile?.model ? { model: request.model ?? profile?.model } : {}),
      ...(request.timeoutMs ?? defaults.defaultTimeoutMs ?? profile?.defaultTimeoutMs ? { timeoutMs: request.timeoutMs ?? defaults.defaultTimeoutMs ?? profile?.defaultTimeoutMs } : {}),
      ...(request.durationMs === undefined ? {} : { durationMs: request.durationMs }),
      requireConfirmation: request.requireConfirmation ?? profile?.requireConfirmation ?? isRealAdapter(adapter),
      readOnly,
      canModifyWorkspace,
      ...(request.metadata ? { metadata: { ...request.metadata } } : {}),
    };
  }
}

export function workerResultFromRun(run: WorkerRun, options: { metadata?: Record<string, unknown>; error?: string } = {}): WorkerResult {
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
    ...(run.finalTextPreview ? { finalText: run.finalTextPreview } : {}),
    usage: { ...run.usage },
    activity: [...(run.activity ?? [])],
    logPath: run.logPath,
    ...(options.error ? { error: options.error } : {}),
    ...(options.metadata ? { metadata: { ...options.metadata } } : {}),
  };
}

export async function waitForRunWithLimit(
  completion: Promise<WorkerRun>,
  getCurrentRun: () => WorkerRun | undefined,
  waitMs?: number,
): Promise<{ run: WorkerRun; completed: boolean }> {
  if (waitMs === undefined) return { run: await completion, completed: true };
  let timeout: NodeJS.Timeout | undefined;
  const waitLimit = new Promise<"wait_timeout">((resolve) => {
    timeout = setTimeout(() => resolve("wait_timeout"), waitMs);
  });
  const result = await Promise.race([completion, waitLimit]);
  if (timeout) clearTimeout(timeout);
  if (result === "wait_timeout") {
    const currentRun = getCurrentRun();
    if (!currentRun) throw new Error("Worker run disappeared while waiting.");
    return { run: currentRun, completed: false };
  }
  return { run: result, completed: true };
}

function formatPromptedTask(systemPrompt: string, task: string): string {
  return [`System prompt:`, systemPrompt.trim(), "", "User task:", task.trim()].join("\n");
}

function isRealAdapter(adapter: WorkerRequest["adapter"]): boolean {
  return adapter === "claude-code" || adapter === "codex-cli";
}
