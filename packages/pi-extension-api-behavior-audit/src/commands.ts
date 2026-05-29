import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  createWorkspacePathContext,
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
  resolveWorkspacePath,
  type WorkspacePathContext,
} from "./workspace-paths.ts";

import { createComparisonRunId, writeComparisonRun } from "./artifacts.ts";
import { runAccountActivityLayerACapture, ACCOUNT_ACTIVITY_SCENARIO_ID } from "./browser-capture.ts";
import { analyzeComparisonRun, ComparisonAnalysisError } from "./comparison-analysis.ts";
import { buildApiAuditDashboardLines } from "./dashboard.ts";
import { ApiAuditConfigError, parseAccountActivityCaptureArgs } from "./config.ts";
import {
  buildScenarioDiscoveryPreparation,
  capturePreparedScenarioDiscoveryWindow,
  formatPreparedScenarioDiscoverySessions,
  openScenarioDiscoveryBrowserTarget,
  prepareScenarioDiscoverySession,
  resolveScenarioDiscoveryPlan,
  runScenarioDiscovery,
  ScenarioDiscoveryError,
  stopPreparedScenarioDiscoverySession,
  type PreparedScenarioDiscoverySession,
  type ScenarioDiscoveryBrowserHandle,
  type ScenarioDiscoveryRecordedArtifact,
  type ScenarioDiscoveryTarget,
} from "./discovery.ts";
import { EnvironmentProfileError, executeProfileCommand } from "./environment-profiles.ts";
import { parseRecordingProxyArgs, ProxyConfigError } from "./proxy-config.ts";
import { generateScenarioSuggestion, ScenarioSuggestionError, validateScenarioSuggestion } from "./scenario-suggestion.ts";
import { startRecordingProxy, type RecordingProxyHandle } from "./recording-proxy.ts";
import { getScenario, loadScenarioManifest } from "./scenarios.ts";
import {
  API_DISCOVERY_ANALYZE_COMMAND,
  API_DISCOVERY_CREATE_COMMAND,
  API_DISCOVERY_FINISH_COMMAND,
  API_DISCOVERY_OPEN_COMMAND,
  API_DISCOVERY_RECORD_COMMAND,
  API_DISCOVERY_SCENARIO_COMMAND,
  API_DISCOVERY_STATUS_COMMAND,
  API_DISCOVERY_STOP_COMMAND,
  API_DISCOVERY_SUGGEST_COMMAND,
  API_DISCOVERY_VALIDATE_SUGGESTION_COMMAND,
  PACKAGE_COMMAND,
  PACKAGE_KEY,
} from "./package-info.ts";
import { buildTargetCapturePreparation, resolveTargetCapturePlan, runTargetCapture, TargetCaptureError } from "./target-capture.ts";
import {
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
  AccountActivityUpstreamConfigError,
} from "./upstream-account-activity.ts";
import type { ComparisonRunArtifact, ComparisonRunTargetArtifact } from "./types.ts";

export type ApiAuditParsedCommand =
  | { kind: "status" }
  | { kind: "account-activity"; args: string }
  | { kind: "proxy"; args: string }
  | { kind: "account-activity-upstream"; args: string }
  | { kind: "profile"; args: string }
  | { kind: "setup"; args: string }
  | { kind: "capture"; args: string }
  | { kind: "discover"; args: string };

export function parseApiAuditCommand(args: string): ApiAuditParsedCommand {
  const trimmed = args.trim();
  if (!trimmed) return { kind: "status" };
  const command = trimmed.split(/\s+/, 1)[0];
  if (command === "account-activity") return { kind: "account-activity", args: trimmed };
  if (command === "proxy") return { kind: "proxy", args: trimmed };
  if (command === "account-activity-upstream") return { kind: "account-activity-upstream", args: trimmed };
  if (command === "profile") return { kind: "profile", args: trimmed };
  if (command === "setup") return { kind: "setup", args: trimmed };
  if (command === "capture") return { kind: "capture", args: trimmed };
  if (command === "discover") return { kind: "discover", args: trimmed };
  return { kind: "status" };
}

export interface ApiAuditCaptureCommandConfig {
  scenarioId?: string;
  profileName?: string;
  artifactDir: string;
  scenarioDictionaryPath?: string;
  targetIds?: string[];
  groupName?: string;
  run: boolean;
}

export interface ApiAuditDiscoverCommandConfig {
  action: "start" | "capture" | "status" | "stop";
  candidateScenarioId?: string;
  profileName?: string;
  artifactDir: string;
  targetIds: string[];
  groupName?: string;
  candidatePagePath?: string;
  sessionId?: string;
  browser: boolean;
  run: boolean;
}

export interface ApiDiscoveryCreateCommandConfig {
  profileName?: string;
  artifactDir: string;
  targetIds: string[];
  groupName?: string;
}

export interface ApiDiscoveryOpenCommandConfig {
  targetId: string;
  candidatePagePath?: string;
}

export interface ApiDiscoveryAnalyzeCommandConfig {
  comparisonPath: string;
  artifactDir?: string;
  scenarioDictionaryPath?: string;
}

export interface ApiDiscoverySuggestCommandConfig {
  analysisPath: string;
  artifactDir?: string;
  scenarioDictionaryPath?: string;
}

export interface ApiDiscoveryValidateSuggestionCommandConfig {
  suggestionPath: string;
  scenarioDictionaryPath?: string;
}

