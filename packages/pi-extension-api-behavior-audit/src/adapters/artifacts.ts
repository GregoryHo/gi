import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { validateApiExchange, validateCaptureManifest, validateComparisonRun } from "../schemas/artifact-schema.ts";
import type { ApiExchange, CaptureManifest, ComparisonAnalysisArtifact, ComparisonRunArtifact } from "../types.ts";

export interface RunPaths {
  runDir: string;
  manifestPath: string;
  exchangesPath: string;
}

export function createRunId(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function createComparisonRunId(now = new Date()): string {
  return `comparison-${createRunId(now)}`;
}

export function getRunPaths(rootDir: string, runId: string): RunPaths {
  const runDir = join(rootDir, runId);
  return {
    runDir,
    manifestPath: join(runDir, "manifest.json"),
    exchangesPath: join(runDir, "exchanges.ndjson"),
  };
}

export function getComparisonRunPath(rootDir: string, comparisonRunId: string): string {
  return join(rootDir, "comparisons", `${comparisonRunId}.json`);
}

export function getComparisonAnalysisPath(rootDir: string, comparisonRunId: string): string {
  return join(rootDir, "analysis", `${comparisonRunId}.json`);
}

export async function writeManifest(rootDir: string, manifest: CaptureManifest): Promise<RunPaths> {
  await validateCaptureManifest(manifest);
  const paths = getRunPaths(rootDir, manifest.runId);
  await mkdir(paths.runDir, { recursive: true });
  await writeFile(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return paths;
}

export async function writeComparisonRun(rootDir: string, comparison: ComparisonRunArtifact): Promise<string> {
  await validateComparisonRun(comparison);
  const path = getComparisonRunPath(rootDir, comparison.comparisonRunId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
  return path;
}

export async function writeComparisonAnalysis(rootDir: string, analysis: ComparisonAnalysisArtifact): Promise<string> {
  const path = getComparisonAnalysisPath(rootDir, analysis.comparisonRunId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  return path;
}

export async function appendExchange(rootDir: string, exchange: ApiExchange): Promise<RunPaths> {
  await validateApiExchange(exchange);
  const paths = getRunPaths(rootDir, exchange.runId);
  await mkdir(paths.runDir, { recursive: true });
  await appendFile(paths.exchangesPath, `${JSON.stringify(exchange)}\n`, "utf8");
  return paths;
}
