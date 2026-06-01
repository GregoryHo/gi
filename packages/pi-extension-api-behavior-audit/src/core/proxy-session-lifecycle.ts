import { dirname } from "node:path";

import { createComparisonRunId } from "../adapters/artifacts.ts";
import {
  startRecordingProxy,
  type RecordingWindowHandle,
  type RecordingWindowOptions,
} from "../adapters/recording-proxy.ts";
import type {
  ResolvedTargetCaptureTarget,
  TargetCapturePlan,
  TargetRecorderHandle,
} from "../adapters/target-capture.ts";

export type ProxySessionStatus = "active" | "stopped";
export type RecordingWindowStatus = "active" | "stopped";

export interface PersistentProxyRecorderHandle extends TargetRecorderHandle {
  recording?: boolean;
  beginRecordingWindow?(options: RecordingWindowOptions): Promise<RecordingWindowHandle>;
}

export interface ProxySessionTargetSummary extends Record<string, unknown> {
  targetId: string;
  variant: string;
  side: string;
  proxyUrl: string;
  bootstrapRunId: string;
}

export interface ProxySessionSummary extends Record<string, unknown> {
  proxySessionId: string;
  status: ProxySessionStatus;
  scenarioId: string;
  profileName: string;
  artifactDir: string;
  targets: ProxySessionTargetSummary[];
  startedAt: string;
  stoppedAt?: string;
  activeRecordingWindowId?: string;
  oldProxyUrl?: string;
  newProxyUrl?: string;
}

export interface RecordingWindowTargetSummary extends Record<string, unknown> {
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

export interface RecordingWindowSummary extends Record<string, unknown> {
  recordingWindowId: string;
  proxySessionId: string;
  status: RecordingWindowStatus;
  scenarioId: string;
  comparisonRunId: string;
  targets: RecordingWindowTargetSummary[];
  warnings: string[];
  startedAt: string;
  stoppedAt?: string;
  oldRunDir?: string;
  newRunDir?: string;
}

export interface ProxySessionRegistryOptions {
  createProxySessionId?: () => string;
  createRecordingWindowId?: () => string;
  createComparisonRunId?: () => string;
  now?: () => Date;
}

export interface StartProxySessionDeps {
  startRecorder?: (target: ResolvedTargetCaptureTarget, plan: TargetCapturePlan) => Promise<PersistentProxyRecorderHandle>;
}

export interface StartRecordingWindowOptions {
  comparisonRunId?: string;
  purpose?: string;
}

interface ProxySessionRecord {
  proxySessionId: string;
  status: ProxySessionStatus;
  plan: TargetCapturePlan;
  recorders: Array<{ target: ResolvedTargetCaptureTarget; recorder: PersistentProxyRecorderHandle }>;
  startedAt: string;
  stoppedAt?: string;
  activeRecordingWindowId?: string;
}

interface RecordingWindowRecord {
  recordingWindowId: string;
  proxySessionId: string;
  status: RecordingWindowStatus;
  scenarioId: string;
  comparisonRunId: string;
  targets: Array<{ target: ResolvedTargetCaptureTarget; proxy: PersistentProxyRecorderHandle; window: RecordingWindowHandle }>;
  warnings: string[];
  startedAt: string;
  stoppedAt?: string;
  finalSummary?: RecordingWindowSummary;
}

export class ProxySessionRegistry {
  private readonly proxySessions = new Map<string, ProxySessionRecord>();
  private readonly recordingWindows = new Map<string, RecordingWindowRecord>();
  private readonly createProxySessionId: () => string;
  private readonly createRecordingWindowId: () => string;
  private readonly createComparisonRunId: () => string;
  private readonly now: () => Date;

  constructor(options: ProxySessionRegistryOptions = {}) {
    this.createProxySessionId = options.createProxySessionId ?? createDefaultProxySessionId;
    this.createRecordingWindowId = options.createRecordingWindowId ?? createDefaultRecordingWindowId;
    this.createComparisonRunId = options.createComparisonRunId ?? (() => createComparisonRunId());
    this.now = options.now ?? (() => new Date());
  }

  async startProxySession(plan: TargetCapturePlan, deps: StartProxySessionDeps = {}): Promise<ProxySessionSummary> {
    const startRecorder = deps.startRecorder ?? startPausedTargetRecordingProxy;
    const proxySessionId = this.createUniqueProxySessionId();
    const startedAt = this.now().toISOString();
    const recorders: ProxySessionRecord["recorders"] = [];

    try {
      for (const target of plan.targets) recorders.push({ target, recorder: await startRecorder(target, plan) });
    } catch (error) {
      await Promise.allSettled(recorders.map(({ recorder }) => recorder.stop()));
      throw error;
    }

    const record: ProxySessionRecord = { proxySessionId, status: "active", plan, recorders, startedAt };
    this.proxySessions.set(proxySessionId, record);
    return summarizeProxySession(record);
  }

