import {
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_WORKSPACE_SCENARIO_DICTIONARY_PATH,
  resolveWorkspacePath,
  type WorkspacePathContext,
} from "../workspace-paths.ts";

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

export function resolveConfigPaths<T extends object>(
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

export function resolveCommandPathFlags(
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