export function parseApiAuditCaptureArgs(args: string): ApiAuditCaptureCommandConfig {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const command = tokens.shift();
  if (command !== "capture") throw new Error("Unknown capture command. Expected: capture");
  const flags = parseFlags(tokens);
  const scenarioDictionaryPath = optionalStringFlag(flags, "scenario-dictionary");
  const groupName = optionalStringFlag(flags, "group");
  return {
    scenarioId: optionalStringFlag(flags, "scenario-id") ?? optionalStringFlag(flags, "scenario"),
    profileName: optionalStringFlag(flags, "profile"),
    artifactDir: optionalStringFlag(flags, "artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    ...(scenarioDictionaryPath ? { scenarioDictionaryPath } : {}),
    targetIds: toArray(flags.target),
    ...(groupName ? { groupName } : {}),
    run: flags.run === "true",
  };
}

export function parseApiAuditDiscoverArgs(args: string): ApiAuditDiscoverCommandConfig {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const command = tokens.shift();
  if (command !== "discover") throw new Error("Unknown discover command. Expected: discover");
  const explicitAction = parseDiscoverAction(tokens[0]);
  const actionToken = explicitAction ? tokens.shift() : undefined;
  const flags = parseFlags(tokens);
  const run = flags.run === "true";
  const action = explicitAction ?? (run ? "capture" : "start");
  const groupName = optionalStringFlag(flags, "group");
  const candidatePagePath = optionalStringFlag(flags, "candidate-page-path") ?? optionalStringFlag(flags, "page-path");
  const sessionId = optionalStringFlag(flags, "session");
  const candidateScenarioId = optionalStringFlag(flags, "scenario-id") ?? optionalStringFlag(flags, "candidate-scenario-id");
  const profileName = optionalStringFlag(flags, "profile");
  return {
    action,
    ...(candidateScenarioId ? { candidateScenarioId } : {}),
    ...(profileName ? { profileName } : {}),
    artifactDir: optionalStringFlag(flags, "artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    targetIds: toArray(flags.target),
    ...(groupName ? { groupName } : {}),
    ...(candidatePagePath ? { candidatePagePath } : {}),
    ...(sessionId ? { sessionId } : {}),
    browser: flags.browser === "true",
    run: run || actionToken === "capture",
  };
}

export function parseApiDiscoveryValidateSuggestionArgs(args: string): ApiDiscoveryValidateSuggestionCommandConfig {
  const flags = parseFlags(args.trim().split(/\s+/).filter(Boolean));
  const suggestionPath = optionalStringFlag(flags, "suggestion");
  if (!suggestionPath) throw new Error("--suggestion is required");
  const scenarioDictionaryPath = optionalStringFlag(flags, "scenario-dictionary");
  return {
    suggestionPath,
    ...(scenarioDictionaryPath ? { scenarioDictionaryPath } : {}),
  };
}

export function parseApiDiscoverySuggestArgs(args: string): ApiDiscoverySuggestCommandConfig {
  const flags = parseFlags(args.trim().split(/\s+/).filter(Boolean));
  const analysisPath = optionalStringFlag(flags, "analysis");
  if (!analysisPath) throw new Error("--analysis is required");
  const artifactDir = optionalStringFlag(flags, "artifact-dir");
  const scenarioDictionaryPath = optionalStringFlag(flags, "scenario-dictionary");
  return {
    analysisPath,
    ...(artifactDir ? { artifactDir } : {}),
    ...(scenarioDictionaryPath ? { scenarioDictionaryPath } : {}),
  };
}

export function parseApiDiscoveryAnalyzeArgs(args: string): ApiDiscoveryAnalyzeCommandConfig {
  const flags = parseFlags(args.trim().split(/\s+/).filter(Boolean));
  const comparisonPath = optionalStringFlag(flags, "comparison");
  if (!comparisonPath) throw new Error("--comparison is required");
  const artifactDir = optionalStringFlag(flags, "artifact-dir");
  const scenarioDictionaryPath = optionalStringFlag(flags, "scenario-dictionary");
  return {
    comparisonPath,
    ...(artifactDir ? { artifactDir } : {}),
    ...(scenarioDictionaryPath ? { scenarioDictionaryPath } : {}),
  };
}

export function parseApiDiscoveryCreateArgs(args: string): ApiDiscoveryCreateCommandConfig {
  const flags = parseFlags(args.trim().split(/\s+/).filter(Boolean));
  const groupName = optionalStringFlag(flags, "group");
  return {
    profileName: optionalStringFlag(flags, "profile"),
    artifactDir: optionalStringFlag(flags, "artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    targetIds: toArray(flags.target),
    ...(groupName ? { groupName } : {}),
  };
}

export function parseApiDiscoveryScenarioArgs(args: string): string {
  const scenarioId = args.trim();
  if (!scenarioId) throw new Error("scenario id is required");
  if (/\s/.test(scenarioId)) throw new Error("scenario id must not contain whitespace");
  return scenarioId;
}

export function parseApiDiscoveryOpenArgs(args: string): ApiDiscoveryOpenCommandConfig {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const targetId = tokens.shift();
  if (!targetId) throw new Error("target id is required");
  const flags = parseFlags(tokens);
  const candidatePagePath = optionalStringFlag(flags, "page-path") ?? optionalStringFlag(flags, "candidate-page-path");
  return { targetId, ...(candidatePagePath ? { candidatePagePath } : {}) };
}

export function getApiAuditSetupLines(): string[] {
  return [
    "API audit setup",
    "1. Show profiles: /api-audit profile show",
    "2. Save a profile: /api-audit profile save uat --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --default",
    "3. Prepare target capture: /api-audit capture --scenario-id account-activity-basic --profile uat",
    "4. Discover a new candidate flow: /api-audit discover --scenario-id forward-game+transfer --profile uat --target new",
    "Tip: discovery lets you manually operate a page before the scenario exists in the dictionary.",
  ];
}

export function getApiAuditStatusLines(): string[] {
  return [
    "API behavior audit extension is loaded.",
    "Layer A command: /api-audit account-activity --old-url http://localhost:8080 --new-url http://localhost:8008",
    "Layer B spike: /api-audit proxy --side old --listen-port 18080 --target-url http://localhost:19080",
    "Layer B integrated: /api-audit account-activity-upstream --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --old-proxy-port 18080 --new-proxy-port 18081",
    "Environment profiles: /api-audit profile show | /api-audit profile save uat --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --default",
    "Guided setup: /api-audit setup",
    "Target capture preparation: /api-audit capture --scenario-id account-activity-basic --profile uat [--target new | --group default]",
    "Manual discovery: /api-audit discover --scenario-id forward-game+transfer --profile uat --target new [--run]",
    "Layer A browser-visible capture is validation-only; Layer B upstream capture is the final audit direction.",
  ];
}

function parseDiscoverAction(value: string | undefined): ApiAuditDiscoverCommandConfig["action"] | undefined {
  if (value === "start" || value === "capture" || value === "status" || value === "stop") return value;
  return undefined;
}

function parseFlags(tokens: string[]): Record<string, string | string[]> {
  const flags: Record<string, string | string[]> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (name === "run" || name === "browser") {
      flags[name] = "true";
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    if (name === "target") flags[name] = [...toArray(flags[name]), value];
    else flags[name] = value;
    index += 1;
  }
  return flags;
}

function optionalStringFlag(flags: Record<string, string | string[]>, key: string): string | undefined {
  const value = flags[key];
  if (value === undefined) return undefined;
  if (Array.isArray(value)) throw new Error(`--${key} must be provided once`);
  return value;
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function resolveConfigPaths<T extends object>(
  config: T,
  workspace: WorkspacePathContext,
  pathKeys: string[],
): T {
  const source = config as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  for (const key of pathKeys) {
    const value = source[key];
    if (typeof value === "string") next[key] = resolveWorkspacePath(workspace, value);
    else if (key === "scenarioDictionaryPath" && value === undefined) {
      next.scenarioDictionaryPath = resolveWorkspacePath(workspace, DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH);
    }
  }
  return next as T;
}

function resolveCommandPathFlags(
  args: string,
  workspace: WorkspacePathContext,
  pathFlags: string[],
  defaultFlags: Record<string, string> = {},
): string {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    if (!pathFlags.includes(name)) continue;
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) continue;
    tokens[index + 1] = resolveWorkspacePath(workspace, value);
    seen.add(name);
    index += 1;
  }
  for (const [name, value] of Object.entries(defaultFlags)) {
    if (!seen.has(name)) tokens.push(`--${name}`, resolveWorkspacePath(workspace, value));
  }
  return tokens.join(" ");
}

export function registerApiAuditCommands(pi: ExtensionAPI): void {
  const activeProxies: RecordingProxyHandle[] = [];
  const activeDiscoverySessions = new Map<string, PreparedScenarioDiscoverySession>();
  let activeDiscoveryScenarioId = "scenario-discovery-session";
  let activeComparisonRunId = createComparisonRunId();
  let activeComparisonCreatedAt = new Date().toISOString();
  const activeComparisonTargets: Record<string, ComparisonRunTargetArtifact> = {};
  let activeDiscoveryBrowser: { target: ScenarioDiscoveryTarget; browser: ScenarioDiscoveryBrowserHandle } | undefined;
  let activeDiscoveryRecording:
    | {
        target: ScenarioDiscoveryTarget;
        recorder: ScenarioDiscoveryRecordedArtifact;
        scenarioId: string;
        browserVisibleCapture?: { observations: ReturnType<ScenarioDiscoveryBrowserHandle["startBrowserVisibleApiCapture"]>["observations"]; stop(): void };
      }
    | undefined;

  const getSingleDiscoverySession = () =>
    activeDiscoverySessions.size === 1 ? [...activeDiscoverySessions.values()][0] : undefined;

  const resetActiveComparison = () => {
    activeComparisonRunId = createComparisonRunId();
    activeComparisonCreatedAt = new Date().toISOString();
    for (const key of Object.keys(activeComparisonTargets)) delete activeComparisonTargets[key];
  };

  const writeActiveComparison = async (session: PreparedScenarioDiscoverySession) => {
    const comparison: ComparisonRunArtifact = {
      version: 1,
      kind: "api-behavior-comparison-run",
      comparisonRunId: activeComparisonRunId,
      candidateScenarioId: activeDiscoveryScenarioId,
      discoverySessionId: session.sessionId,
      createdAt: activeComparisonCreatedAt,
      updatedAt: new Date().toISOString(),
      targets: { ...activeComparisonTargets },
    };
    return writeComparisonRun(session.plan.artifactDir, comparison);
  };

  const stopActiveDiscoveryBrowser = async () => {
    if (!activeDiscoveryBrowser) return;
    await activeDiscoveryBrowser.browser.close();
    activeDiscoveryBrowser = undefined;
  };

  const finishActiveDiscoveryRecording = async () => {
    if (!activeDiscoveryRecording) return undefined;
    const session = getSingleDiscoverySession();
    const candidatePage = activeDiscoveryBrowser?.target.targetId === activeDiscoveryRecording.target.targetId
      ? activeDiscoveryBrowser.browser.getCandidatePageContext()
      : undefined;
    activeDiscoveryRecording.browserVisibleCapture?.stop();
    const browserVisibleRequests = activeDiscoveryRecording.browserVisibleCapture?.observations;
    await activeDiscoveryRecording.recorder.finish?.({
      ...(candidatePage ? { candidatePage } : {}),
      ...(browserVisibleRequests?.length ? { browserVisibleRequests } : {}),
    });
    const finished = activeDiscoveryRecording;
    activeDiscoveryRecording = undefined;
    const browserContext = candidatePage || browserVisibleRequests?.length
      ? {
          ...(candidatePage ? { page: candidatePage } : {}),
          ...(browserVisibleRequests?.length ? { browserVisibleRequests } : {}),
        }
      : undefined;
    activeComparisonTargets[finished.target.targetId] = {
      targetId: finished.target.targetId,
      side: finished.target.side,
      variant: finished.target.variant,
      runId: finished.recorder.runId,
      manifestPath: finished.recorder.manifestPath,
      exchangesPath: finished.recorder.exchangesPath,
      ...(browserContext ? { browserContext } : {}),
    };
    const comparisonPath = session ? await writeActiveComparison(session) : undefined;
    return { ...finished, candidatePage, browserVisibleRequests, comparisonPath };
  };

  pi.registerCommand(API_DISCOVERY_VALIDATE_SUGGESTION_COMMAND, {
    description: "Validate an API discovery scenario suggestion artifact",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_VALIDATE_SUGGESTION_COMMAND} requires interactive UI.`);
      try {
        const workspace = await createWorkspacePathContext(ctx.cwd);
        const config = resolveConfigPaths(parseApiDiscoveryValidateSuggestionArgs(args), workspace, ["suggestionPath", "scenarioDictionaryPath"]);
        const result = await validateScenarioSuggestion({
          suggestionPath: config.suggestionPath,
          ...(config.scenarioDictionaryPath ? { scenarioDictionaryPath: config.scenarioDictionaryPath } : {}),
        });
        ctx.ui.setWidget(PACKAGE_KEY, [
          result.valid ? "API discovery scenario suggestion is valid." : "API discovery scenario suggestion is invalid.",
          `Suggestion: ${config.suggestionPath}`,
          `Errors: ${result.errors.length}`,
          ...result.errors.map((error) => `  error: ${error}`),
          `Warnings: ${result.warnings.length}`,
          ...result.warnings.map((warning) => `  warning: ${warning}`),
          "Scenario dictionary SOT was not modified.",
        ]);
        ctx.ui.notify(result.valid ? "API discovery scenario suggestion is valid" : "API discovery scenario suggestion is invalid", result.valid ? "info" : "warning");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery scenario suggestion validation failed.", message]);
        ctx.ui.notify(message, "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_SUGGEST_COMMAND, {
    description: "Generate a scenario dictionary suggestion from an API discovery analysis artifact",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_SUGGEST_COMMAND} requires interactive UI.`);
      try {
        const workspace = await createWorkspacePathContext(ctx.cwd);
        const config = resolveConfigPaths(parseApiDiscoverySuggestArgs(args), workspace, ["analysisPath", "artifactDir", "scenarioDictionaryPath"]);
        const result = await generateScenarioSuggestion({
          analysisPath: config.analysisPath,
          ...(config.artifactDir ? { artifactDir: config.artifactDir } : {}),
          ...(config.scenarioDictionaryPath ? { scenarioDictionaryPath: config.scenarioDictionaryPath } : {}),
        });
        ctx.ui.setWidget(PACKAGE_KEY, [
          "API discovery scenario suggestion complete.",
          `Mode: ${result.suggestion.mode}`,
          `Scenario: ${result.suggestion.scenarioId}`,
          `Comparison: ${result.suggestion.comparisonRunId}`,
          `Suggestion artifact: ${result.suggestionPath}`,
          "Scenario dictionary SOT was not modified.",
        ]);
        ctx.ui.notify("API discovery scenario suggestion complete", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery scenario suggestion failed.", message]);
        ctx.ui.notify(message, error instanceof ScenarioSuggestionError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_ANALYZE_COMMAND, {
    description: "Analyze an API discovery comparison artifact",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_ANALYZE_COMMAND} requires interactive UI.`);
      try {
        const workspace = await createWorkspacePathContext(ctx.cwd);
        const config = resolveConfigPaths(parseApiDiscoveryAnalyzeArgs(args), workspace, ["comparisonPath", "artifactDir", "scenarioDictionaryPath"]);
        const result = await analyzeComparisonRun({
          comparisonPath: config.comparisonPath,
          ...(config.artifactDir ? { artifactDir: config.artifactDir } : {}),
          ...(config.scenarioDictionaryPath ? { scenarioDictionaryPath: config.scenarioDictionaryPath } : {}),
        });
        ctx.ui.setWidget(PACKAGE_KEY, [
          "API discovery comparison analysis complete.",
          `Comparison: ${result.analysis.comparisonRunId}`,
          `Scenario: ${result.analysis.candidateScenarioId}`,
          `Analysis artifact: ${result.analysisPath}`,
          ...Object.entries(result.analysis.targets).flatMap(([targetId, target]) => [
            `Target ${targetId}: ${target.page?.path ?? "unknown page"}`,
            `  upstream endpoints: ${target.upstream.endpointSummary.length}`,
            `  browser-visible endpoints: ${target.browserVisible.endpointSummary.length}`,
          ]),
        ]);
        ctx.ui.notify("API discovery comparison analysis complete", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery comparison analysis failed.", message]);
        ctx.ui.notify(message, error instanceof ComparisonAnalysisError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_CREATE_COMMAND, {
    description: "Create an API discovery session",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_CREATE_COMMAND} requires interactive UI.`);
      try {
        if (activeDiscoverySessions.size > 0) {
          ctx.ui.setWidget(PACKAGE_KEY, [
            "API discovery session already exists.",
            "MVP supports one active discovery session. Run /api-discovery-stop first.",
          ]);
          ctx.ui.notify("API discovery session already exists", "warning");
          return;
        }
        const workspace = await createWorkspacePathContext(ctx.cwd);
        const config = resolveConfigPaths(parseApiDiscoveryCreateArgs(args), workspace, ["artifactDir"]);
        resetActiveComparison();
        const plan = await resolveScenarioDiscoveryPlan({
          artifactDir: config.artifactDir,
          profileName: config.profileName,
          candidateScenarioId: activeDiscoveryScenarioId,
          targetIds: config.targetIds,
          groupName: config.groupName,
        });
        const session = await prepareScenarioDiscoverySession(plan);
        activeDiscoverySessions.set(session.sessionId, session);
        ctx.ui.setWidget(PACKAGE_KEY, [
          "API discovery session created.",
          `Session: ${session.sessionId}`,
          `Profile: ${session.plan.profileName}`,
          `Current scenario: ${activeDiscoveryScenarioId}`,
          `Comparison run: ${activeComparisonRunId}`,
          ...session.recorders.map(({ target, recorder }) => `Target ${target.targetId}: recorder=${recorder.listenUrl}`),
          "Next: /api-discovery-scenario <scenario-id>",
          "Then: /api-discovery-open <target-id>",
        ]);
        ctx.ui.notify("API discovery session created", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery create failed.", message]);
        ctx.ui.notify(message, error instanceof ScenarioDiscoveryError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_STATUS_COMMAND, {
    description: "Show API discovery session status",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      ctx.ui.setWidget(PACKAGE_KEY, [
        ...formatPreparedScenarioDiscoverySessions([...activeDiscoverySessions.values()]),
        `Current scenario: ${activeDiscoveryScenarioId}`,
        `Comparison run: ${activeComparisonRunId}`,
        `Comparison targets: ${Object.keys(activeComparisonTargets).join(", ") || "none"}`,
        `Active browser: ${activeDiscoveryBrowser?.target.targetId ?? "none"}`,
        `Active recording: ${activeDiscoveryRecording ? `${activeDiscoveryRecording.target.targetId}:${activeDiscoveryRecording.scenarioId}` : "none"}`,
      ]);
      ctx.ui.notify("API discovery status loaded", "info");
    },
  });

  pi.registerCommand(API_DISCOVERY_SCENARIO_COMMAND, {
    description: "Set current API discovery scenario id",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      try {
        if (Object.keys(activeComparisonTargets).length > 0) {
          ctx.ui.setWidget(PACKAGE_KEY, [
            "API discovery scenario failed.",
            "Current comparison already has recorded targets. Stop and create a new discovery session to change scenario.",
          ]);
          ctx.ui.notify("Stop and create a new API discovery session to change scenario", "warning");
          return;
        }
        activeDiscoveryScenarioId = parseApiDiscoveryScenarioArgs(args);
        ctx.ui.setWidget(PACKAGE_KEY, [`Current API discovery scenario: ${activeDiscoveryScenarioId}`, `Comparison run: ${activeComparisonRunId}`]);
        ctx.ui.notify("API discovery scenario set", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery scenario failed.", message]);
        ctx.ui.notify(message, "warning");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_OPEN_COMMAND, {
    description: "Open a target browser for API discovery",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_OPEN_COMMAND} requires interactive UI.`);
      try {
        if (activeDiscoveryRecording) {
          ctx.ui.setWidget(PACKAGE_KEY, ["API discovery browser open failed.", "Finish the active recording first: /api-discovery-finish"]);
          ctx.ui.notify("Finish active API discovery recording first", "warning");
          return;
        }
        const session = getSingleDiscoverySession();
        if (!session) {
          ctx.ui.setWidget(PACKAGE_KEY, ["API discovery browser open failed.", "Create one session first: /api-discovery-create --profile <name>"]);
          ctx.ui.notify("No active API discovery session", "warning");
          return;
        }
        const config = parseApiDiscoveryOpenArgs(args);
        const entry = session.recorders.find(({ target }) => target.targetId === config.targetId);
        if (!entry) throw new ScenarioDiscoveryError(`Target not found in active discovery session: ${config.targetId}`);
        await stopActiveDiscoveryBrowser();
        activeDiscoveryBrowser = {
          target: entry.target,
          browser: await openScenarioDiscoveryBrowserTarget(entry.target, config.candidatePagePath),
        };
        ctx.ui.setWidget(PACKAGE_KEY, [
          `API discovery browser opened for target ${entry.target.targetId}.`,
          "Log in, navigate, and prepare without recording.",
          "When ready: /api-discovery-record",
        ]);
        ctx.ui.notify("API discovery browser opened", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery browser open failed.", message]);
        ctx.ui.notify(message, error instanceof ScenarioDiscoveryError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_RECORD_COMMAND, {
    description: "Start recording the active API discovery browser target",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_RECORD_COMMAND} requires interactive UI.`);
      try {
        if (activeDiscoveryRecording) {
          ctx.ui.setWidget(PACKAGE_KEY, ["API discovery recording is already active.", "Finish it first: /api-discovery-finish"]);
          ctx.ui.notify("API discovery recording is already active", "warning");
          return;
        }
        const session = getSingleDiscoverySession();
        if (!session || !activeDiscoveryBrowser) {
          ctx.ui.setWidget(PACKAGE_KEY, ["API discovery record failed.", "Create a session and open a target first."]);
          ctx.ui.notify("No active API discovery browser", "warning");
          return;
        }
        const entry = session.recorders.find(({ target }) => target.targetId === activeDiscoveryBrowser?.target.targetId);
        if (!entry) throw new ScenarioDiscoveryError(`Target not found in active discovery session: ${activeDiscoveryBrowser.target.targetId}`);
        const recorder = entry.recorder.beginRecordingWindow
          ? await entry.recorder.beginRecordingWindow({
              scenarioId: activeDiscoveryScenarioId,
              candidateScenarioId: activeDiscoveryScenarioId,
              discoverySessionId: session.sessionId,
              comparisonRunId: activeComparisonRunId,
              purpose: "scenario-discovery",
            })
          : entry.recorder;
        const browserVisibleCapture = activeDiscoveryBrowser?.target.targetId === entry.target.targetId
          ? activeDiscoveryBrowser.browser.startBrowserVisibleApiCapture()
          : undefined;
        activeDiscoveryRecording = { target: entry.target, recorder, scenarioId: activeDiscoveryScenarioId, browserVisibleCapture };
        ctx.ui.setWidget(PACKAGE_KEY, [
          `API discovery recording started for ${entry.target.targetId}.`,
          `Scenario: ${activeDiscoveryScenarioId}`,
          "Perform the scenario action now.",
          "When done: /api-discovery-finish",
        ]);
        ctx.ui.notify("API discovery recording started", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery record failed.", message]);
        ctx.ui.notify(message, error instanceof ScenarioDiscoveryError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_FINISH_COMMAND, {
    description: "Finish the active API discovery recording",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_FINISH_COMMAND} requires interactive UI.`);
      try {
        const finished = await finishActiveDiscoveryRecording();
        if (!finished) {
          ctx.ui.setWidget(PACKAGE_KEY, ["No active API discovery recording.", "Start one with /api-discovery-record"]);
          ctx.ui.notify("No active API discovery recording", "warning");
          return;
        }
        ctx.ui.setWidget(PACKAGE_KEY, [
          "API discovery recording finished.",
          `Target: ${finished.target.targetId}`,
          `Scenario: ${finished.scenarioId}`,
          `Comparison run: ${activeComparisonRunId}`,
          ...(finished.comparisonPath ? [`Comparison artifact: ${finished.comparisonPath}`] : []),
          `Manifest: ${finished.recorder.manifestPath}`,
          `Exchanges: ${finished.recorder.exchangeCount}`,
          ...(finished.candidatePage ? [`Page: ${finished.candidatePage.path}`] : []),
          `Browser-visible API observations: ${finished.browserVisibleRequests?.length ?? 0}`,
        ]);
        ctx.ui.notify("API discovery recording finished", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery finish failed.", message]);
        ctx.ui.notify(message, error instanceof ScenarioDiscoveryError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(API_DISCOVERY_STOP_COMMAND, {
    description: "Stop the active API discovery session",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) throw new Error(`/${API_DISCOVERY_STOP_COMMAND} requires interactive UI.`);
      try {
        await finishActiveDiscoveryRecording();
        await stopActiveDiscoveryBrowser();
        const sessions = [...activeDiscoverySessions.values()];
        await Promise.all(sessions.map((session) => stopPreparedScenarioDiscoverySession(session)));
        activeDiscoverySessions.clear();
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery stopped.", `Stopped sessions: ${sessions.length}`, `Comparison run: ${activeComparisonRunId}`]);
        ctx.ui.notify("API discovery stopped", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.setWidget(PACKAGE_KEY, ["API discovery stop failed.", message]);
        ctx.ui.notify(message, error instanceof ScenarioDiscoveryError ? "warning" : "error");
      }
    },
  });

  pi.registerCommand(PACKAGE_COMMAND, {
    description: "Run API behavior audit helpers",
    handler: async (args, ctx) => {
      const workspace = await createWorkspacePathContext(ctx.cwd);
      const parsed = parseApiAuditCommand(args);
      if (parsed.kind === "status") {
        if (ctx.hasUI) {
          ctx.ui.setWidget(PACKAGE_KEY, await buildApiAuditDashboardLines({ artifactDir: resolveWorkspacePath(workspace, DEFAULT_ARTIFACT_DIR) }));
          ctx.ui.notify("API audit dashboard loaded", "info");
        }
        return;
      }

      if (parsed.kind === "setup") {
        if (ctx.hasUI) {
          ctx.ui.setWidget(PACKAGE_KEY, getApiAuditSetupLines());
          ctx.ui.notify("API audit setup guidance loaded", "info");
        }
        return;
      }

      if (parsed.kind === "discover") {
        if (!ctx.hasUI) throw new Error("/api-audit discover requires interactive UI.");
        try {
          const config = resolveConfigPaths(parseApiAuditDiscoverArgs(parsed.args), workspace, ["artifactDir"]);
          if (config.action === "status") {
            ctx.ui.setWidget(PACKAGE_KEY, formatPreparedScenarioDiscoverySessions([...activeDiscoverySessions.values()]));
            ctx.ui.notify("API audit discovery session status loaded", "info");
            return;
          }

          if (config.action === "stop") {
            const session = config.sessionId
              ? activeDiscoverySessions.get(config.sessionId)
              : activeDiscoverySessions.size === 1
                ? [...activeDiscoverySessions.values()][0]
                : undefined;
            if (!session) {
              ctx.ui.setWidget(PACKAGE_KEY, ["API audit discovery stop failed.", "No matching active discovery session found."]);
              ctx.ui.notify("No matching API audit discovery session found", "warning");
              return;
            }
            await stopPreparedScenarioDiscoverySession(session);
            activeDiscoverySessions.delete(session.sessionId);
            ctx.ui.setWidget(PACKAGE_KEY, [`Stopped scenario discovery session: ${session.sessionId}`]);
            ctx.ui.notify("API audit discovery session stopped", "info");
            return;
          }

          if (config.action === "capture") {
            const session = config.sessionId
              ? activeDiscoverySessions.get(config.sessionId)
              : activeDiscoverySessions.size === 1
                ? [...activeDiscoverySessions.values()][0]
                : undefined;
            if (!session) {
              ctx.ui.setWidget(PACKAGE_KEY, [
                "API audit scenario discovery capture failed.",
                "No prepared discovery session found. Run /api-audit discover start --profile <name> --target <id> first, then use /api-audit discover capture --session <id>.",
              ]);
              ctx.ui.notify("No prepared API audit discovery session found", "warning");
              return;
            }
            const result = await capturePreparedScenarioDiscoveryWindow(
              session,
              {
                candidateScenarioId: config.candidateScenarioId ?? session.plan.candidateScenarioId,
                ...(config.candidatePagePath ? { candidatePagePath: config.candidatePagePath } : {}),
                browser: config.browser,
              },
              {
                confirm: async (message) => ctx.ui.confirm("API audit scenario discovery", message),
                notify: (message) => ctx.ui.notify(message, "info"),
              },
            );
            ctx.ui.setWidget(PACKAGE_KEY, [
              "Scenario discovery complete.",
              `Session: ${session.sessionId}`,
              `Candidate scenario: ${config.candidateScenarioId ?? session.plan.candidateScenarioId}`,
              `Profile: ${session.plan.profileName}`,
              ...result.recorders.flatMap(({ target, recorder }) => [
                `Target ${target.targetId}: ${recorder.listenUrl ?? target.recorderUrl}`,
                `  exchanges: ${recorder.exchangeCount}`,
                `  manifest: ${recorder.manifestPath}`,
                ...(recorder.candidatePage ? [`  page: ${recorder.candidatePage.path}`] : []),
              ]),
              "Scenario dictionary was not modified.",
              ...result.warnings,
            ]);
            ctx.ui.notify(
              result.warnings.length ? "API audit discovery completed with warnings" : "API audit discovery complete",
              result.warnings.length ? "warning" : "info",
            );
            return;
          }

          const plan = await resolveScenarioDiscoveryPlan({
            artifactDir: config.artifactDir,
            profileName: config.profileName,
            candidateScenarioId: config.candidateScenarioId ?? "scenario-discovery-session",
            targetIds: config.targetIds,
            groupName: config.groupName,
            candidatePagePath: config.candidatePagePath,
          });
          const session = await prepareScenarioDiscoverySession(plan);
          activeDiscoverySessions.set(session.sessionId, session);
          ctx.ui.setWidget(PACKAGE_KEY, [
            ...buildScenarioDiscoveryPreparation(plan),
            `Persistent discovery session: ${session.sessionId}`,
            "Recorders are running in paused passthrough mode. Configure/restart/login now; requests are forwarded but not recorded.",
            `Status: /api-audit discover status`,
            `Capture once: /api-audit discover capture --session ${session.sessionId} --scenario-id <candidate-id>` ,
            `Stop: /api-audit discover stop --session ${session.sessionId}`,
          ]);
          ctx.ui.notify("API audit persistent discovery proxy session started", "info");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.setWidget(PACKAGE_KEY, ["API audit scenario discovery failed.", message]);
          ctx.ui.notify(message, error instanceof ScenarioDiscoveryError ? "warning" : "error");
        }
        return;
      }

      if (parsed.kind === "capture") {
        if (!ctx.hasUI) throw new Error("/api-audit capture requires interactive UI.");
        try {
          const config = resolveConfigPaths(parseApiAuditCaptureArgs(parsed.args), workspace, ["artifactDir", "scenarioDictionaryPath"]);
          if (!config.scenarioId) {
            ctx.ui.setWidget(PACKAGE_KEY, [
              "API audit capture preparation",
              "Missing --scenario-id.",
              "Example: /api-audit capture --scenario-id account-activity-basic --profile uat",
            ]);
            ctx.ui.notify("Missing --scenario-id for API audit capture", "warning");
            return;
          }
          const plan = await resolveTargetCapturePlan({
            artifactDir: config.artifactDir,
            profileName: config.profileName,
            scenarioId: config.scenarioId,
            scenarioDictionaryPath: config.scenarioDictionaryPath,
            targetIds: config.targetIds,
            groupName: config.groupName,
          });
          if (config.run) {
            const result = await runTargetCapture(plan, {
              confirm: async (message) => ctx.ui.confirm("API audit target capture", message),
              notify: (message) => ctx.ui.notify(message, "info"),
            });
            ctx.ui.setWidget(PACKAGE_KEY, [
              "Target capture complete.",
              `Scenario: ${plan.scenarioId}`,
              `Profile: ${plan.profileName}`,
              ...result.recorders.flatMap(({ target, recorder }) => [
                `Target ${target.targetId}: ${recorder.listenUrl}`,
                `  exchanges: ${recorder.exchangeCount}`,
                `  manifest: ${recorder.manifestPath}`,
              ]),
              ...result.warnings,
            ]);
            ctx.ui.notify(
              result.warnings.length ? "API audit target capture completed with warnings" : "API audit target capture complete",
              result.warnings.length ? "warning" : "info",
            );
          } else {
            ctx.ui.setWidget(PACKAGE_KEY, buildTargetCapturePreparation(plan));
            ctx.ui.notify("API audit target capture preparation ready", "info");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.setWidget(PACKAGE_KEY, ["API audit target capture preparation failed.", message]);
          ctx.ui.notify(message, error instanceof TargetCaptureError ? "warning" : "error");
        }
        return;
      }

      if (parsed.kind === "profile") {
        try {
          const result = await executeProfileCommand(
            resolveCommandPathFlags(parsed.args, workspace, ["artifact-dir"], { "artifact-dir": DEFAULT_ARTIFACT_DIR }),
          );
          if (ctx.hasUI) {
            ctx.ui.setWidget(PACKAGE_KEY, result.lines);
            ctx.ui.notify("API audit environment profile command complete", "info");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (ctx.hasUI) {
            ctx.ui.setWidget(PACKAGE_KEY, ["API audit environment profile command failed.", message]);
            ctx.ui.notify(message, error instanceof EnvironmentProfileError ? "warning" : "error");
          }
        }
        return;
      }

      if (parsed.kind === "account-activity-upstream") {
        if (!ctx.hasUI) {
          throw new Error("/api-audit account-activity-upstream requires interactive UI confirmation.");
        }

        try {
          const config = parseAccountActivityUpstreamArgs(
            resolveCommandPathFlags(parsed.args, workspace, ["artifact-dir", "manifest"], {
              "artifact-dir": DEFAULT_ARTIFACT_DIR,
              manifest: DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
            }),
          );
          const scenario = getScenario(await loadScenarioManifest(config.manifestPath), ACCOUNT_ACTIVITY_SCENARIO_ID);
          const result = await runAccountActivityUpstreamCapture(
            {
              oldBaseUrl: config.oldBaseUrl,
              newBaseUrl: config.newBaseUrl,
              oldTargetBaseUrl: config.oldTargetBaseUrl,
              newTargetBaseUrl: config.newTargetBaseUrl,
              oldProxyPort: config.oldProxyPort,
              newProxyPort: config.newProxyPort,
              artifactDir: config.artifactDir,
              scenario,
            },
            {
              confirm: async (message) => ctx.ui.confirm("API audit upstream account-activity", message),
              notify: (message) => ctx.ui.notify(message, "info"),
            },
          );

          ctx.ui.setWidget(PACKAGE_KEY, [
            "Account-history Layer B upstream capture complete.",
            `Old recorder: ${result.oldRecorder.listenUrl}`,
            `Old exchanges: ${result.oldRecorder.exchangeCount}`,
            `Old manifest: ${result.oldRecorder.manifestPath}`,
            `New recorder: ${result.newRecorder.listenUrl}`,
            `New exchanges: ${result.newRecorder.exchangeCount}`,
            `New manifest: ${result.newRecorder.manifestPath}`,
            ...result.warnings,
          ]);
          ctx.ui.notify(
            result.warnings.length ? "API audit upstream capture completed with warnings" : "API audit upstream capture complete",
            result.warnings.length ? "warning" : "info",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.setWidget(PACKAGE_KEY, ["API audit upstream account-activity capture failed.", message]);
          ctx.ui.notify(message, error instanceof AccountActivityUpstreamConfigError ? "warning" : "error");
        }
        return;
      }

      if (parsed.kind === "proxy") {
        try {
          const config = parseRecordingProxyArgs(
            resolveCommandPathFlags(parsed.args, workspace, ["artifact-dir"], { "artifact-dir": DEFAULT_ARTIFACT_DIR }),
          );
          const proxy = await startRecordingProxy(config);
          activeProxies.push(proxy);
          if (ctx.hasUI) {
            ctx.ui.setWidget(PACKAGE_KEY, [
              "Layer B recording proxy started.",
              `Listen: ${proxy.listenUrl}`,
              `Target: ${config.targetBaseUrl}`,
              `Run: ${proxy.runId}`,
              `Manifest: ${proxy.manifestPath}`,
              `Exchanges file: ${proxy.exchangesPath}`,
              `Active proxies: ${activeProxies.length}`,
            ]);
            ctx.ui.notify("API audit recording proxy started", "info");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (ctx.hasUI) {
            ctx.ui.setWidget(PACKAGE_KEY, ["API audit recording proxy failed.", message]);
            ctx.ui.notify(message, error instanceof ProxyConfigError ? "warning" : "error");
          }
        }
        return;
      }

      if (!ctx.hasUI) {
        throw new Error("/api-audit account-activity requires interactive UI for manual-auth confirmation.");
      }

      try {
        const config = parseAccountActivityCaptureArgs(
          resolveCommandPathFlags(parsed.args, workspace, ["artifact-dir", "manifest"], {
            "artifact-dir": DEFAULT_ARTIFACT_DIR,
            manifest: DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
          }),
        );
        const result = await runAccountActivityLayerACapture(
          {
            oldBaseUrl: config.oldBaseUrl,
            newBaseUrl: config.newBaseUrl,
            artifactDir: config.artifactDir,
            scenario: getScenario(await loadScenarioManifest(config.manifestPath), ACCOUNT_ACTIVITY_SCENARIO_ID),
          },
          {
            confirm: async (message) => ctx.ui.confirm("API audit manual auth", message),
            notify: (message) => ctx.ui.notify(message, "info"),
          },
        );

        ctx.ui.setWidget(PACKAGE_KEY, [
          "Account-history Layer A capture complete.",
          `Run: ${result.runId}`,
          `Exchanges: ${result.exchangeCount}`,
          `Manifest: ${result.manifestPath}`,
          `Exchanges file: ${result.exchangesPath}`,
        ]);
        ctx.ui.notify("API audit account-activity capture complete", "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.setWidget(PACKAGE_KEY, ["API audit account-activity capture failed.", message]);
          ctx.ui.notify(message, error instanceof ApiAuditConfigError ? "warning" : "error");
        }
      }
    },
  });
}
