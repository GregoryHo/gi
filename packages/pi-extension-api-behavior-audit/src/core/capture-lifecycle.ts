import { dirname } from "node:path";

import {
  startTargetRecordingProxy,
  type ResolvedTargetCaptureTarget,
  type TargetCapturePlan,
  type TargetRecorderHandle,
} from "../adapters/target-capture.ts";

export type CaptureSessionStatus = "active" | "stopped";

export interface CaptureSessionTargetSummary extends Record<string, unknown> {
  targetId: string;
  variant: string;
  side: string;
  runId: string;
  runDir: string;
  proxyUrl: string;
  manifestPath: string;
  exchangesPath: string;
  exchangeCount: number;
}

export interface CaptureSessionSummary extends Record<string, unknown> {
  captureSessionId: string;
  status: CaptureSessionStatus;
  scenarioId: string;
  profileName: string;
  artifactDir: string;
  targets: CaptureSessionTargetSummary[];
  warnings: string[];
  startedAt: string;
  stoppedAt?: string;
  oldRunDir?: string;
  newRunDir?: string;
  oldProxyUrl?: string;
  newProxyUrl?: string;
}

export interface CaptureSessionRegistryOptions {
  createSessionId?: () => string;
  now?: () => Date;
}

export interface StartCaptureSessionDeps {
  startRecorder?: (target: ResolvedTargetCaptureTarget, plan: TargetCapturePlan) => Promise<TargetRecorderHandle>;
}

interface CaptureSessionRecord {
  captureSessionId: string;
  status: CaptureSessionStatus;
  plan: TargetCapturePlan;
  recorders: Array<{ target: ResolvedTargetCaptureTarget; recorder: TargetRecorderHandle }>;
  startedAt: string;
  stoppedAt?: string;
  warnings: string[];
  finalSummary?: CaptureSessionSummary;
}

export class CaptureSessionRegistry {
  private readonly sessions = new Map<string, CaptureSessionRecord>();
  private readonly createSessionId: () => string;
  private readonly now: () => Date;

  constructor(options: CaptureSessionRegistryOptions = {}) {
    this.createSessionId = options.createSessionId ?? createDefaultCaptureSessionId;
    this.now = options.now ?? (() => new Date());
  }

  async start(plan: TargetCapturePlan, deps: StartCaptureSessionDeps = {}): Promise<CaptureSessionSummary> {
    const startRecorder = deps.startRecorder ?? startTargetRecordingProxy;
    const captureSessionId = this.createUniqueSessionId();
    const startedAt = this.now().toISOString();
    const recorders: CaptureSessionRecord["recorders"] = [];

    try {
      for (const target of plan.targets) {
        recorders.push({ target, recorder: await startRecorder(target, plan) });
      }
    } catch (error) {
      await Promise.allSettled(recorders.map(({ recorder }) => recorder.stop()));
      throw error;
    }

    const record: CaptureSessionRecord = {
      captureSessionId,
      status: "active",
      plan,
      recorders,
      startedAt,
      warnings: [],
    };
    this.sessions.set(captureSessionId, record);
    return summarizeSession(record);
  }

  listActive(): CaptureSessionSummary[] {
    return [...this.sessions.values()].filter((session) => session.status === "active").map((session) => summarizeSession(session));
  }

  async stop(captureSessionId: string): Promise<CaptureSessionSummary> {
    const session = this.sessions.get(captureSessionId);
    if (!session) throw new Error(`Capture session not found: ${captureSessionId}`);
    if (session.status === "stopped" && session.finalSummary) return session.finalSummary;

    await Promise.all(session.recorders.map(({ recorder }) => recorder.stop()));
    session.status = "stopped";
    session.stoppedAt = this.now().toISOString();
    session.warnings = buildWarnings(session.recorders);
    session.finalSummary = summarizeSession(session);
    return session.finalSummary;
  }

  async stopAllActive(): Promise<CaptureSessionSummary[]> {
    const activeIds = [...this.sessions.values()]
      .filter((session) => session.status === "active")
      .map((session) => session.captureSessionId);
    const stopped: CaptureSessionSummary[] = [];
    for (const captureSessionId of activeIds) {
      stopped.push(await this.stop(captureSessionId));
    }
    return stopped;
  }

  private createUniqueSessionId(): string {
    let candidate = this.createSessionId();
    while (this.sessions.has(candidate)) candidate = this.createSessionId();
    return candidate;
  }
}

let defaultSessionCounter = 0;

function createDefaultCaptureSessionId(): string {
  defaultSessionCounter += 1;
  return `capture-${Date.now()}-${defaultSessionCounter}`;
}

function summarizeSession(session: CaptureSessionRecord): CaptureSessionSummary {
  const targets = session.recorders.map(({ target, recorder }) => ({
    targetId: target.targetId,
    variant: target.variant,
    side: target.side,
    runId: recorder.runId,
    runDir: dirname(recorder.manifestPath),
    proxyUrl: recorder.listenUrl,
    manifestPath: recorder.manifestPath,
    exchangesPath: recorder.exchangesPath,
    exchangeCount: recorder.exchangeCount,
  }));
  return {
    captureSessionId: session.captureSessionId,
    status: session.status,
    scenarioId: session.plan.scenarioId,
    profileName: session.plan.profileName,
    artifactDir: session.plan.artifactDir,
    targets,
    warnings: [...session.warnings],
    startedAt: session.startedAt,
    ...(session.stoppedAt ? { stoppedAt: session.stoppedAt } : {}),
    ...buildOldNewAliases(targets),
  };
}

function buildOldNewAliases(targets: CaptureSessionTargetSummary[]): Partial<CaptureSessionSummary> {
  const oldTarget = targets.find((target) => isAliasTarget(target, "old"));
  const newTarget = targets.find((target) => isAliasTarget(target, "new"));
  return {
    ...(oldTarget ? { oldRunDir: oldTarget.runDir, oldProxyUrl: oldTarget.proxyUrl } : {}),
    ...(newTarget ? { newRunDir: newTarget.runDir, newProxyUrl: newTarget.proxyUrl } : {}),
  };
}

function isAliasTarget(target: CaptureSessionTargetSummary, alias: "old" | "new"): boolean {
  const marker = `${target.targetId}:${target.variant}:${target.side}`.toLowerCase();
  if (alias === "old") return marker.includes("old") || marker.includes("baseline");
  return marker.includes("new") || marker.includes("candidate");
}

function buildWarnings(recorders: CaptureSessionRecord["recorders"]): string[] {
  return recorders
    .filter(({ recorder }) => recorder.exchangeCount === 0)
    .map(
      ({ target }) =>
        `No upstream exchanges were recorded for target ${target.targetId}; confirm the app points to ${target.recorderUrl}.`,
    );
}
