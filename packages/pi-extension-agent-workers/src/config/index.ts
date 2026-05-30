import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { validateCustomWorkerProfiles } from "./profiles.ts";
import type { WorkerAdapterName, WorkerProfile } from "../core/request-types.ts";

const CONFIG_VERSION = 1;
const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_WIDGET_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

export type HistoryScopePreference = "current" | "all";
export type WidgetPlacementPreference = "aboveEditor" | "belowEditor";

export interface WorkspaceAgentWorkerConfig {
  version: number;
  scopeKey: string;
  scopeLabel: string;
  defaultProfile?: string;
  defaultAdapter?: WorkerAdapterName;
  defaultTimeoutMs?: number;
  historyScope?: HistoryScopePreference;
  historyLimit?: number;
  widgetPlacement?: WidgetPlacementPreference;
  widgetLimit?: number;
  profiles?: WorkerProfile[];
}

export type WorkspaceAgentWorkerConfigPatch = Partial<
  Pick<
    WorkspaceAgentWorkerConfig,
    "defaultProfile" | "defaultAdapter" | "defaultTimeoutMs" | "historyScope" | "historyLimit" | "widgetPlacement" | "widgetLimit" | "profiles"
  >
>;

export interface WorkspaceConfigRef {
  configDir?: string;
  scopeKey: string;
  scopeLabel: string;
}

export function getDefaultAgentWorkerConfigDir(): string {
  return join(homedir(), ".pi", "agent", "agent-workers", "config");
}

export function getWorkspaceConfigPath(configDir: string, scopeKey: string): string {
  return join(configDir, "workspaces", `${scopeHash(scopeKey)}.json`);
}

export async function readWorkspaceConfig(ref: WorkspaceConfigRef): Promise<WorkspaceAgentWorkerConfig> {
  const configDir = ref.configDir ?? getDefaultAgentWorkerConfigDir();
  const path = getWorkspaceConfigPath(configDir, ref.scopeKey);
  try {
    const raw = await readFile(path, "utf8");
    return normalizeConfig(JSON.parse(raw), ref);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return baseConfig(ref);
    throw error;
  }
}

export async function updateWorkspaceConfig(
  ref: WorkspaceConfigRef,
  patch: WorkspaceAgentWorkerConfigPatch,
): Promise<WorkspaceAgentWorkerConfig> {
  validateConfigPatch(patch);
  const current = await readWorkspaceConfig(ref);
  const next = normalizeConfig({ ...current, ...patch }, ref);
  const configDir = ref.configDir ?? getDefaultAgentWorkerConfigDir();
  const path = getWorkspaceConfigPath(configDir, ref.scopeKey);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return next;
}

export function validateWorkspaceConfigPatch(key: string, rawValue: string): WorkspaceAgentWorkerConfigPatch {
  switch (key) {
    case "defaultProfile":
      return { defaultProfile: nonEmptyString(rawValue, key) };
    case "defaultAdapter":
      if (!isWorkerAdapterName(rawValue)) throw new Error("defaultAdapter must be one of: demo, claude-code, codex-cli.");
      return { defaultAdapter: rawValue };
    case "defaultTimeoutMs":
      return { defaultTimeoutMs: parseBoundedInteger(rawValue, key, 1, MAX_TIMEOUT_MS) };
    case "historyScope":
      if (rawValue !== "current" && rawValue !== "all") throw new Error("historyScope must be current or all.");
      return { historyScope: rawValue };
    case "historyLimit":
      return { historyLimit: parseBoundedInteger(rawValue, key, 1, MAX_HISTORY_LIMIT) };
    case "widgetPlacement":
      if (rawValue !== "aboveEditor" && rawValue !== "belowEditor") {
        throw new Error("widgetPlacement must be aboveEditor or belowEditor.");
      }
      return { widgetPlacement: rawValue };
    case "widgetLimit":
      return { widgetLimit: parseBoundedInteger(rawValue, key, 1, MAX_WIDGET_LIMIT) };
    default:
      throw new Error(`Unknown worker config key: ${key}`);
  }
}

function normalizeConfig(raw: unknown, ref: WorkspaceConfigRef): WorkspaceAgentWorkerConfig {
  if (!raw || typeof raw !== "object") throw new Error("Invalid agent worker workspace config.");
  const input = raw as Partial<WorkspaceAgentWorkerConfig>;
  const config: WorkspaceAgentWorkerConfig = {
    version: CONFIG_VERSION,
    scopeKey: ref.scopeKey,
    scopeLabel: ref.scopeLabel,
    ...(input.defaultProfile === undefined ? {} : { defaultProfile: input.defaultProfile }),
    ...(input.defaultAdapter === undefined ? {} : { defaultAdapter: input.defaultAdapter }),
    ...(input.defaultTimeoutMs === undefined ? {} : { defaultTimeoutMs: input.defaultTimeoutMs }),
    ...(input.historyScope === undefined ? {} : { historyScope: input.historyScope }),
    ...(input.historyLimit === undefined ? {} : { historyLimit: input.historyLimit }),
    ...(input.widgetPlacement === undefined ? {} : { widgetPlacement: input.widgetPlacement }),
    ...(input.widgetLimit === undefined ? {} : { widgetLimit: input.widgetLimit }),
    ...(input.profiles === undefined ? {} : { profiles: validateCustomWorkerProfiles(input.profiles) }),
  };
  validateConfigPatch(config);
  return config;
}

function validateConfigPatch(patch: WorkspaceAgentWorkerConfigPatch): void {
  if (patch.defaultProfile !== undefined) nonEmptyString(patch.defaultProfile, "defaultProfile");
  if (patch.defaultAdapter !== undefined && !isWorkerAdapterName(patch.defaultAdapter)) {
    throw new Error("defaultAdapter must be one of: demo, claude-code, codex-cli.");
  }
  if (patch.defaultTimeoutMs !== undefined) validateInteger(patch.defaultTimeoutMs, "defaultTimeoutMs", 1, MAX_TIMEOUT_MS);
  if (patch.historyScope !== undefined && patch.historyScope !== "current" && patch.historyScope !== "all") {
    throw new Error("historyScope must be current or all.");
  }
  if (patch.historyLimit !== undefined) validateInteger(patch.historyLimit, "historyLimit", 1, MAX_HISTORY_LIMIT);
  if (patch.widgetPlacement !== undefined && patch.widgetPlacement !== "aboveEditor" && patch.widgetPlacement !== "belowEditor") {
    throw new Error("widgetPlacement must be aboveEditor or belowEditor.");
  }
  if (patch.widgetLimit !== undefined) validateInteger(patch.widgetLimit, "widgetLimit", 1, MAX_WIDGET_LIMIT);
  if (patch.profiles !== undefined) validateCustomWorkerProfiles(patch.profiles);
}

function baseConfig(ref: WorkspaceConfigRef): WorkspaceAgentWorkerConfig {
  return { version: CONFIG_VERSION, scopeKey: ref.scopeKey, scopeLabel: ref.scopeLabel };
}

function parseBoundedInteger(rawValue: string, key: string, min: number, max: number): number {
  const value = Number(rawValue);
  validateInteger(value, key, min, max);
  return value;
}

function validateInteger(value: number, key: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}.`);
}

function nonEmptyString(value: string, key: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${key} must not be empty.`);
  return trimmed;
}

function isWorkerAdapterName(value: string): value is WorkerAdapterName {
  return value === "demo" || value === "claude-code" || value === "codex-cli";
}

function scopeHash(scopeKey: string): string {
  return createHash("sha256").update(scopeKey).digest("hex").slice(0, 24);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
