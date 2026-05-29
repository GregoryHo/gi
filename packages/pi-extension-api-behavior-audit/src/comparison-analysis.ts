import { dirname } from "node:path";

import { writeComparisonAnalysis } from "./artifacts.ts";
import { loadApiExchanges, loadComparisonRun } from "./artifact-schema.ts";
import { getDictionaryScenario, loadScenarioDictionary, type ScenarioDictionaryEntry } from "./scenario-dictionary.ts";
import type {
  ApiExchange,
  ApiSide,
  BrowserVisibleApiObservation,
  ComparisonAnalysisArtifact,
  ComparisonRunArtifact,
  ComparisonRunTargetArtifact,
  EndpointAnalysisSummary,
} from "./types.ts";

export class ComparisonAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComparisonAnalysisError";
  }
}

export interface AnalyzeComparisonRunInput {
  comparisonPath: string;
  artifactDir?: string;
  scenarioDictionaryPath?: string;
}

export interface AnalyzeComparisonRunResult {
  analysis: ComparisonAnalysisArtifact;
  analysisPath: string;
}

interface EndpointAccumulator {
  method: string;
  path: string;
  count: number;
  statuses: Record<string, number>;
  responseTopLevelKeys: Set<string>;
}

export async function analyzeComparisonRun(input: AnalyzeComparisonRunInput): Promise<AnalyzeComparisonRunResult> {
  const comparison = await loadComparisonRun(input.comparisonPath);
  const artifactDir = input.artifactDir ?? dirname(dirname(input.comparisonPath));
  const scenario = await loadOptionalScenario(comparison.candidateScenarioId, input.scenarioDictionaryPath);
  const targets: ComparisonAnalysisArtifact["targets"] = {};

  for (const [targetKey, target] of Object.entries(comparison.targets)) {
    const exchanges = await loadApiExchanges(target.exchangesPath ?? target.manifestPath.replace(/manifest\.json$/, "exchanges.ndjson"));
    targets[targetKey] = {
      targetId: target.targetId,
      side: target.side,
      ...(target.variant ? { variant: target.variant } : {}),
      runId: target.runId,
      ...(target.browserContext?.page ? { page: target.browserContext.page } : {}),
      upstream: {
        endpointSummary: summarizeUpstreamEndpoints(exchanges, target.side, scenario),
      },
      browserVisible: {
        endpointSummary: summarizeBrowserVisibleEndpoints(target.browserContext?.browserVisibleRequests ?? [], target.side, scenario),
      },
    };
  }

  const analysis: ComparisonAnalysisArtifact = {
    version: 1,
    kind: "api-behavior-comparison-analysis",
    comparisonRunId: comparison.comparisonRunId,
    candidateScenarioId: comparison.candidateScenarioId,
    generatedAt: new Date().toISOString(),
    targets,
  };
  const analysisPath = await writeComparisonAnalysis(artifactDir, analysis);
  return { analysis, analysisPath };
}

export function summarizeUpstreamEndpoints(
  exchanges: ApiExchange[],
  side: ApiSide,
  scenario?: ScenarioDictionaryEntry,
): EndpointAnalysisSummary[] {
  return summarizeEndpoints(
    exchanges.map((exchange) => ({
      method: exchange.request.method,
      url: exchange.request.url,
      status: exchange.response.status,
      body: exchange.response.body,
    })),
    scenario?.upstreamApiCandidates[side] ?? [],
    "matches-known-upstream-candidate",
  );
}

export function summarizeBrowserVisibleEndpoints(
  observations: BrowserVisibleApiObservation[],
  side: ApiSide,
  scenario?: ScenarioDictionaryEntry,
): EndpointAnalysisSummary[] {
  return summarizeEndpoints(
    observations.map((observation) => ({
      method: observation.method,
      url: observation.path || observation.url,
      status: observation.status,
      body: undefined,
    })),
    scenario?.browserApiAllowlist[side] ?? [],
    "matches-known-browser-api",
  );
}

function summarizeEndpoints(
  items: Array<{ method: string; url: string; status: number; body: unknown }>,
  knownPaths: string[],
  knownHint: string,
): EndpointAnalysisSummary[] {
  const groups = new Map<string, EndpointAccumulator>();
  for (const item of items) {
    const method = item.method.toUpperCase();
    const path = normalizePath(item.url);
    const key = `${method} ${path}`;
    let group = groups.get(key);
    if (!group) {
      group = { method, path, count: 0, statuses: {}, responseTopLevelKeys: new Set<string>() };
      groups.set(key, group);
    }
    group.count += 1;
    const status = String(item.status);
    group.statuses[status] = (group.statuses[status] ?? 0) + 1;
    for (const key of getTopLevelKeys(item.body)) group.responseTopLevelKeys.add(key);
  }

  return [...groups.values()]
    .map((group) => {
      const classificationHints = buildClassificationHints(group, knownPaths, knownHint);
      return {
        method: group.method,
        path: group.path,
        count: group.count,
        statuses: sortRecord(group.statuses),
        ...(group.responseTopLevelKeys.size ? { responseTopLevelKeys: [...group.responseTopLevelKeys].sort() } : {}),
        classificationHints,
      };
    })
    .sort((left, right) => right.count - left.count || left.method.localeCompare(right.method) || left.path.localeCompare(right.path));
}

function buildClassificationHints(group: EndpointAccumulator, knownPaths: string[], knownHint: string): string[] {
  const hints: string[] = [];
  if (knownPaths.includes(group.path)) hints.push(knownHint);
  if (group.count >= 10 && hints.length === 0) hints.push("high-frequency-background-candidate");
  return hints;
}

function normalizePath(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, "http://api-audit.local");
    return url.pathname;
  } catch {
    return rawUrl.split("?", 1)[0] || rawUrl;
  }
}

function getTopLevelKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>);
}

function sortRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => Number(left) - Number(right)));
}

async function loadOptionalScenario(scenarioId: string, scenarioDictionaryPath?: string): Promise<ScenarioDictionaryEntry | undefined> {
  try {
    if (!scenarioDictionaryPath) return undefined;
    const dictionary = await loadScenarioDictionary(scenarioDictionaryPath);
    return getDictionaryScenario(dictionary, scenarioId);
  } catch {
    return undefined;
  }
}
