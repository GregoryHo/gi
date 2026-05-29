import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadPackageSchema, SchemaValidationError, validateWithSchema } from "./schema-validation.ts";
import type { ApiExchange, CaptureManifest, ComparisonRunArtifact } from "./types.ts";

export class ArtifactSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactSchemaError";
  }
}

export interface ValidatedRun {
  manifest: CaptureManifest;
  exchanges: ApiExchange[];
}

export interface LoadValidatedRunOptions {
  verifyExchangeCount?: boolean;
}

let manifestSchemaPromise: ReturnType<typeof loadPackageSchema> | undefined;
let exchangeSchemaPromise: ReturnType<typeof loadPackageSchema> | undefined;
let comparisonRunSchemaPromise: ReturnType<typeof loadPackageSchema> | undefined;

export async function validateCaptureManifest(value: unknown): Promise<CaptureManifest> {
  await validateAgainstPackageSchema(value, getManifestSchema(), "manifest");
  return value as CaptureManifest;
}

export async function validateApiExchange(value: unknown): Promise<ApiExchange> {
  await validateAgainstPackageSchema(value, getExchangeSchema(), "exchange");
  return value as ApiExchange;
}

export async function validateComparisonRun(value: unknown): Promise<ComparisonRunArtifact> {
  await validateAgainstPackageSchema(value, getComparisonRunSchema(), "comparisonRun");
  return value as ComparisonRunArtifact;
}

export async function loadCaptureManifest(path: string): Promise<CaptureManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ArtifactSchemaError(`Failed to read manifest ${path}: ${message}`);
  }
  return validateCaptureManifest(parsed);
}

export async function loadComparisonRun(path: string): Promise<ComparisonRunArtifact> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ArtifactSchemaError(`Failed to read comparison run ${path}: ${message}`);
  }
  return validateComparisonRun(parsed);
}

export async function loadApiExchanges(path: string): Promise<ApiExchange[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ArtifactSchemaError(`Failed to read exchanges ${path}: ${message}`);
  }

  const exchanges: ApiExchange[] = [];
  const lines = raw.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ArtifactSchemaError(`Invalid exchange JSON at line ${index + 1}: ${message}`);
    }

    try {
      exchanges.push(await validateApiExchange(parsed));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ArtifactSchemaError(`Invalid exchange at line ${index + 1}: ${message}`);
    }
  }
  return exchanges;
}

export async function loadValidatedRun(runDir: string, options: LoadValidatedRunOptions = {}): Promise<ValidatedRun> {
  const manifest = await loadCaptureManifest(join(runDir, "manifest.json"));
  const exchanges = await loadApiExchanges(join(runDir, "exchanges.ndjson"));

  if (options.verifyExchangeCount && manifest.exchangeCount !== undefined && manifest.exchangeCount !== exchanges.length) {
    throw new ArtifactSchemaError(
      `manifest.exchangeCount (${manifest.exchangeCount}) does not match exchanges.ndjson line count (${exchanges.length}).`,
    );
  }

  for (const exchange of exchanges) {
    if (exchange.runId !== manifest.runId) {
      throw new ArtifactSchemaError(`Exchange runId ${exchange.runId} does not match manifest runId ${manifest.runId}.`);
    }
    if (manifest.layer && exchange.layer !== manifest.layer) {
      throw new ArtifactSchemaError(`Exchange layer ${exchange.layer} does not match manifest layer ${manifest.layer}.`);
    }
    if (!manifest.scenarios.includes(exchange.scenarioId)) {
      throw new ArtifactSchemaError(`Exchange scenarioId ${exchange.scenarioId} is not listed in manifest.scenarios.`);
    }
  }

  return { manifest, exchanges };
}

function getManifestSchema() {
  manifestSchemaPromise ??= loadPackageSchema("schemas/manifest.v1.schema.json");
  return manifestSchemaPromise;
}

function getExchangeSchema() {
  exchangeSchemaPromise ??= loadPackageSchema("schemas/exchange.v1.schema.json");
  return exchangeSchemaPromise;
}

function getComparisonRunSchema() {
  comparisonRunSchemaPromise ??= loadPackageSchema("schemas/comparison-run.v1.schema.json");
  return comparisonRunSchemaPromise;
}

async function validateAgainstPackageSchema(value: unknown, schemaPromise: ReturnType<typeof loadPackageSchema>, label: string): Promise<void> {
  try {
    validateWithSchema(value, await schemaPromise, label);
  } catch (error) {
    if (error instanceof SchemaValidationError) throw new ArtifactSchemaError(error.message);
    throw error;
  }
}
