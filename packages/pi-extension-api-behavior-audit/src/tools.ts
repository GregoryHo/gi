import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
  createWorkspacePathContext,
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
  resolveWorkspacePath,
  type WorkspacePathContext,
} from "./workspace-paths.ts";

import { loadValidatedRun } from "./artifact-schema.ts";
import {
  buildScenarioDiscoveryPreparation,
  resolveScenarioDiscoveryPlan,
  runScenarioDiscovery,
  type ScenarioDiscoveryDeps,
} from "./discovery.ts";
import {
  clearEnvironmentProfile,
  formatEnvironmentProfiles,
  loadEnvironmentProfiles,
  resolveEnvironmentProfile,
  saveEnvironmentProfile,
  type EnvironmentProfile,
} from "./environment-profiles.ts";
import {
  getDictionaryScenario,
  ScenarioDictionaryError,
  loadScenarioDictionary,
  toCaptureScenario,
} from "./scenario-dictionary.ts";
import { getScenario, loadScenarioManifest } from "./scenarios.ts";
import { ACCOUNT_ACTIVITY_SCENARIO_ID } from "./browser-capture.ts";
import {
  buildTargetCapturePreparation,
  resolveTargetCapturePlan,
  runTargetCapture,
  type TargetCaptureDeps,
} from "./target-capture.ts";
import {
  buildAccountActivityUpstreamInstructions,
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
  type AccountActivityUpstreamResult,
} from "./upstream-account-activity.ts";

interface ToolTextResult<TDetails extends Record<string, unknown>> {
  content: Array<{ type: "text"; text: string }>;
  details: TDetails;
}

interface ListScenariosParams {
  scenarioDictionaryPath?: string;
}

interface ValidateRunParams {
  runDir: string;
  verifyExchangeCount?: boolean;
}

