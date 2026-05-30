import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  createWorkspacePathContext,
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
  resolveWorkspacePath,
} from "../config/workspace-paths.ts";

import { runAccountActivityLayerACapture, ACCOUNT_ACTIVITY_SCENARIO_ID } from "../adapters/browser-capture.ts";
import { buildApiAuditDashboardLines } from "../ui/dashboard.ts";
import { ApiAuditConfigError, parseAccountActivityCaptureArgs } from "../config/index.ts";
import {
  buildScenarioDiscoveryPreparation,
  capturePreparedScenarioDiscoveryWindow,
  formatPreparedScenarioDiscoverySessions,
  prepareScenarioDiscoverySession,
  resolveScenarioDiscoveryPlan,
  runScenarioDiscovery,
  ScenarioDiscoveryError,
  stopPreparedScenarioDiscoverySession,
  type PreparedScenarioDiscoverySession,
} from "../core/discovery.ts";
import { EnvironmentProfileError, executeProfileCommand } from "../config/environment-profiles.ts";
import { PACKAGE_COMMAND, PACKAGE_KEY } from "../core/package-info.ts";
import { parseRecordingProxyArgs, ProxyConfigError } from "../config/proxy-config.ts";
import { startRecordingProxy, type RecordingProxyHandle } from "../adapters/recording-proxy.ts";
import { getScenario, loadScenarioManifest } from "../core/scenarios.ts";
import { buildTargetCapturePreparation, resolveTargetCapturePlan, runTargetCapture, TargetCaptureError } from "../adapters/target-capture.ts";
import {
  AccountActivityUpstreamConfigError,
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
} from "../adapters/upstream-account-activity.ts";
import {
  getApiAuditSetupLines,
  parseApiAuditCaptureArgs,
  parseApiAuditCommand,
  parseApiAuditDiscoverArgs,
  resolveCommandPathFlags,
  resolveConfigPaths,
} from "./args.ts";

export function registerApiAuditPackageCommand(
  pi: ExtensionAPI,
  activeDiscoverySessions: Map<string, PreparedScenarioDiscoverySession>,
  activeProxies: RecordingProxyHandle[],
): void {
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
