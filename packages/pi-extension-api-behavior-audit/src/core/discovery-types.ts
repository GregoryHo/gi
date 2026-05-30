import type { Page } from "playwright";

import type { ApiSide, BrowserVisibleApiObservation, CandidatePageContext } from "../types.ts";

export interface ProfileConfigV1 {
  version: 1;
  profiles: Record<string, ProfileV1>;
  defaultProfile?: string;
}

export interface ProfileV1 {
  oldUrl: string;
  newUrl: string;
  oldTargetUrl: string;
  newTargetUrl: string;
  oldProxyPort?: number;
  newProxyPort?: number;
  allowHosts?: string[];
}

export interface ProfileConfigV2 {
  version: 2;
  profiles: Record<string, ProfileV2>;
  defaultProfile?: string;
}

export interface ProfileV2 {
  targets: Record<string, ProfileTargetV2>;
  groups?: Record<string, string[]>;
}

export interface ProfileTargetV2 {
  variant: string;
  side?: ApiSide;
  frontendUrl: string;
  upstreamTargetUrl: string;
  recorderPort: number;
  allowHosts?: string[];
}

export interface NormalizedProfile {
  profileName: string;
  targets: Record<string, ProfileTargetV2>;
  groups: Record<string, string[]>;
}

export interface ScenarioDiscoveryPlanInput {
  artifactDir?: string;
  profileName?: string;
  candidateScenarioId: string;
  targetIds?: string[];
  groupName?: string;
  candidatePagePath?: string;
}

export interface ScenarioDiscoveryTarget {
  targetId: string;
  variant: string;
  side: ApiSide;
  frontendUrl: string;
  upstreamTargetUrl: string;
  recorderPort: number;
  recorderUrl: string;
  allowHosts: string[];
  candidatePagePath?: string;
}

export interface ScenarioDiscoveryPlan {
  artifactDir: string;
  profileName: string;
  candidateScenarioId: string;
  candidatePagePath?: string;
  targets: ScenarioDiscoveryTarget[];
}

export interface FinishScenarioDiscoveryRecordingOptions {
  candidatePage?: CandidatePageContext;
  browserVisibleRequests?: BrowserVisibleApiObservation[];
}

export interface ScenarioDiscoveryRecordedArtifact {
  runId: string;
  listenUrl?: string;
  manifestPath: string;
  exchangesPath: string;
  exchangeCount: number;
  candidatePage?: CandidatePageContext;
  finish?(options?: FinishScenarioDiscoveryRecordingOptions): Promise<void>;
}

export interface ScenarioDiscoveryRecorderHandle extends ScenarioDiscoveryRecordedArtifact {
  listenUrl: string;
  recording?: boolean;
  setRecording?(recording: boolean): Promise<void>;
  beginRecordingWindow?(options: {
    scenarioId: string;
    purpose?: string;
    candidateScenarioId?: string;
    discoverySessionId?: string;
    comparisonRunId?: string;
  }): Promise<ScenarioDiscoveryRecordedArtifact>;
  stop(): Promise<void>;
}

export interface ScenarioDiscoveryPrompts {
  confirm(message: string): Promise<boolean>;
  notify?(message: string): void;
}

export interface ScenarioDiscoveryDeps {
  startRecorder?: (target: ScenarioDiscoveryTarget, plan: ScenarioDiscoveryPlan) => Promise<ScenarioDiscoveryRecorderHandle>;
  runManualPageAction?: (
    target: ScenarioDiscoveryTarget,
    plan: ScenarioDiscoveryPlan,
    prompts: ScenarioDiscoveryPrompts,
  ) => Promise<void>;
}

export interface ScenarioDiscoveryCaptureWindowDeps {
  captureBrowserPageContext?: (
    target: ScenarioDiscoveryTarget,
    input: ScenarioDiscoveryCaptureWindowInput,
    prompts: ScenarioDiscoveryPrompts,
  ) => Promise<CandidatePageContext>;
}

export interface ScenarioDiscoveryBrowserHandle {
  target: ScenarioDiscoveryTarget;
  page: Page;
  getCandidatePageContext(): CandidatePageContext;
  startBrowserVisibleApiCapture(): { observations: BrowserVisibleApiObservation[]; stop(): void };
  close(): Promise<void>;
}

export interface ScenarioDiscoveryResult {
  recorders: Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecordedArtifact }>;
  warnings: string[];
}

export interface ScenarioDiscoveryCaptureWindowInput {
  candidateScenarioId: string;
  candidatePagePath?: string;
  comparisonRunId?: string;
  browser?: boolean;
}

export interface PreparedScenarioDiscoverySession {
  sessionId: string;
  plan: ScenarioDiscoveryPlan;
  recorders: Array<{ target: ScenarioDiscoveryTarget; recorder: ScenarioDiscoveryRecorderHandle }>;
}
