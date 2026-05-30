import { createWorkspacePathContext, DEFAULT_ARTIFACT_DIR, DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH, resolveWorkspacePath, type WorkspacePathContext } from "../config/workspace-paths.ts";

import { loadValidatedRun } from "../schemas/artifact-schema.ts";
import { ACCOUNT_ACTIVITY_SCENARIO_ID } from "../adapters/browser-capture.ts";
import {
  buildScenarioDiscoveryPreparation,
  resolveScenarioDiscoveryPlan,
  runScenarioDiscovery,
} from "../core/discovery.ts";
import {
  clearEnvironmentProfile,
  formatEnvironmentProfiles,
  loadEnvironmentProfiles,
  resolveEnvironmentProfile,
  saveEnvironmentProfile,
  type EnvironmentProfile,
} from "../config/environment-profiles.ts";
import {
  getDictionaryScenario,
  loadScenarioDictionary,
  ScenarioDictionaryError,
  toCaptureScenario,
} from "../core/scenario-dictionary.ts";
import { getScenario, loadScenarioManifest } from "../core/scenarios.ts";
import {
  buildTargetCapturePreparation,
  resolveTargetCapturePlan,
  runTargetCapture,
} from "../adapters/target-capture.ts";
import {
  buildAccountActivityUpstreamInstructions,
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
  type AccountActivityUpstreamResult,
} from "../adapters/upstream-account-activity.ts";
import type {
  AccountActivityToolParams,
  ClearEnvironmentProfileToolParams,
  EnvironmentProfileToolParams,
  ListScenariosParams,
  RunAccountActivityToolDeps,
  RunScenarioDiscoveryToolDeps,
  RunTargetCaptureToolDeps,
  ScenarioDiscoveryToolParams,
  ShowEnvironmentProfilesToolParams,
  TargetCaptureToolParams,
  ToolTextResult,
  ToolUiAdapter,
  UpstreamCaptureToolParams,
  ValidateRunParams,
} from "./tool-types.ts";
import {
  DEFAULT_NEW_PROXY_PORT,
  DEFAULT_NEW_URL,
  DEFAULT_OLD_PROXY_PORT,
  DEFAULT_OLD_URL,
} from "./tool-types.ts";

export async function executeListScenariosTool(
  params: ListScenariosParams,
): Promise<ToolTextResult<{ scenarios: Array<Record<string, unknown>> }>> {
  const dictionaryResult = await loadDictionaryForList(params.scenarioDictionaryPath);
  if (!dictionaryResult.dictionary) {
    return {
      content: [{ type: "text", text: dictionaryResult.message }],
      details: { scenarios: [] },
    };
  }
  const dictionary = dictionaryResult.dictionary;
  const scenarios = dictionary.scenarios.map((scenario) => ({
    id: scenario.id,
    feature: scenario.feature,
    description: scenario.description,
    type: scenario.type,
    page: scenario.page,
    browserApiAllowlist: scenario.browserApiAllowlist,
    upstreamApiCandidates: scenario.upstreamApiCandidates,
    evidence: scenario.evidence,
    notes: scenario.notes,
  }));

  const text = scenarios
    .map((scenario) => {
      const upstream = scenario.upstreamApiCandidates as { old: string[]; new: string[] };
      return [
        `${scenario.id} — ${scenario.feature}`,
        `  ${scenario.description}`,
        `  pages: old ${formatPathRecord(scenario.page, "oldPath")} / new ${formatPathRecord(scenario.page, "newPath")}`,
        `  upstream candidates: old ${upstream.old.join(", ")} / new ${upstream.new.join(", ")}`,
      ].join("\n");
    })
    .join("\n\n");

  return {
    content: [{ type: "text", text: text || "No API audit scenarios are configured." }],
    details: { scenarios },
  };
}

export async function executeValidateRunTool(
  params: ValidateRunParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const run = await loadValidatedRun(params.runDir, { verifyExchangeCount: params.verifyExchangeCount ?? true });
  const side = run.manifest.recordingProxy?.side ?? "unknown";
  return {
    content: [
      {
        type: "text",
        text: `API audit run is valid: ${run.manifest.runId} (${run.manifest.layer ?? "unknown layer"}, side ${side}, ${run.exchanges.length} exchanges).`,
      },
    ],
    details: {
      valid: true,
      runId: run.manifest.runId,
      layer: run.manifest.layer,
      side,
      scenarios: run.manifest.scenarios,
      exchangeCount: run.exchanges.length,
      manifestExchangeCount: run.manifest.exchangeCount,
    },
  };
}

