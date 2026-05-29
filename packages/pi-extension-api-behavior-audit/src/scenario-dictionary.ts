import { readFile } from "node:fs/promises";

import { loadPackageSchema, SchemaValidationError, validateWithSchema } from "./schema-validation.ts";
import type { CaptureScenario, ScenarioManifest } from "./types.ts";

export class ScenarioDictionaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioDictionaryError";
  }
}

export interface ScenarioDictionaryEvidenceComparison {
  comparisonRunId: string;
  targets: {
    old: string;
    new: string;
  };
  acceptedAt?: string;
  notes?: string[];
}

export interface ScenarioDictionaryEntry {
  id: string;
  feature: string;
  description: string;
  type: "read-only";
  page: {
    oldPath: string;
    newPath: string;
  };
  browserApiAllowlist: {
    old: string[];
    new: string[];
  };
  upstreamApiCandidates: {
    old: string[];
    new: string[];
  };
  evidence?: {
    comparisons: ScenarioDictionaryEvidenceComparison[];
  };
  notes?: string[];
}

export interface ScenarioDictionary {
  version: 1;
  scenarios: ScenarioDictionaryEntry[];
}

let schemaPromise: ReturnType<typeof loadPackageSchema> | undefined;

export async function loadScenarioDictionary(path: string): Promise<ScenarioDictionary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScenarioDictionaryError(`Failed to read scenario dictionary ${path}: ${message}`);
  }
  return validateScenarioDictionary(parsed);
}

export async function validateScenarioDictionary(value: unknown): Promise<ScenarioDictionary> {
  try {
    validateWithSchema(value, await getSchema(), "scenarioDictionary");
  } catch (error) {
    if (error instanceof SchemaValidationError) throw new ScenarioDictionaryError(error.message);
    throw error;
  }

  const dictionary = value as ScenarioDictionary;
  const ids = new Set<string>();
  for (const scenario of dictionary.scenarios) {
    if (ids.has(scenario.id)) throw new ScenarioDictionaryError(`Duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
  }
  return dictionary;
}

export function getDictionaryScenario(dictionary: ScenarioDictionary, scenarioId: string): ScenarioDictionaryEntry {
  const scenario = dictionary.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new ScenarioDictionaryError(`Scenario not found: ${scenarioId}`);
  return scenario;
}

export function toCaptureScenarioManifest(dictionary: ScenarioDictionary): ScenarioManifest {
  return {
    version: 1,
    scenarios: dictionary.scenarios.map(toCaptureScenario),
  };
}

export function toCaptureScenario(scenario: ScenarioDictionaryEntry): CaptureScenario {
  return {
    id: scenario.id,
    feature: scenario.feature,
    description: scenario.description,
    type: scenario.type,
    layer: "browser-visible",
    page: { ...scenario.page },
    apiAllowlist: {
      old: [...scenario.browserApiAllowlist.old],
      new: [...scenario.browserApiAllowlist.new],
    },
    ...(scenario.notes ? { notes: [...scenario.notes] } : {}),
  };
}

function getSchema() {
  schemaPromise ??= loadPackageSchema("schemas/scenario-dictionary.v1.schema.json");
  return schemaPromise;
}
