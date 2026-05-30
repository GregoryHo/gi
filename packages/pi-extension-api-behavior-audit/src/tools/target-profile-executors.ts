import {
  buildScenarioDiscoveryPreparation,
  resolveScenarioDiscoveryPlan,
  runScenarioDiscovery,
} from "../core/discovery.ts";
import {
  clearEnvironmentProfile,
  formatEnvironmentProfiles,
  loadEnvironmentProfiles,
  saveEnvironmentProfile,
} from "../config/environment-profiles.ts";
import { buildTargetCapturePreparation, resolveTargetCapturePlan, runTargetCapture } from "../adapters/target-capture.ts";
import { DEFAULT_ARTIFACT_DIR } from "../config/workspace-paths.ts";
import type {
  ClearEnvironmentProfileToolParams,
  EnvironmentProfileToolParams,
  RunScenarioDiscoveryToolDeps,
  RunTargetCaptureToolDeps,
  ScenarioDiscoveryToolParams,
  ShowEnvironmentProfilesToolParams,
  TargetCaptureToolParams,
  ToolTextResult,
  ToolUiAdapter,
} from "./tool-types.ts";
import { requiredToolString } from "./executors.ts";

export async function executeListTargetsTool(
  params: TargetCaptureToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const plan = await resolveTargetCapturePlan(params);
  const lines = [
    `API audit targets for ${plan.scenarioId} — ${plan.feature}`,
    `Profile: ${plan.profileName}`,
    ...plan.targets.map(
      (target) =>
        `${target.targetId} (${target.variant}) page ${target.pagePath} recorder ${target.recorderUrl} upstream ${target.upstreamTargetUrl}`,
    ),
  ];
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: {
      scenarioId: plan.scenarioId,
      profileName: plan.profileName,
      targetCount: plan.targets.length,
      targets: plan.targets,
    },
  };
}

export async function executePrepareTargetCaptureTool(
  params: TargetCaptureToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const plan = await resolveTargetCapturePlan(params);
  return {
    content: [{ type: "text", text: buildTargetCapturePreparation(plan).join("\n") }],
    details: {
      scenarioId: plan.scenarioId,
      profileName: plan.profileName,
      targetCount: plan.targets.length,
      targets: plan.targets,
    },
  };
}

export async function executeRunTargetCaptureTool(
  params: TargetCaptureToolParams,
  ui: ToolUiAdapter,
  deps: RunTargetCaptureToolDeps = {},
): Promise<ToolTextResult<Record<string, unknown>>> {
  if (!ui.hasUI) throw new Error("api_audit_run_target_capture requires interactive UI confirmation.");
  const plan = await resolveTargetCapturePlan(params);
  const runCapture = deps.runCapture ?? runTargetCapture;
  const result = await runCapture(plan, {
    confirm: (message) => ui.confirm("API audit target capture", message),
    notify: (message) => ui.notify(message, "info"),
    startRecorder: deps.startRecorder,
    runTargetPageAction: deps.runTargetPageAction,
  });
  const lines = [
    "Target capture complete.",
    `Scenario: ${plan.scenarioId}`,
    `Profile: ${plan.profileName}`,
    ...result.recorders.flatMap(({ target, recorder }) => [
      `Target ${target.targetId}: ${recorder.listenUrl}`,
      `  exchanges: ${recorder.exchangeCount}`,
      `  manifest: ${recorder.manifestPath}`,
    ]),
    ...result.warnings,
  ];
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: {
      scenarioId: plan.scenarioId,
      profileName: plan.profileName,
      targetCount: plan.targets.length,
      recorders: result.recorders.map(({ target, recorder }) => ({
        targetId: target.targetId,
        variant: target.variant,
        runId: recorder.runId,
        listenUrl: recorder.listenUrl,
        manifestPath: recorder.manifestPath,
        exchangesPath: recorder.exchangesPath,
        exchangeCount: recorder.exchangeCount,
      })),
      warnings: result.warnings,
    },
  };
}

export async function executePrepareScenarioDiscoveryTool(
  params: ScenarioDiscoveryToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const plan = await resolveScenarioDiscoveryPlan(params);
  return {
    content: [{ type: "text", text: buildScenarioDiscoveryPreparation(plan).join("\n") }],
    details: {
      candidateScenarioId: plan.candidateScenarioId,
      profileName: plan.profileName,
      targetCount: plan.targets.length,
      targets: plan.targets,
    },
  };
}