interface UpstreamCaptureToolParams {
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

interface EnvironmentProfileToolParams extends Partial<EnvironmentProfile> {
  artifactDir?: string;
  profileName: string;
  makeDefault?: boolean;
}

interface ShowEnvironmentProfilesToolParams {
  artifactDir?: string;
}

interface ClearEnvironmentProfileToolParams {
  artifactDir?: string;
  profileName: string;
}

interface TargetCaptureToolParams {
  artifactDir?: string;
  profileName?: string;
  scenarioId: string;
  scenarioDictionaryPath?: string;
  targetIds?: string[];
  groupName?: string;
}

interface ScenarioDiscoveryToolParams {
  artifactDir?: string;
  profileName?: string;
  candidateScenarioId: string;
  targetIds?: string[];
  groupName?: string;
  candidatePagePath?: string;
}

interface AccountActivityToolParams {
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

interface ToolUiAdapter {
  hasUI: boolean;
  confirm(title: string, message: string): Promise<boolean>;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}

interface RunAccountActivityToolDeps {
  runCapture?: typeof runAccountActivityUpstreamCapture;
}

interface RunTargetCaptureToolDeps extends TargetCaptureDeps {
  runCapture?: typeof runTargetCapture;
}

interface RunScenarioDiscoveryToolDeps extends ScenarioDiscoveryDeps {
  runDiscovery?: typeof runScenarioDiscovery;
}

const DEFAULT_OLD_URL = "http://localhost:8080";
const DEFAULT_NEW_URL = "http://localhost:8008";
const DEFAULT_OLD_PROXY_PORT = 18080;
const DEFAULT_NEW_PROXY_PORT = 18081;

const ListScenariosParams = Type.Object({
  scenarioDictionaryPath: Type.Optional(Type.String({ description: "Optional workspace scenario dictionary JSON path. Defaults to .pi-api-audit-runs/scenarios.local.json; package examples are not used as fallback." })),
});

const ValidateRunParams = Type.Object({
  runDir: Type.String({ description: "Path to a .pi-api-audit-runs/<run-id> directory." }),
  verifyExchangeCount: Type.Optional(Type.Boolean({ description: "Verify manifest.exchangeCount against exchanges.ndjson line count." })),
});

const UpstreamCaptureParams = Type.Object({
  scenarioId: Type.String({ description: "Scenario id from the scenario dictionary, for example account-activity-basic." }),
  profileName: Type.Optional(Type.String({ description: "Optional saved environment profile name." })),
  oldUrl: Type.Optional(Type.String({ description: "Old local page base URL. Defaults to profile/default/http://localhost:8080." })),
  newUrl: Type.Optional(Type.String({ description: "New local page base URL. Defaults to profile/default/http://localhost:8008." })),
  oldTargetUrl: Type.Optional(Type.String({ description: "Old upstream/backend target URL. Non-local hosts require allowHosts." })),
  newTargetUrl: Type.Optional(Type.String({ description: "New upstream/backend target URL. Non-local hosts require allowHosts." })),
  oldProxyPort: Type.Optional(Type.Number({ description: "Old recorder listen port. Defaults to 18080." })),
  newProxyPort: Type.Optional(Type.Number({ description: "New recorder listen port. Defaults to 18081." })),
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
  scenarioDictionaryPath: Type.Optional(Type.String({ description: "Optional workspace scenario dictionary JSON path. Defaults to .pi-api-audit-runs/scenarios.local.json; package examples are not used as fallback." })),
  allowHosts: Type.Optional(Type.Array(Type.String(), { description: "Explicitly allowed non-local backend hostnames." })),
});

const ShowEnvironmentProfilesParams = Type.Object({
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
});

const SaveEnvironmentProfileParams = Type.Object({
  profileName: Type.String({ description: "Environment profile name." }),
  oldUrl: Type.String({ description: "Old local page base URL." }),
  newUrl: Type.String({ description: "New local page base URL." }),
  oldTargetUrl: Type.String({ description: "Old upstream/backend target URL." }),
  newTargetUrl: Type.String({ description: "New upstream/backend target URL." }),
  oldProxyPort: Type.Optional(Type.Number({ description: "Old recorder listen port." })),
  newProxyPort: Type.Optional(Type.Number({ description: "New recorder listen port." })),
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
  allowHosts: Type.Optional(Type.Array(Type.String(), { description: "Explicitly allowed non-local backend hostnames." })),
  makeDefault: Type.Optional(Type.Boolean({ description: "Set this profile as default." })),
});

const ClearEnvironmentProfileParams = Type.Object({
  profileName: Type.String({ description: "Environment profile name to clear." }),
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
});

const TargetCaptureParams = Type.Object({
  scenarioId: Type.String({ description: "Scenario id from the scenario dictionary." }),
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
  profileName: Type.Optional(Type.String({ description: "Environment profile name. Defaults to config default profile." })),
  scenarioDictionaryPath: Type.Optional(Type.String({ description: "Optional target-based scenario dictionary JSON path. Defaults to .pi-api-audit-runs/scenarios.local.json; package examples are not used as fallback." })),
  targetIds: Type.Optional(Type.Array(Type.String(), { description: "Specific target ids to include." })),
  groupName: Type.Optional(Type.String({ description: "Target group to include, for example default, all, or candidate-only." })),
});

const ScenarioDiscoveryParams = Type.Object({
  candidateScenarioId: Type.String({ description: "Candidate scenario id; it does not need to exist in the scenario dictionary yet." }),
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
  profileName: Type.Optional(Type.String({ description: "Environment profile name. Defaults to config default profile." })),
  targetIds: Type.Optional(Type.Array(Type.String(), { description: "Specific target ids to include." })),
  groupName: Type.Optional(Type.String({ description: "Target group to include, for example default, all, or candidate-only." })),
  candidatePagePath: Type.Optional(Type.String({ description: "Optional page path to open before manual operation." })),
});

const AccountActivityCaptureParams = Type.Object({
  oldUrl: Type.Optional(Type.String({ description: "Old local page base URL. Defaults to http://localhost:8080." })),
  newUrl: Type.Optional(Type.String({ description: "New local page base URL. Defaults to http://localhost:8008." })),
  oldTargetUrl: Type.String({ description: "Old upstream/backend target URL. Non-local hosts require allowHosts." }),
  newTargetUrl: Type.String({ description: "New upstream/backend target URL. Non-local hosts require allowHosts." }),
  oldProxyPort: Type.Optional(Type.Number({ description: "Old recorder listen port. Defaults to 18080." })),
  newProxyPort: Type.Optional(Type.Number({ description: "New recorder listen port. Defaults to 18081." })),
  artifactDir: Type.Optional(Type.String({ description: "Artifact root directory. Defaults to .pi-api-audit-runs." })),
  manifestPath: Type.Optional(Type.String({ description: "Optional scenario manifest/dictionary path." })),
  allowHosts: Type.Optional(Type.Array(Type.String(), { description: "Explicitly allowed non-local backend hostnames." })),
});

export function registerApiAuditTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "api_audit_list_scenarios",
    label: "API audit scenarios",
    description: "List API behavior audit scenarios from the scenario dictionary.",
    promptSnippet: "List API audit scenarios and their old/new page/API mappings",
    promptGuidelines: [
      "Use api_audit_list_scenarios when the user asks what API audit scenarios are available.",
    ],
    parameters: ListScenariosParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeListScenariosTool(await resolveToolPathParams(params as ListScenariosParams, ctx.cwd, ["scenarioDictionaryPath"]));
    },
  });

  pi.registerTool({
    name: "api_audit_validate_run",
    label: "API audit validate run",
    description: "Validate an API audit artifact run directory using schema-backed loaders.",
    promptSnippet: "Validate API audit manifest/exchanges artifacts",
    promptGuidelines: [
      "Use api_audit_validate_run when the user asks to check whether an API audit run artifact is valid.",
    ],
    parameters: ValidateRunParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeValidateRunTool(await resolveToolPathParams(params as ValidateRunParams, ctx.cwd, ["runDir"]));
    },
  });

  pi.registerTool({
    name: "api_audit_prepare_account_history_upstream_capture",
    label: "Prepare account-activity API audit",
    description: "Prepare deterministic instructions for account-activity old/new upstream API capture without starting proxies or browsers.",
    promptSnippet: "Prepare account-activity upstream API comparison capture instructions",
    promptGuidelines: [
      "Use api_audit_prepare_account_history_upstream_capture when the user wants setup instructions before running account-activity API comparison.",
    ],
    parameters: AccountActivityCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return buildPrepareAccountActivityUpstreamCaptureResult(
        await resolveToolPathParams(params as AccountActivityToolParams, ctx.cwd, ["artifactDir", "manifestPath"]),
      );
    },
  });

  pi.registerTool({
    name: "api_audit_run_account_history_upstream_capture",
    label: "Run account-activity API audit",
    description: "Run account-activity old/new upstream API capture with recorders and Playwright manual-auth flow.",
    promptSnippet: "Run account-activity old/new upstream API capture and validate artifact evidence",
    promptGuidelines: [
      "Use api_audit_run_account_history_upstream_capture when the user asks to run account-activity old/new API capture or comparison.",
      "api_audit_run_account_history_upstream_capture requires interactive confirmation and must not modify app config automatically.",
    ],
    parameters: AccountActivityCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeRunAccountActivityUpstreamCaptureTool(await resolveToolPathParams(params as AccountActivityToolParams, ctx.cwd, ["artifactDir", "manifestPath"]), {
        hasUI: ctx.hasUI,
        confirm: async (title, message) => ctx.ui.confirm(title, message),
        notify: (message, level = "info") => ctx.ui.notify(message, level),
      });
    },
  });

  pi.registerTool({
    name: "api_audit_prepare_upstream_capture",
    label: "Prepare API audit upstream capture",
    description: "Prepare deterministic instructions for a scenario-id-driven old/new upstream API capture.",
    promptSnippet: "Prepare generic scenario upstream API comparison capture instructions",
    promptGuidelines: [
      "Use api_audit_prepare_upstream_capture when the user wants setup instructions for an API audit scenario by scenario id.",
    ],
    parameters: UpstreamCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executePrepareUpstreamCaptureTool(
        await resolveToolPathParams(params as UpstreamCaptureToolParams, ctx.cwd, ["artifactDir", "scenarioDictionaryPath"]),
      );
    },
  });

  pi.registerTool({
    name: "api_audit_run_upstream_capture",
    label: "Run API audit upstream capture",
    description: "Run a scenario-id-driven old/new upstream API capture with recorders and Playwright manual-auth flow.",
    promptSnippet: "Run generic scenario old/new upstream API capture",
    promptGuidelines: [
      "Use api_audit_run_upstream_capture when the user asks to run API comparison for a known scenario id.",
      "api_audit_run_upstream_capture requires interactive confirmation and must not modify app config automatically.",
    ],
    parameters: UpstreamCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeRunUpstreamCaptureTool(await resolveToolPathParams(params as UpstreamCaptureToolParams, ctx.cwd, ["artifactDir", "scenarioDictionaryPath"]), {
        hasUI: ctx.hasUI,
        confirm: async (title, message) => ctx.ui.confirm(title, message),
        notify: (message, level = "info") => ctx.ui.notify(message, level),
      });
    },
  });

  pi.registerTool({
    name: "api_audit_show_environment_profiles",
    label: "Show API audit environment profiles",
    description: "Show saved API audit environment profiles from local gitignored config.",
    promptSnippet: "Show saved API audit frontend/backend environment profiles",
    promptGuidelines: [
      "Use api_audit_show_environment_profiles when the user asks to show API audit environment/profile settings.",
    ],
    parameters: ShowEnvironmentProfilesParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeShowEnvironmentProfilesTool(await resolveToolPathParams(params as ShowEnvironmentProfilesToolParams, ctx.cwd, ["artifactDir"]));
    },
  });

  pi.registerTool({
    name: "api_audit_save_environment_profile",
    label: "Save API audit environment profile",
    description: "Save a non-secret API audit environment profile to local gitignored config.",
    promptSnippet: "Save reusable old/new frontend/backend URLs for API audit",
    promptGuidelines: [
      "Use api_audit_save_environment_profile only when the user explicitly asks to save or remember API audit environment URLs.",
    ],
    parameters: SaveEnvironmentProfileParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeSaveEnvironmentProfileTool(await resolveToolPathParams(params as EnvironmentProfileToolParams, ctx.cwd, ["artifactDir"]));
    },
  });

  pi.registerTool({
    name: "api_audit_clear_environment_profile",
    label: "Clear API audit environment profile",
    description: "Clear a saved API audit environment profile from local gitignored config.",
    promptSnippet: "Clear a saved API audit environment profile",
    promptGuidelines: [
      "Use api_audit_clear_environment_profile when the user asks to remove a saved API audit environment profile.",
    ],
    parameters: ClearEnvironmentProfileParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeClearEnvironmentProfileTool(await resolveToolPathParams(params as ClearEnvironmentProfileToolParams, ctx.cwd, ["artifactDir"]));
    },
  });

  pi.registerTool({
    name: "api_audit_list_targets",
    label: "List API audit targets",
    description: "List selected target-based capture plan entries for a scenario/profile.",
    promptSnippet: "List API audit targets for a scenario/profile/group",
    promptGuidelines: [
      "Use api_audit_list_targets when the user asks which configured targets can be audited for a scenario.",
    ],
    parameters: TargetCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeListTargetsTool(await resolveToolPathParams(params as TargetCaptureToolParams, ctx.cwd, ["artifactDir", "scenarioDictionaryPath"]));
    },
  });

  pi.registerTool({
    name: "api_audit_prepare_target_capture",
    label: "Prepare target-based API audit capture",
    description: "Prepare instructions for target-based API audit capture without starting browsers or proxies.",
    promptSnippet: "Prepare target-based API audit capture instructions",
    promptGuidelines: [
      "Use api_audit_prepare_target_capture when the user asks to prepare API audit for selected targets or target groups.",
    ],
    parameters: TargetCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executePrepareTargetCaptureTool(
        await resolveToolPathParams(params as TargetCaptureToolParams, ctx.cwd, ["artifactDir", "scenarioDictionaryPath"]),
      );
    },
  });

  pi.registerTool({
    name: "api_audit_run_target_capture",
    label: "Run target-based API audit capture",
    description: "Run target-based API audit capture with recorders and Playwright manual-auth flow.",
    promptSnippet: "Run target-based API audit capture for selected targets",
    promptGuidelines: [
      "Use api_audit_run_target_capture when the user asks to run capture for selected API audit targets.",
      "This requires interactive confirmation and must not modify app config automatically.",
    ],
    parameters: TargetCaptureParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeRunTargetCaptureTool(await resolveToolPathParams(params as TargetCaptureToolParams, ctx.cwd, ["artifactDir", "scenarioDictionaryPath"]), {
        hasUI: ctx.hasUI,
        confirm: async (title, message) => ctx.ui.confirm(title, message),
        notify: (message, level = "info") => ctx.ui.notify(message, level),
      });
    },
  });

  pi.registerTool({
    name: "api_audit_prepare_scenario_discovery",
    label: "Prepare API audit scenario discovery",
    description: "Prepare manual-assisted scenario discovery without requiring the scenario dictionary entry to exist.",
    promptSnippet: "Prepare manual-assisted API scenario discovery",
    promptGuidelines: [
      "Use api_audit_prepare_scenario_discovery when the user wants to record a new flow before it exists in the scenario dictionary.",
    ],
    parameters: ScenarioDiscoveryParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executePrepareScenarioDiscoveryTool(await resolveToolPathParams(params as ScenarioDiscoveryToolParams, ctx.cwd, ["artifactDir"]));
    },
  });

  pi.registerTool({
    name: "api_audit_run_scenario_discovery",
    label: "Run API audit scenario discovery",
    description: "Run manual-assisted scenario discovery with recorders while the user operates the browser.",
    promptSnippet: "Run manual-assisted API scenario discovery recording",
    promptGuidelines: [
      "Use api_audit_run_scenario_discovery when the user wants to manually operate a browser and say done after recording.",
      "This does not modify the scenario dictionary source of truth.",
    ],
    parameters: ScenarioDiscoveryParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeRunScenarioDiscoveryTool(await resolveToolPathParams(params as ScenarioDiscoveryToolParams, ctx.cwd, ["artifactDir"]), {
        hasUI: ctx.hasUI,
        confirm: async (title, message) => ctx.ui.confirm(title, message),
        notify: (message, level = "info") => ctx.ui.notify(message, level),
      });
    },
  });
}

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

async function resolveToolPathParams<T extends object>(
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

function requiredToolString(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
