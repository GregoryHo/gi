import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getDictionaryScenario, loadScenarioDictionary, type ScenarioDictionaryEntry } from "./scenario-dictionary.ts";
import type { ApiSide, ComparisonAnalysisArtifact, ComparisonTargetAnalysis, EndpointAnalysisSummary } from "../types.ts";

export class ScenarioSuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioSuggestionError";
  }
}

export interface GenerateScenarioSuggestionInput {
  analysisPath: string;
  artifactDir?: string;
  scenarioDictionaryPath?: string;
}

export interface GenerateScenarioSuggestionResult {
  suggestion: ScenarioDictionarySuggestion;
  suggestionPath: string;
}

export interface ValidateScenarioSuggestionInput {
  suggestionPath: string;
  scenarioDictionaryPath?: string;
}

export interface ScenarioSuggestionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestion?: ScenarioDictionarySuggestion;
}

export type ScenarioDictionarySuggestion = ExistingScenarioPatchSuggestion | NewScenarioCandidateSuggestion;

export interface ExistingScenarioPatchSuggestion extends BaseScenarioSuggestion {
  mode: "existing-scenario-patch";
  suggestedPatch: {
    scenarioId: string;
    appendEvidenceComparison: EvidenceComparisonSuggestion;
  };
}

export interface NewScenarioCandidateSuggestion extends BaseScenarioSuggestion {
  mode: "new-scenario-candidate";
  suggestedScenario: {
    id: string;
    feature: string;
    description: string;
    type: "read-only";
    page: { oldPath: string; newPath: string };
    browserApiAllowlist: Record<ApiSide, string[]>;
    upstreamApiCandidates: Record<ApiSide, string[]>;
    evidence: { comparisons: EvidenceComparisonSuggestion[] };
  };
}

export interface BaseScenarioSuggestion {
  version: 1;
  kind: "scenario-dictionary-suggestion";
  mode: "existing-scenario-patch" | "new-scenario-candidate";
  scenarioId: string;
  comparisonRunId: string;
  sourceAnalysisPath: string;
  generatedAt: string;
  observed: ObservedScenarioEvidence;
  notes: string[];
}

export interface EvidenceComparisonSuggestion {
  comparisonRunId: string;
  targets: Partial<Record<ApiSide, string>>;
}

export interface ObservedScenarioEvidence {
  page: { oldPath?: string; newPath?: string };
  candidateMatches: {
    upstream: Record<ApiSide, string[]>;
    browserVisible: Record<ApiSide, string[]>;
  };
  possibleAdditionalUpstream: Record<ApiSide, string[]>;
  backgroundCandidates: {
    upstream: Record<ApiSide, string[]>;
  };
}

export async function validateScenarioSuggestion(input: ValidateScenarioSuggestionInput): Promise<ScenarioSuggestionValidationResult> {
  const errors: string[] = [];
  const warnings = ["Suggestion artifacts require human review before updating scenario dictionary SOT."];
  const suggestion = await loadScenarioSuggestion(input.suggestionPath, errors);
  if (!suggestion) return { valid: false, errors, warnings };

  const analysis = await loadComparisonAnalysisForValidation(suggestion.sourceAnalysisPath, errors);
  if (analysis) {
    if (suggestion.comparisonRunId !== analysis.comparisonRunId) {
      errors.push(`suggestion.comparisonRunId ${suggestion.comparisonRunId} does not match source analysis ${analysis.comparisonRunId}.`);
    }
    if (suggestion.scenarioId !== analysis.candidateScenarioId) {
      errors.push(`suggestion.scenarioId ${suggestion.scenarioId} does not match source analysis ${analysis.candidateScenarioId}.`);
    }
    validateEvidenceComparisonTargets(suggestion, analysis, errors);
  }

  const existingScenario = await loadOptionalScenario(suggestion.scenarioId, input.scenarioDictionaryPath);
  if (suggestion.mode === "existing-scenario-patch") {
    if (!existingScenario) {
      errors.push(`Existing-scenario patch ${suggestion.scenarioId} does not exist in the scenario dictionary.`);
    }
    if (suggestion.suggestedPatch.scenarioId !== suggestion.scenarioId) {
      errors.push(`suggestedPatch.scenarioId ${suggestion.suggestedPatch.scenarioId} does not match suggestion scenarioId ${suggestion.scenarioId}.`);
    }
  } else {
    if (existingScenario) {
      warnings.push(`New-scenario candidate ${suggestion.scenarioId} already exists in the scenario dictionary.`);
    }
    validateNewScenarioSuggestion(suggestion, errors);
  }

  return { valid: errors.length === 0, errors, warnings, suggestion };
}