export async function executePrepareUpstreamCaptureTool(
  params: UpstreamCaptureToolParams,
): Promise<ToolTextResult<Record<string, unknown>>> {
  const dictionary = await loadDictionary(params.scenarioDictionaryPath);
  const dictionaryScenario = getDictionaryScenario(dictionary, params.scenarioId);
  const scenario = toCaptureScenario(dictionaryScenario);
  const environment = await resolveToolEnvironment(params);
  const config = parseAccountActivityUpstreamArgs(buildUpstreamArgs(environment));
  const oldRecorderUrl = `http://127.0.0.1:${config.oldProxyPort}`;
  const newRecorderUrl = `http://127.0.0.1:${config.newProxyPort}`;
  const instructions = buildScenarioUpstreamInstructions({
    scenarioId: scenario.id,
    oldRecorderUrl,
    newRecorderUrl,
    oldPath: scenario.page.oldPath,
    newPath: scenario.page.newPath,
    oldCandidates: dictionaryScenario.upstreamApiCandidates.old,
    newCandidates: dictionaryScenario.upstreamApiCandidates.new,
  });

  return {
    content: [
      {
        type: "text",
        text: [
          `Scenario upstream capture preparation: ${scenario.id} — ${scenario.feature}`,
          ...instructions,
        ].join("\n"),
      },
    ],
    details: {
      scenarioId: scenario.id,
      feature: scenario.feature,
      page: scenario.page,
      browserApiAllowlist: scenario.apiAllowlist,
      upstreamApiCandidates: dictionaryScenario.upstreamApiCandidates,
      oldRecorderUrl,
      newRecorderUrl,
      oldTargetBaseUrl: config.oldTargetBaseUrl,
      newTargetBaseUrl: config.newTargetBaseUrl,
      instructions,
    },
  };
}

export async function executeRunUpstreamCaptureTool(
  params: UpstreamCaptureToolParams,
  ui: ToolUiAdapter,
  deps: RunAccountActivityToolDeps = {},
): Promise<ToolTextResult<Record<string, unknown>>> {
  if (!ui.hasUI) throw new Error("api_audit_run_upstream_capture requires interactive UI confirmation.");

  const dictionary = await loadDictionary(params.scenarioDictionaryPath);
  const dictionaryScenario = getDictionaryScenario(dictionary, params.scenarioId);
  const scenario = toCaptureScenario(dictionaryScenario);
  const environment = await resolveToolEnvironment(params);
  const config = parseAccountActivityUpstreamArgs(buildUpstreamArgs(environment));
  const prepareResult = await executePrepareUpstreamCaptureTool(params);
  const ready = await ui.confirm("API audit upstream capture", prepareResult.content[0].text);
  if (!ready) throw new Error(`Cancelled ${scenario.id} upstream capture before starting recorders.`);

  const runCapture = deps.runCapture ?? runAccountActivityUpstreamCapture;
  const result: AccountActivityUpstreamResult = await runCapture(
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
      confirm: async (message) => ui.confirm(`API audit upstream ${scenario.id}`, message),
      notify: (message) => ui.notify(message, "info"),
    },
  );

  return {
    content: [
      {
        type: "text",
        text: [
          `Scenario Layer B upstream capture complete: ${scenario.id}`,
          `Old run: ${result.oldRecorder.runId}`,
          `Old exchanges: ${result.oldRecorder.exchangeCount}`,
          `Old manifest: ${result.oldRecorder.manifestPath}`,
          `New run: ${result.newRecorder.runId}`,
          `New exchanges: ${result.newRecorder.exchangeCount}`,
          `New manifest: ${result.newRecorder.manifestPath}`,
          ...result.warnings.map((warning) => `Warning: ${warning}`),
        ].join("\n"),
      },
    ],
    details: {
      scenarioId: scenario.id,
      old: recorderDetails(result.oldRecorder),
      new: recorderDetails(result.newRecorder),
      warnings: result.warnings,
    },
  };
}

