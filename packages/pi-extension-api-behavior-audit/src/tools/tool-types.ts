import type { ScenarioDiscoveryDeps } from "../discovery.ts";
import type { EnvironmentProfile } from "../environment-profiles.ts";
import type { TargetCaptureDeps } from "../target-capture.ts";
import type { runAccountActivityUpstreamCapture } from "../upstream-account-activity.ts";
import type { runTargetCapture } from "../target-capture.ts";
import type { runScenarioDiscovery } from "../discovery.ts";

export interface ToolTextResult<TDetails extends Record<string, unknown>> {
  content: Array<{ type: "text"; text: string }>;
  details: TDetails;
}

export interface ListScenariosParams {
  scenarioDictionaryPath?: string;
}

export interface ValidateRunParams {
  runDir: string;
  verifyExchangeCount?: boolean;
}

export interface UpstreamCaptureToolParams {
  scenarioId: string;
  profileName?: string;
  oldUrl?: string;
  newUrl?: string;
  oldTargetUrl?: string;
  newTargetUrl?: string;
  oldProxyPort?: number;
  newProxyPort?: number;
  artifactDir?: string;
  scenarioDictionaryPath?: string;
  allowHosts?: string[];
}

export interface EnvironmentProfileToolParams extends Partial<EnvironmentProfile> {
  artifactDir?: string;
  profileName: string;
  makeDefault?: boolean;
}

export interface ShowEnvironmentProfilesToolParams {
  artifactDir?: string;
}

export interface ClearEnvironmentProfileToolParams {
  artifactDir?: string;
  profileName: string;
}

export interface TargetCaptureToolParams {
  artifactDir?: string;
  profileName?: string;
  scenarioId: string;
  scenarioDictionaryPath?: string;
  targetIds?: string[];
  groupName?: string;
}

export interface ScenarioDiscoveryToolParams {
  artifactDir?: string;
  profileName?: string;
  candidateScenarioId: string;
  targetIds?: string[];
  groupName?: string;
  candidatePagePath?: string;
}

export interface AccountActivityToolParams {
  oldUrl?: string;
  newUrl?: string;
  oldTargetUrl: string;
  newTargetUrl: string;
  oldProxyPort?: number;
  newProxyPort?: number;
  artifactDir?: string;
  manifestPath?: string;
  allowHosts?: string[];
}

export interface ToolUiAdapter {
  hasUI: boolean;
  confirm(title: string, message: string): Promise<boolean>;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

export interface RunAccountActivityToolDeps {
  runCapture?: typeof runAccountActivityUpstreamCapture;
}

export interface RunTargetCaptureToolDeps extends TargetCaptureDeps {
  runCapture?: typeof runTargetCapture;
}

export interface RunScenarioDiscoveryToolDeps extends ScenarioDiscoveryDeps {
  runDiscovery?: typeof runScenarioDiscovery;
}

export const DEFAULT_OLD_URL = "http://localhost:8080";
export const DEFAULT_NEW_URL = "http://localhost:8008";
export const DEFAULT_OLD_PROXY_PORT = 18080;
export const DEFAULT_NEW_PROXY_PORT = 18081;