export async function generateScenarioSuggestion(input: GenerateScenarioSuggestionInput): Promise<GenerateScenarioSuggestionResult> {
  const analysis = await loadComparisonAnalysis(input.analysisPath);
  const artifactDir = input.artifactDir ?? dirname(dirname(input.analysisPath));
  const existingScenario = await loadOptionalScenario(analysis.candidateScenarioId, input.scenarioDictionaryPath);
  const observed = buildObservedEvidence(analysis);
  const evidenceComparison = buildEvidenceComparison(analysis);
  const base: BaseScenarioSuggestion = {
    version: 1,
    kind: "scenario-dictionary-suggestion",
    mode: existingScenario ? "existing-scenario-patch" : "new-scenario-candidate",
    scenarioId: analysis.candidateScenarioId,
    comparisonRunId: analysis.comparisonRunId,
    sourceAnalysisPath: input.analysisPath,
    generatedAt: new Date().toISOString(),
    observed,
    notes: ["Generated from comparison analysis artifacts; requires human review before updating scenario dictionary SOT."],
  };

  const suggestion: ScenarioDictionarySuggestion = existingScenario
    ? {
        ...base,
        mode: "existing-scenario-patch",
        suggestedPatch: {
          scenarioId: existingScenario.id,
          appendEvidenceComparison: evidenceComparison,
        },
      }
    : {
        ...base,
        mode: "new-scenario-candidate",
        suggestedScenario: {
          id: analysis.candidateScenarioId,
          feature: analysis.candidateScenarioId,
          description: `Candidate scenario generated from ${analysis.comparisonRunId}`,
          type: "read-only",
          page: {
            oldPath: observed.page.oldPath ?? "",
            newPath: observed.page.newPath ?? "",
          },
          browserApiAllowlist: {
            old: chooseBrowserApiAllowlist(analysis.targets.old),
            new: chooseBrowserApiAllowlist(analysis.targets.new),
          },
          upstreamApiCandidates: {
            old: chooseUpstreamCandidates(analysis.targets.old),
            new: chooseUpstreamCandidates(analysis.targets.new),
          },
          evidence: { comparisons: [evidenceComparison] },
        },
      };

  const suggestionPath = await writeScenarioSuggestion(artifactDir, suggestion);
  return { suggestion, suggestionPath };
}

