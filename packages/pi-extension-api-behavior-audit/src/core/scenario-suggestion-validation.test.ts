import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateScenarioSuggestion, validateScenarioSuggestion } from "./scenario-suggestion.ts";
import type { ComparisonAnalysisArtifact } from "../types.ts";

function analysis(scenarioId = "account-activity-basic"): ComparisonAnalysisArtifact {
  return {
    version: 1,
    kind: "api-behavior-comparison-analysis",
    comparisonRunId: "comparison-validation-1",
    candidateScenarioId: scenarioId,
    generatedAt: "2026-05-26T00:00:00.000Z",
    targets: {
      old: {
        targetId: "old",
        side: "old",
        runId: "old-run",
        page: { url: "http://localhost:8080/account/activity", path: "/account/activity", source: "playwright-page-url" },
        upstream: {
          endpointSummary: [
            { method: "GET", path: "/v1/file-srv/domain", count: 40, statuses: { "200": 40 }, classificationHints: ["high-frequency-background-candidate"] },
            { method: "GET", path: "/v1/account/activity", count: 5, statuses: { "200": 5 }, classificationHints: ["matches-known-upstream-candidate"] },
          ],
        },
        browserVisible: { endpointSummary: [] },
      },
      new: {
        targetId: "new",
        side: "new",
        runId: "new-run",
        page: { url: "http://localhost:8008/account/activity", path: "/account/activity", source: "playwright-page-url" },
        upstream: {
          endpointSummary: [
            { method: "GET", path: "/apis/account/activity", count: 6, statuses: { "200": 6 }, classificationHints: ["matches-known-upstream-candidate"] },
          ],
        },
        browserVisible: { endpointSummary: [] },
      },
    },
  };
}

async function writeAnalysis(root: string, value: ComparisonAnalysisArtifact): Promise<string> {
  const analysisDir = join(root, "analysis");
  await mkdir(analysisDir, { recursive: true });
  const path = join(analysisDir, `${value.comparisonRunId}.json`);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

test("validateScenarioSuggestion accepts a generated existing-scenario patch", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-validate-suggestion-"));
  const analysisPath = await writeAnalysis(root, analysis());
  const scenarioDictionaryPath = await writeScenarioDictionary(root);
  const { suggestionPath } = await generateScenarioSuggestion({ analysisPath, artifactDir: root, scenarioDictionaryPath });

  const result = await validateScenarioSuggestion({ suggestionPath, scenarioDictionaryPath });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("human review")));
});

async function writeScenarioDictionary(root: string): Promise<string> {
  const scenarioDictionaryPath = join(root, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify({
    version: 1,
    scenarios: [
      {
        id: "account-activity-basic",
        feature: "Account activity",
        description: "查詢Account activity列表",
        type: "read-only",
        page: { oldPath: "/account/activity", newPath: "/account/activity" },
        browserApiAllowlist: { old: ["/apis/account/activity"], new: ["/gateway/apis/account/activity"] },
        upstreamApiCandidates: { old: ["/v1/account/activity"], new: ["/apis/account/activity"] },
      },
    ],
  }), "utf8");
  return scenarioDictionaryPath;
}

test("validateScenarioSuggestion rejects background candidates in new scenario upstream candidates", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-validate-background-"));
  const analysisPath = await writeAnalysis(root, analysis("new-flow"));
  const { suggestionPath } = await generateScenarioSuggestion({ analysisPath, artifactDir: root });
  const suggestion = JSON.parse(await readFile(suggestionPath, "utf8"));
  suggestion.suggestedScenario.upstreamApiCandidates.old.push("/v1/file-srv/domain");
  await writeFile(suggestionPath, `${JSON.stringify(suggestion, null, 2)}\n`, "utf8");

  const result = await validateScenarioSuggestion({ suggestionPath });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("background candidate") && error.includes("/v1/file-srv/domain")));
});

test("validateScenarioSuggestion rejects existing-scenario patches for missing scenarios", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-validate-missing-existing-"));
  const analysisPath = await writeAnalysis(root, analysis("new-flow"));
  const { suggestionPath } = await generateScenarioSuggestion({ analysisPath, artifactDir: root });
  const suggestion = JSON.parse(await readFile(suggestionPath, "utf8"));
  suggestion.mode = "existing-scenario-patch";
  suggestion.suggestedPatch = {
    scenarioId: "new-flow",
    appendEvidenceComparison: { comparisonRunId: "comparison-validation-1", targets: { old: "old-run", new: "new-run" } },
  };
  delete suggestion.suggestedScenario;
  await writeFile(suggestionPath, `${JSON.stringify(suggestion, null, 2)}\n`, "utf8");

  const result = await validateScenarioSuggestion({ suggestionPath });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("does not exist in the scenario dictionary")));
});