export function buildPrepareAccountActivityUpstreamCaptureResult(
  params: AccountActivityToolParams,
): ToolTextResult<Record<string, unknown>> {
  const config = parseAccountActivityUpstreamArgs(buildAccountActivityUpstreamArgs(params));
  const oldRecorderUrl = `http://127.0.0.1:${config.oldProxyPort}`;
  const newRecorderUrl = `http://127.0.0.1:${config.newProxyPort}`;
  const instructions = buildAccountActivityUpstreamInstructions({ oldRecorderUrl, newRecorderUrl });
  const commandArgs = buildAccountActivityUpstreamArgs(params);

  return {
    content: [
      {
        type: "text",
        text: [
          "Account-history upstream capture preparation:",
          ...instructions,
          "",
          "Equivalent slash command:",
          `/api-audit ${commandArgs}`,
        ].join("\n"),
      },
    ],
    details: {
      scenarioId: ACCOUNT_ACTIVITY_SCENARIO_ID,
      oldRecorderUrl,
      newRecorderUrl,
      oldTargetBaseUrl: config.oldTargetBaseUrl,
      newTargetBaseUrl: config.newTargetBaseUrl,
      commandArgs,
      instructions,
    },
  };
}

export async function executeRunAccountActivityUpstreamCaptureTool(
  params: AccountActivityToolParams,
  ui: ToolUiAdapter,
  deps: RunAccountActivityToolDeps = {},
): Promise<ToolTextResult<Record<string, unknown>>> {
  if (!ui.hasUI) throw new Error("api_audit_run_account_history_upstream_capture requires interactive UI confirmation.");

  const config = parseAccountActivityUpstreamArgs(buildAccountActivityUpstreamArgs(params));
  const scenario = getScenario(await loadScenarioManifest(config.manifestPath), ACCOUNT_ACTIVITY_SCENARIO_ID);
  const ready = await ui.confirm(
    "API audit account-activity upstream capture",
    buildPrepareAccountActivityUpstreamCaptureResult(params).content[0].text,
  );
  if (!ready) throw new Error("Cancelled account-activity upstream capture before starting recorders.");

  const runCapture = deps.runCapture ?? runAccountActivityUpstreamCapture;
  const result: AccountActivityUpstreamResult = await runCapture(
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
      confirm: async (message) => ui.confirm("API audit upstream account-activity", message),
      notify: (message) => ui.notify(message, "info"),
    },
  );

  const text = [
    "Account-history Layer B upstream capture complete.",
    `Old run: ${result.oldRecorder.runId}`,
    `Old exchanges: ${result.oldRecorder.exchangeCount}`,
    `Old manifest: ${result.oldRecorder.manifestPath}`,
    `New run: ${result.newRecorder.runId}`,
    `New exchanges: ${result.newRecorder.exchangeCount}`,
    `New manifest: ${result.newRecorder.manifestPath}`,
    ...result.warnings.map((warning) => `Warning: ${warning}`),
  ].join("\n");

  return {
    content: [{ type: "text", text }],
    details: {
      scenarioId: scenario.id,
      old: recorderDetails(result.oldRecorder),
      new: recorderDetails(result.newRecorder),
      warnings: result.warnings,
    },
  };
}

async function loadDictionary(path?: string) {
  if (!path) throw new ScenarioDictionaryError("A workspace scenario dictionary path is required; package scenarios are examples only.");
  return loadScenarioDictionary(path);
}

async function loadDictionaryForList(path?: string) {
  if (!path) {
    return {
      dictionary: undefined,
      message: "No workspace API audit scenario dictionary is configured. Create one or pass scenarioDictionaryPath.",
    };
  }
  try {
    return { dictionary: await loadScenarioDictionary(path), message: "" };
  } catch (error) {
    if (error instanceof ScenarioDictionaryError && error.message.includes("ENOENT")) {
      return {
        dictionary: undefined,
        message: `No workspace API audit scenario dictionary is configured at ${path}. Create one or pass scenarioDictionaryPath.`,
      };
    }
    throw error;
  }
}

export async function resolveToolPathParams<T extends object>(
  params: T,
  cwd: string,
  pathKeys: string[],
): Promise<T> {
  const workspace = await createWorkspacePathContext(cwd);
  return resolvePathParams(params, workspace, pathKeys);
}

