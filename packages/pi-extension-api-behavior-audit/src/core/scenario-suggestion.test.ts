import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateScenarioSuggestion } from "./scenario-suggestion.ts";
import type { ComparisonAnalysisArtifact } from "../types.ts";

function analysis(scenarioId: string): ComparisonAnalysisArtifact {
  return {
    version: 1,
    kind: "api-behavior-comparison-analysis",
    comparisonRunId: "comparison-1",
    candidateScenarioId: scenarioId,
    generatedAt: "2026-05-26T00:00:00.000Z",
    targets: {
      old: {
        targetId: "old",
        side: "old",
        variant: "old",
        runId: "old-run",
        page: { url: "http://localhost:8080/account/activity", path: "/account/activity", source: "playwright-page-url" },
        upstream: {
          endpointSummary: [
            { method: "GET", path: "/v1/file-srv/domain", count: 40, statuses: { "200": 40 }, classificationHints: ["high-frequency-background-candidate"] },
            { method: "GET", path: "/v1/account/activity", count: 5, statuses: { "200": 5 }, responseTopLevelKeys: ["Items", "Others", "Pager"], classificationHints: ["matches-known-upstream-candidate"] },
            { method: "GET", path: "/v1/account/summary", count: 1, statuses: { "200": 1 }, classificationHints: [] },
          ],
        },
        browserVisible: {
          endpointSummary: [
            { method: "GET", path: "/apis/account/activity", count: 5, statuses: { "200": 5 }, classificationHints: ["matches-known-browser-api"] },
          ],
        },
      },
      new: {
        targetId: "new",
        side: "new",
        variant: "new",
        runId: "new-run",
        page: { url: "http://localhost:8008/account/activity", path: "/account/activity", source: "playwright-page-url" },
        upstream: {
          endpointSummary: [
            { method: "GET", path: "/apis/account/activity", count: 6, statuses: { "200": 6 }, responseTopLevelKeys: ["Items", "Others", "Pager"], classificationHints: ["matches-known-upstream-candidate"] },
          ],
        },
        browserVisible: {
          endpointSummary: [
            { method: "GET", path: "/gateway/apis/account/activity", count: 6, statuses: { "200": 6 }, classificationHints: ["matches-known-browser-api"] },
          ],
        },
      },
    },
  };
}

test("generateScenarioSuggestion writes an existing-scenario patch suggestion", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-suggest-existing-"));
  const analysisPath = join(root, "analysis", "comparison-1.json");
  await mkdir(join(root, "analysis"), { recursive: true });
  await writeFile(analysisPath, `${JSON.stringify(analysis("account-activity-basic"), null, 2)}\n`, "utf8");

  const scenarioDictionaryPath = await writeScenarioDictionary(root);
  const result = await generateScenarioSuggestion({ analysisPath, artifactDir: root, scenarioDictionaryPath });
  const written = JSON.parse(await readFile(result.suggestionPath, "utf8"));

  assert.equal(written.kind, "scenario-dictionary-suggestion");
  assert.equal(written.mode, "existing-scenario-patch");
  assert.equal(written.scenarioId, "account-activity-basic");
  assert.equal(written.comparisonRunId, "comparison-1");
  assert.deepEqual(written.suggestedPatch.appendEvidenceComparison.targets, { old: "old-run", new: "new-run" });
  assert.deepEqual(written.observed.candidateMatches.upstream.old, ["/v1/account/activity"]);
  assert.deepEqual(written.observed.possibleAdditionalUpstream.old, ["/v1/account/summary"]);
  assert.deepEqual(written.observed.backgroundCandidates.upstream.old, ["/v1/file-srv/domain"]);
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

test("generateScenarioSuggestion writes a new scenario candidate when the id is not in the dictionary", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-suggest-new-"));
  const analysisPath = join(root, "analysis", "comparison-1.json");
  await mkdir(join(root, "analysis"), { recursive: true });
  await writeFile(analysisPath, `${JSON.stringify(analysis("forward-game-transfer"), null, 2)}\n`, "utf8");

  const result = await generateScenarioSuggestion({ analysisPath, artifactDir: root });
  const written = JSON.parse(await readFile(result.suggestionPath, "utf8"));

  assert.equal(written.mode, "new-scenario-candidate");
  assert.deepEqual(written.suggestedScenario.page, { oldPath: "/account/activity", newPath: "/account/activity" });
  assert.deepEqual(written.suggestedScenario.upstreamApiCandidates.old, ["/v1/account/activity", "/v1/account/summary"]);
  assert.deepEqual(written.suggestedScenario.browserApiAllowlist.new, ["/gateway/apis/account/activity"]);
  assert.match(written.notes[0], /requires human review/i);
});
