import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  buildPrepareAccountActivityUpstreamCaptureResult,
  executeListScenariosTool,
  executePrepareUpstreamCaptureTool,
  executeRunAccountActivityUpstreamCaptureTool,
  executeRunUpstreamCaptureTool,
  executeValidateRunTool,
  resolveToolPathParams,
} from "./executors.ts";
import {
  executeClearEnvironmentProfileTool,
  executeListTargetsTool,
  executePrepareScenarioDiscoveryTool,
  executePrepareTargetCaptureTool,
  executeRunScenarioDiscoveryTool,
  executeRunTargetCaptureTool,
  executeSaveEnvironmentProfileTool,
  executeShowEnvironmentProfilesTool,
} from "./target-profile-executors.ts";
import type {
  AccountActivityToolParams,
  ClearEnvironmentProfileToolParams,
  EnvironmentProfileToolParams,
  ListScenariosParams,
  ScenarioDiscoveryToolParams,
  ShowEnvironmentProfilesToolParams,
  TargetCaptureToolParams,
  UpstreamCaptureToolParams,
  ValidateRunParams,
} from "./tool-types.ts";
import { Type } from "typebox";

import {
  createWorkspacePathContext,
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
  resolveWorkspacePath,
  type WorkspacePathContext,
} from "../config/workspace-paths.ts";

import { loadValidatedRun } from "../schemas/artifact-schema.ts";
import {
  buildScenarioDiscoveryPreparation,
  resolveScenarioDiscoveryPlan,
  runScenarioDiscovery,
  type ScenarioDiscoveryDeps,
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
  ScenarioDictionaryError,
  loadScenarioDictionary,
  toCaptureScenario,
} from "../core/scenario-dictionary.ts";
import { getScenario, loadScenarioManifest } from "../core/scenarios.ts";
import { ACCOUNT_ACTIVITY_SCENARIO_ID } from "../adapters/browser-capture.ts";
import {
  buildTargetCapturePreparation,
  resolveTargetCapturePlan,
  runTargetCapture,
  type TargetCaptureDeps,
} from "../adapters/target-capture.ts";
import {
  buildAccountActivityUpstreamInstructions,
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
  type AccountActivityUpstreamResult,
} from "../adapters/upstream-account-activity.ts";

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

export * from "./executors.ts";
export * from "./target-profile-executors.ts";