function resolvePathParams<T extends object>(
  params: T,
  workspace: WorkspacePathContext,
  pathKeys: string[],
): T {
  const source = params as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source };
  for (const key of pathKeys) {
    const value = source[key];
    if (typeof value === "string") next[key] = resolveWorkspacePath(workspace, value);
    else if (key === "artifactDir" && value === undefined) next.artifactDir = resolveWorkspacePath(workspace, DEFAULT_ARTIFACT_DIR);
    else if (key === "scenarioDictionaryPath" && value === undefined) {
      next.scenarioDictionaryPath = resolveWorkspacePath(workspace, DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH);
    } else if (key === "manifestPath" && value === undefined) {
      next.manifestPath = resolveWorkspacePath(workspace, DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH);
    }
  }
  return next as T;
}

function buildScenarioUpstreamInstructions(input: {
  scenarioId: string;
  oldRecorderUrl: string;
  newRecorderUrl: string;
  oldPath: string;
  newPath: string;
  oldCandidates: string[];
  newCandidates: string[];
}): string[] {
  return [
    `Scenario: ${input.scenarioId}`,
    `Page paths: old ${input.oldPath} / new ${input.newPath}`,
    `Expected upstream candidates: old ${input.oldCandidates.join(", ")} / new ${input.newCandidates.join(", ")}`,
    ...buildAccountActivityUpstreamInstructions({
      oldRecorderUrl: input.oldRecorderUrl,
      newRecorderUrl: input.newRecorderUrl,
    }),
  ];
}

async function resolveToolEnvironment(params: UpstreamCaptureToolParams): Promise<EnvironmentProfile & { artifactDir: string }> {
  const artifactDir = params.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const environment = await resolveEnvironmentProfile({
    artifactDir,
    profileName: params.profileName,
    oldUrl: params.oldUrl,
    newUrl: params.newUrl,
    oldTargetUrl: params.oldTargetUrl,
    newTargetUrl: params.newTargetUrl,
    oldProxyPort: params.oldProxyPort,
    newProxyPort: params.newProxyPort,
    allowHosts: params.allowHosts,
  });
  return { ...environment, artifactDir };
}

function buildUpstreamArgs(params: EnvironmentProfile & { artifactDir?: string }): string {
  return buildAccountActivityUpstreamArgs({
    oldUrl: params.oldUrl,
    newUrl: params.newUrl,
    oldTargetUrl: params.oldTargetUrl,
    newTargetUrl: params.newTargetUrl,
    oldProxyPort: params.oldProxyPort,
    newProxyPort: params.newProxyPort,
    artifactDir: params.artifactDir,
    allowHosts: params.allowHosts,
  });
}

function buildAccountActivityUpstreamArgs(params: AccountActivityToolParams): string {
  const oldUrl = params.oldUrl ?? DEFAULT_OLD_URL;
  const newUrl = params.newUrl ?? DEFAULT_NEW_URL;
  const oldProxyPort = params.oldProxyPort ?? DEFAULT_OLD_PROXY_PORT;
  const newProxyPort = params.newProxyPort ?? DEFAULT_NEW_PROXY_PORT;
  const artifactDir = params.artifactDir ?? DEFAULT_ARTIFACT_DIR;
  const parts = [
    "account-activity-upstream",
    "--old-url",
    oldUrl,
    "--new-url",
    newUrl,
    "--old-target-url",
    params.oldTargetUrl,
    "--new-target-url",
    params.newTargetUrl,
    "--old-proxy-port",
    String(oldProxyPort),
    "--new-proxy-port",
    String(newProxyPort),
    "--artifact-dir",
    artifactDir,
  ];

  if (params.manifestPath) parts.push("--manifest", params.manifestPath);
  for (const host of params.allowHosts ?? []) parts.push("--allow-host", host);
  return parts.join(" ");
}

function recorderDetails(recorder: AccountActivityUpstreamResult["oldRecorder"]): Record<string, unknown> {
  return {
    runId: recorder.runId,
    listenUrl: recorder.listenUrl,
    manifestPath: recorder.manifestPath,
    exchangesPath: recorder.exchangesPath,
    exchangeCount: recorder.exchangeCount,
  };
}

function formatPathRecord(value: unknown, key: string): string {
  return typeof value === "object" && value !== null && key in value ? String((value as Record<string, unknown>)[key]) : "unknown";
}

export function requiredToolString(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