  listProxySessions(): ProxySessionSummary[] {
    return [...this.proxySessions.values()].map((session) => summarizeProxySession(session));
  }

  async startRecordingWindow(
    proxySessionId: string,
    options: StartRecordingWindowOptions = {},
  ): Promise<RecordingWindowSummary> {
    const session = this.getActiveProxySession(proxySessionId);
    if (session.activeRecordingWindowId) {
      throw new Error(`Proxy session ${proxySessionId} already has an active recording window: ${session.activeRecordingWindowId}`);
    }

    const recordingWindowId = this.createUniqueRecordingWindowId();
    const comparisonRunId = options.comparisonRunId ?? this.createComparisonRunId();
    const startedAt = this.now().toISOString();
    const targets: RecordingWindowRecord["targets"] = [];

    try {
      for (const { target, recorder } of session.recorders) {
        if (!recorder.beginRecordingWindow) throw new Error(`Recorder for target ${target.targetId} does not support recording windows.`);
        const window = await recorder.beginRecordingWindow({
          scenarioId: session.plan.scenarioId,
          comparisonRunId,
          purpose: options.purpose ?? "target-capture-window",
        });
        targets.push({ target, proxy: recorder, window });
      }
    } catch (error) {
      await Promise.allSettled(targets.map(({ window }) => window.finish()));
      throw error;
    }

    const record: RecordingWindowRecord = {
      recordingWindowId,
      proxySessionId,
      status: "active",
      scenarioId: session.plan.scenarioId,
      comparisonRunId,
      targets,
      warnings: [],
      startedAt,
    };
    session.activeRecordingWindowId = recordingWindowId;
    this.recordingWindows.set(recordingWindowId, record);
    return summarizeRecordingWindow(record);
  }

  async stopRecordingWindow(recordingWindowId: string): Promise<RecordingWindowSummary> {
    const window = this.recordingWindows.get(recordingWindowId);
    if (!window) throw new Error(`Recording window not found: ${recordingWindowId}`);
    if (window.status === "stopped" && window.finalSummary) return window.finalSummary;

    await Promise.all(window.targets.map(({ window }) => window.finish()));
    window.status = "stopped";
    window.stoppedAt = this.now().toISOString();
    window.warnings = buildWindowWarnings(window.targets);
    window.finalSummary = summarizeRecordingWindow(window);

    const session = this.proxySessions.get(window.proxySessionId);
    if (session?.activeRecordingWindowId === recordingWindowId) delete session.activeRecordingWindowId;
    return window.finalSummary;
  }

  async stopProxySession(proxySessionId: string): Promise<ProxySessionSummary> {
    const session = this.proxySessions.get(proxySessionId);
    if (!session) throw new Error(`Proxy session not found: ${proxySessionId}`);
    if (session.status === "stopped") return summarizeProxySession(session);

    if (session.activeRecordingWindowId) await this.stopRecordingWindow(session.activeRecordingWindowId);
    await Promise.all(session.recorders.map(({ recorder }) => recorder.stop()));
    session.status = "stopped";
    session.stoppedAt = this.now().toISOString();
    return summarizeProxySession(session);
  }

  async stopAllActiveProxySessions(): Promise<ProxySessionSummary[]> {
    const activeIds = [...this.proxySessions.values()]
      .filter((session) => session.status === "active")
      .map((session) => session.proxySessionId);
    const stopped: ProxySessionSummary[] = [];
    for (const proxySessionId of activeIds) stopped.push(await this.stopProxySession(proxySessionId));
    return stopped;
  }

  private getActiveProxySession(proxySessionId: string): ProxySessionRecord {
    const session = this.proxySessions.get(proxySessionId);
    if (!session) throw new Error(`Proxy session not found: ${proxySessionId}`);
    if (session.status !== "active") throw new Error(`Proxy session is not active: ${proxySessionId}`);
    return session;
  }

  private createUniqueProxySessionId(): string {
    let candidate = this.createProxySessionId();
    while (this.proxySessions.has(candidate)) candidate = this.createProxySessionId();
    return candidate;
  }

