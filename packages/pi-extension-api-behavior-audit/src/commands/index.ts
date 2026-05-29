import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerApiAuditPackageCommand } from "./package-command.ts";

import { createWorkspacePathContext } from "../workspace-paths.ts";

import { createComparisonRunId, writeComparisonRun } from "../artifacts.ts";
import { runAccountActivityLayerACapture, ACCOUNT_ACTIVITY_SCENARIO_ID } from "../browser-capture.ts";
import { analyzeComparisonRun, ComparisonAnalysisError } from "../comparison-analysis.ts";
import { buildApiAuditDashboardLines } from "../dashboard.ts";
import { ApiAuditConfigError, parseAccountActivityCaptureArgs } from "../config.ts";
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
} from "../discovery.ts";
import { EnvironmentProfileError, executeProfileCommand } from "../environment-profiles.ts";
import { parseRecordingProxyArgs, ProxyConfigError } from "../proxy-config.ts";
import { generateScenarioSuggestion, ScenarioSuggestionError, validateScenarioSuggestion } from "../scenario-suggestion.ts";
import { startRecordingProxy, type RecordingProxyHandle } from "../recording-proxy.ts";
import { getScenario, loadScenarioManifest } from "../scenarios.ts";
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
} from "../package-info.ts";
import { buildTargetCapturePreparation, resolveTargetCapturePlan, runTargetCapture, TargetCaptureError } from "../target-capture.ts";
import {
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
  AccountActivityUpstreamConfigError,
} from "../upstream-account-activity.ts";
import type { ComparisonRunArtifact, ComparisonRunTargetArtifact } from "../types.ts";

export * from "./args.ts";

import {
  getApiAuditSetupLines,
  parseApiAuditCaptureArgs,
  parseApiAuditCommand,
  parseApiAuditDiscoverArgs,
  parseApiDiscoveryAnalyzeArgs,
  parseApiDiscoveryCreateArgs,
  parseApiDiscoveryOpenArgs,
  parseApiDiscoveryScenarioArgs,
  parseApiDiscoverySuggestArgs,
  parseApiDiscoveryValidateSuggestionArgs,
  resolveConfigPaths,
} from "./args.ts";

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

  registerApiAuditPackageCommand(pi, activeDiscoverySessions, activeProxies);

}