async function loadScenarioSuggestion(path: string, errors: string[]): Promise<ScenarioDictionarySuggestion | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to read scenario suggestion ${path}: ${message}`);
    return undefined;
  }
  if (!isScenarioDictionarySuggestion(parsed)) {
    errors.push(`Invalid scenario suggestion artifact: ${path}`);
    return undefined;
  }
  return parsed;
}

async function loadComparisonAnalysisForValidation(path: string, errors: string[]): Promise<ComparisonAnalysisArtifact | undefined> {
  try {
    return await loadComparisonAnalysis(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    return undefined;
  }
}

async function loadComparisonAnalysis(path: string): Promise<ComparisonAnalysisArtifact> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScenarioSuggestionError(`Failed to read comparison analysis ${path}: ${message}`);
  }
  if (!isComparisonAnalysisArtifact(parsed)) {
    throw new ScenarioSuggestionError(`Invalid comparison analysis artifact: ${path}`);
  }
  return parsed;
}

function isScenarioDictionarySuggestion(value: unknown): value is ScenarioDictionarySuggestion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScenarioDictionarySuggestion>;
  if (candidate.version !== 1 || candidate.kind !== "scenario-dictionary-suggestion") return false;
  if (candidate.mode !== "existing-scenario-patch" && candidate.mode !== "new-scenario-candidate") return false;
  if (typeof candidate.scenarioId !== "string" || typeof candidate.comparisonRunId !== "string") return false;
  if (typeof candidate.sourceAnalysisPath !== "string") return false;
  if (candidate.mode === "existing-scenario-patch") return Boolean((candidate as Partial<ExistingScenarioPatchSuggestion>).suggestedPatch);
  return Boolean((candidate as Partial<NewScenarioCandidateSuggestion>).suggestedScenario);
}

function validateEvidenceComparisonTargets(
  suggestion: ScenarioDictionarySuggestion,
  analysis: ComparisonAnalysisArtifact,
  errors: string[],
): void {
  const evidence = suggestion.mode === "existing-scenario-patch"
    ? suggestion.suggestedPatch.appendEvidenceComparison
    : suggestion.suggestedScenario.evidence.comparisons[0];
  if (!evidence) {
    errors.push("Suggestion must include an evidence comparison.");
    return;
  }
  if (evidence.comparisonRunId !== analysis.comparisonRunId) {
    errors.push(`Evidence comparison ${evidence.comparisonRunId} does not match source analysis ${analysis.comparisonRunId}.`);
  }
  for (const side of ["old", "new"] as const) {
    const target = Object.values(analysis.targets).find((item) => item.side === side);
    const suggestedRunId = evidence.targets[side];
    if (!target) {
      errors.push(`Source analysis is missing ${side} target.`);
    } else if (suggestedRunId !== target.runId) {
      errors.push(`Evidence comparison ${side} run ${suggestedRunId ?? "(missing)"} does not match analysis run ${target.runId}.`);
    }
  }
}

function validateNewScenarioSuggestion(suggestion: NewScenarioCandidateSuggestion, errors: string[]): void {
  if (!suggestion.suggestedScenario.page.oldPath) errors.push("New scenario candidate must include page.oldPath.");
  if (!suggestion.suggestedScenario.page.newPath) errors.push("New scenario candidate must include page.newPath.");
  for (const side of ["old", "new"] as const) {
    if (suggestion.suggestedScenario.upstreamApiCandidates[side].length === 0) {
      errors.push(`New scenario candidate must include at least one ${side} upstream API candidate.`);
    }
    for (const backgroundPath of suggestion.observed.backgroundCandidates.upstream[side]) {
      if (suggestion.suggestedScenario.upstreamApiCandidates[side].includes(backgroundPath)) {
        errors.push(`New scenario ${side} upstream candidate ${backgroundPath} is also a background candidate.`);
      }
    }
  }
}

function isComparisonAnalysisArtifact(value: unknown): value is ComparisonAnalysisArtifact {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { version?: unknown }).version === 1 &&
      (value as { kind?: unknown }).kind === "api-behavior-comparison-analysis" &&
      typeof (value as { comparisonRunId?: unknown }).comparisonRunId === "string" &&
      typeof (value as { candidateScenarioId?: unknown }).candidateScenarioId === "string" &&
      typeof (value as { targets?: unknown }).targets === "object",
  );
}

function buildObservedEvidence(analysis: ComparisonAnalysisArtifact): ObservedScenarioEvidence {
  return {
    page: {
      ...(analysis.targets.old?.page?.path ? { oldPath: analysis.targets.old.page.path } : {}),
      ...(analysis.targets.new?.page?.path ? { newPath: analysis.targets.new.page.path } : {}),
    },
    candidateMatches: {
      upstream: {
        old: matchingPaths(analysis.targets.old?.upstream.endpointSummary ?? [], "matches-known-upstream-candidate"),
        new: matchingPaths(analysis.targets.new?.upstream.endpointSummary ?? [], "matches-known-upstream-candidate"),
      },
      browserVisible: {
        old: matchingPaths(analysis.targets.old?.browserVisible.endpointSummary ?? [], "matches-known-browser-api"),
        new: matchingPaths(analysis.targets.new?.browserVisible.endpointSummary ?? [], "matches-known-browser-api"),
      },
    },
    possibleAdditionalUpstream: {
      old: possibleAdditionalUpstreamPaths(analysis.targets.old?.upstream.endpointSummary ?? []),
      new: possibleAdditionalUpstreamPaths(analysis.targets.new?.upstream.endpointSummary ?? []),
    },
    backgroundCandidates: {
      upstream: {
        old: matchingPaths(analysis.targets.old?.upstream.endpointSummary ?? [], "high-frequency-background-candidate"),
        new: matchingPaths(analysis.targets.new?.upstream.endpointSummary ?? [], "high-frequency-background-candidate"),
      },
    },
  };
}

function buildEvidenceComparison(analysis: ComparisonAnalysisArtifact): EvidenceComparisonSuggestion {
  return {
    comparisonRunId: analysis.comparisonRunId,
    targets: Object.fromEntries(
      Object.values(analysis.targets).map((target) => [target.side, target.runId]),
    ) as Partial<Record<ApiSide, string>>,
  };
}

function chooseBrowserApiAllowlist(target: ComparisonTargetAnalysis | undefined): string[] {
  if (!target) return [];
  return target.browserVisible.endpointSummary.map((endpoint) => endpoint.path);
}

function chooseUpstreamCandidates(target: ComparisonTargetAnalysis | undefined): string[] {
  if (!target) return [];
  return target.upstream.endpointSummary
    .filter((endpoint) => !endpoint.classificationHints.includes("high-frequency-background-candidate"))
    .map((endpoint) => endpoint.path);
}

function matchingPaths(endpoints: EndpointAnalysisSummary[], hint: string): string[] {
  return endpoints.filter((endpoint) => endpoint.classificationHints.includes(hint)).map((endpoint) => endpoint.path);
}

function possibleAdditionalUpstreamPaths(endpoints: EndpointAnalysisSummary[]): string[] {
  return endpoints
    .filter((endpoint) => endpoint.classificationHints.length === 0)
    .map((endpoint) => endpoint.path);
}

async function writeScenarioSuggestion(rootDir: string, suggestion: ScenarioDictionarySuggestion): Promise<string> {
  const path = join(rootDir, "candidates", `${safeFilePart(suggestion.scenarioId)}-${safeFilePart(suggestion.comparisonRunId)}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(suggestion, null, 2)}\n`, "utf8");
  return path;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
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