export async function executeRunScenarioDiscoveryTool(
  params: ScenarioDiscoveryToolParams,
  ui: ToolUiAdapter,
  deps: RunScenarioDiscoveryToolDeps = {},
): Promise<ToolTextResult<Record<string, unknown>>> {
  if (!ui.hasUI) throw new Error("api_audit_run_scenario_discovery requires interactive UI confirmation.");
  const plan = await resolveScenarioDiscoveryPlan(params);
  const runDiscovery = deps.runDiscovery ?? runScenarioDiscovery;
  const result = await runDiscovery(plan, {
    confirm: (message) => ui.confirm("API audit scenario discovery", message),
    notify: (message) => ui.notify(message, "info"),
    startRecorder: deps.startRecorder,
    runManualPageAction: deps.runManualPageAction,
  });
  const lines = [
    "Scenario discovery complete.",
    `Candidate scenario: ${plan.candidateScenarioId}`,
    `Profile: ${plan.profileName}`,
    ...result.recorders.flatMap(({ target, recorder }) => [
      `Target ${target.targetId}: ${recorder.listenUrl}`,
      `  exchanges: ${recorder.exchangeCount}`,
      `  manifest: ${recorder.manifestPath}`,
    ]),
    "Scenario dictionary was not modified.",
    ...result.warnings,
  ];
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: {
      candidateScenarioId: plan.candidateScenarioId,
      profileName: plan.profileName,
      targetCount: plan.targets.length,
      recorders: result.recorders.map(({ target, recorder }) => ({
        targetId: target.targetId,
        variant: target.variant,
        runId: recorder.runId,
        listenUrl: recorder.listenUrl,
        manifestPath: recorder.manifestPath,
        exchangesPath: recorder.exchangesPath,
        exchangeCount: recorder.exchangeCount,
      })),
      warnings: result.warnings,
    },
  };
}

export async function executeShowEnvironmentProfilesTool(
  params: ShowEnvironmentProfilesToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const artifactDir = params.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const config = await loadEnvironmentProfiles(artifactDir);
  return {
    content: [{ type: "text", text: formatEnvironmentProfiles(config, artifactDir).join("\n") }],
    details: {
      artifactDir,
      defaultProfile: config.defaultProfile,
      profiles: config.profiles,
    },
  };
}

export async function executeSaveEnvironmentProfileTool(
  params: EnvironmentProfileToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const artifactDir = params.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const config = await saveEnvironmentProfile(
    artifactDir,
    params.profileName,
    {
      oldUrl: requiredToolString(params.oldUrl, "oldUrl"),
      newUrl: requiredToolString(params.newUrl, "newUrl"),
      oldTargetUrl: requiredToolString(params.oldTargetUrl, "oldTargetUrl"),
      newTargetUrl: requiredToolString(params.newTargetUrl, "newTargetUrl"),
      ...(params.oldProxyPort !== undefined ? { oldProxyPort: params.oldProxyPort } : {}),
      ...(params.newProxyPort !== undefined ? { newProxyPort: params.newProxyPort } : {}),
      ...(params.allowHosts ? { allowHosts: params.allowHosts } : {}),
    },
    { makeDefault: params.makeDefault },
  );
  return {
    content: [
      {
        type: "text",
        text: [`Saved API audit environment profile: ${params.profileName}`, ...formatEnvironmentProfiles(config, artifactDir)].join("\n"),
      },
    ],
    details: { artifactDir, profileName: params.profileName, defaultProfile: config.defaultProfile },
  };
}

export async function executeClearEnvironmentProfileTool(
  params: ClearEnvironmentProfileToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const artifactDir = params.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const config = await clearEnvironmentProfile(artifactDir, params.profileName);
  return {
    content: [
      {
        type: "text",
        text: [`Cleared API audit environment profile: ${params.profileName}`, ...formatEnvironmentProfiles(config, artifactDir)].join("\n"),
      },
    ],
    details: { artifactDir, profileName: params.profileName, defaultProfile: config.defaultProfile },
  };
}

