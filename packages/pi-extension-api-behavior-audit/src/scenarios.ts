import { readFile } from "node:fs/promises";

import {
  toCaptureScenarioManifest,
  validateScenarioDictionary,
} from "./scenario-dictionary.ts";
import type { CaptureScenario, ScenarioManifest } from "./types.ts";

export class ScenarioManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioManifestError";
  }
}

export async function loadScenarioManifest(manifestPath?: string): Promise<ScenarioManifest> {
  if (!manifestPath) {
    throw new ScenarioManifestError("A workspace scenario manifest path is required; package scenarios are examples only.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScenarioManifestError(`Failed to read scenario manifest ${manifestPath}: ${message}`);
  }

  if (isScenarioDictionaryLike(parsed)) {
    return toCaptureScenarioManifest(await validateScenarioDictionary(parsed));
  }

  return validateScenarioManifest(parsed);
}

export function getScenario(manifest: ScenarioManifest, scenarioId: string): CaptureScenario {
  const scenario = manifest.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new ScenarioManifestError(`Scenario not found: ${scenarioId}`);
  }
  return scenario;
}

function isScenarioDictionaryLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.scenarios) &&
    value.scenarios.some((scenario) => isRecord(scenario) && "browserApiAllowlist" in scenario)
  );
}

function validateScenarioManifest(value: unknown): ScenarioManifest {
  if (!isRecord(value)) {
    throw new ScenarioManifestError("Scenario manifest must be an object.");
  }
  if (value.version !== 1) {
    throw new ScenarioManifestError("Scenario manifest version must be 1.");
  }
  if (!Array.isArray(value.scenarios)) {
    throw new ScenarioManifestError("Scenario manifest scenarios must be an array.");
  }

  const ids = new Set<string>();
  const scenarios = value.scenarios.map((scenario, index) => validateScenario(scenario, index));
  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) {
      throw new ScenarioManifestError(`Duplicate scenario id: ${scenario.id}`);
    }
    ids.add(scenario.id);
  }

  return { version: 1, scenarios };
}

function validateScenario(value: unknown, index: number): CaptureScenario {
  if (!isRecord(value)) throw new ScenarioManifestError(`Scenario ${index} must be an object.`);

  const id = requiredString(value, "id", index);
  const feature = requiredString(value, "feature", index);
  const description = requiredString(value, "description", index);
  const type = requiredString(value, "type", index);
  const layer = requiredString(value, "layer", index);
  if (type !== "read-only") throw new ScenarioManifestError(`Scenario ${id} type must be read-only.`);
  if (layer !== "browser-visible") throw new ScenarioManifestError(`Scenario ${id} layer must be browser-visible for M3.`);

  const page = requiredRecord(value, "page", index);
  const oldPath = requiredString(page, "oldPath", index);
  const newPath = requiredString(page, "newPath", index);

  const apiAllowlist = requiredRecord(value, "apiAllowlist", index);
  const old = requiredStringArray(apiAllowlist, "old", index);
  const currentNew = requiredStringArray(apiAllowlist, "new", index);

  const notes = value.notes === undefined ? undefined : requiredStringArray(value, "notes", index);

  return {
    id,
    feature,
    description,
    type: "read-only",
    layer: "browser-visible",
    page: { oldPath, newPath },
    apiAllowlist: { old, new: currentNew },
    ...(notes ? { notes } : {}),
  };
}

function requiredString(source: Record<string, unknown>, key: string, index: number): string {
  const value = source[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ScenarioManifestError(`Scenario ${index} missing required string field: ${key}`);
  }
  return value;
}

function requiredRecord(source: Record<string, unknown>, key: string, index: number): Record<string, unknown> {
  const value = source[key];
  if (!isRecord(value)) {
    throw new ScenarioManifestError(`Scenario ${index} missing required object field: ${key}`);
  }
  return value;
}

function requiredStringArray(source: Record<string, unknown>, key: string, index: number): string[] {
  const value = source[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new ScenarioManifestError(`Scenario ${index} missing required string array field: ${key}`);
  }
  return [...value] as string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