  private createUniqueRecordingWindowId(): string {
    let candidate = this.createRecordingWindowId();
    while (this.recordingWindows.has(candidate)) candidate = this.createRecordingWindowId();
    return candidate;
  }
}

let defaultProxySessionCounter = 0;
let defaultRecordingWindowCounter = 0;

function createDefaultProxySessionId(): string {
  defaultProxySessionCounter += 1;
  return `proxy-session-${Date.now()}-${defaultProxySessionCounter}`;
}

function createDefaultRecordingWindowId(): string {
  defaultRecordingWindowCounter += 1;
  return `recording-window-${Date.now()}-${defaultRecordingWindowCounter}`;
}

async function startPausedTargetRecordingProxy(
  target: ResolvedTargetCaptureTarget,
  plan: TargetCapturePlan,
): Promise<PersistentProxyRecorderHandle> {
  return startRecordingProxy({
    side: target.side,
    listenHost: "127.0.0.1",
    listenPort: target.recorderPort,
    targetBaseUrl: target.upstreamTargetUrl,
    artifactDir: plan.artifactDir,
    scenarioId: plan.scenarioId,
    targetId: target.targetId,
    variant: target.variant,
    purpose: "persistent-proxy-session",
    record: false,
  });
}

function summarizeProxySession(session: ProxySessionRecord): ProxySessionSummary {
  const targets = session.recorders.map(({ target, recorder }) => ({
    targetId: target.targetId,
    variant: target.variant,
    side: target.side,
    proxyUrl: recorder.listenUrl,
    bootstrapRunId: recorder.runId,
  }));
  return {
    proxySessionId: session.proxySessionId,
    status: session.status,
    scenarioId: session.plan.scenarioId,
    profileName: session.plan.profileName,
    artifactDir: session.plan.artifactDir,
    targets,
    startedAt: session.startedAt,
    ...(session.stoppedAt ? { stoppedAt: session.stoppedAt } : {}),
    ...(session.activeRecordingWindowId ? { activeRecordingWindowId: session.activeRecordingWindowId } : {}),
    ...buildProxyAliases(targets),
  };
}

function summarizeRecordingWindow(window: RecordingWindowRecord): RecordingWindowSummary {
  const targets = window.targets.map(({ target, proxy, window: recordingWindow }) => ({
    targetId: target.targetId,
    variant: target.variant,
    side: target.side,
    runId: recordingWindow.runId,
    runDir: dirname(recordingWindow.manifestPath),
    proxyUrl: proxy.listenUrl,
    manifestPath: recordingWindow.manifestPath,
    exchangesPath: recordingWindow.exchangesPath,
    exchangeCount: recordingWindow.exchangeCount,
  }));
  return {
    recordingWindowId: window.recordingWindowId,
    proxySessionId: window.proxySessionId,
    status: window.status,
    scenarioId: window.scenarioId,
    comparisonRunId: window.comparisonRunId,
    targets,
    warnings: [...window.warnings],
    startedAt: window.startedAt,
    ...(window.stoppedAt ? { stoppedAt: window.stoppedAt } : {}),
    ...buildWindowAliases(targets),
  };
}

function buildProxyAliases(targets: ProxySessionTargetSummary[]): Partial<ProxySessionSummary> {
  const oldTarget = targets.find((target) => isAliasTarget(target, "old"));
  const newTarget = targets.find((target) => isAliasTarget(target, "new"));
  return {
    ...(oldTarget ? { oldProxyUrl: oldTarget.proxyUrl } : {}),
    ...(newTarget ? { newProxyUrl: newTarget.proxyUrl } : {}),
  };
}

function buildWindowAliases(targets: RecordingWindowTargetSummary[]): Partial<RecordingWindowSummary> {
  const oldTarget = targets.find((target) => isAliasTarget(target, "old"));
  const newTarget = targets.find((target) => isAliasTarget(target, "new"));
  return {
    ...(oldTarget ? { oldRunDir: oldTarget.runDir } : {}),
    ...(newTarget ? { newRunDir: newTarget.runDir } : {}),
  };
}

function isAliasTarget(target: { targetId: string; variant: string; side: string }, alias: "old" | "new"): boolean {
  const marker = `${target.targetId}:${target.variant}:${target.side}`.toLowerCase();
  if (alias === "old") return marker.includes("old") || marker.includes("baseline");
  return marker.includes("new") || marker.includes("candidate");
}

function buildWindowWarnings(targets: RecordingWindowRecord["targets"]): string[] {
  return targets
    .filter(({ window }) => window.exchangeCount === 0)
    .map(
      ({ target }) =>
        `No upstream exchanges were recorded for target ${target.targetId}; confirm the app points to ${target.recorderUrl}.`,
    );
}
