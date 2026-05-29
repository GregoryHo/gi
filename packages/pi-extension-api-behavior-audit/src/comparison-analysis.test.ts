import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { appendExchange, writeComparisonRun, writeManifest } from "./artifacts.ts";
import { analyzeComparisonRun } from "./comparison-analysis.ts";
import type { ApiExchange, CaptureManifest, ComparisonRunArtifact } from "./types.ts";

function manifest(runId: string, side: "old" | "new", comparisonRunId: string): CaptureManifest {
  return {
    runId,
    createdAt: "2026-05-26T00:00:00.000Z",
    artifactVersion: 1,
    redaction: { marker: "[REDACTED]", policy: "default-v1" },
    scenarios: ["account-activity-basic"],
    layer: "upstream",
    candidateScenarioId: "account-activity-basic",
    comparisonRunId,
    exchangeCount: 0,
    recordingProxy: {
      side,
      listenUrl: side === "old" ? "http://127.0.0.1:18080" : "http://127.0.0.1:18081",
      targetBaseUrl: side === "old" ? "http://old.example" : "http://new.example",
      scenarioId: "account-activity-basic",
      targetId: side,
      variant: side,
    },
  };
}

function exchange(runId: string, side: "old" | "new", url: string, status = 200, body: unknown = { Items: [], Others: {}, Pager: {} }): ApiExchange {
  return {
    runId,
    layer: "upstream",
    side,
    scenarioId: "account-activity-basic",
    request: { method: "GET", url, headers: {}, body: null },
    response: { status, headers: {}, body },
    timing: { startedAt: "2026-05-26T00:00:00.000Z", durationMs: 1 },
    provenance: { source: "recording-proxy" },
  };
}

test("analyzeComparisonRun writes deterministic endpoint summaries with classification hints", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-analysis-"));
  const comparisonRunId = "comparison-analysis-1";
  const oldRunId = "old-run";
  const newRunId = "new-run";

  const oldManifest = { ...manifest(oldRunId, "old", comparisonRunId), exchangeCount: 12 };
  const newManifest = { ...manifest(newRunId, "new", comparisonRunId), exchangeCount: 2 };
  const oldPaths = await writeManifest(root, oldManifest);
  const newPaths = await writeManifest(root, newManifest);
  await mkdir(oldPaths.runDir, { recursive: true });
  await mkdir(newPaths.runDir, { recursive: true });

  for (let index = 0; index < 10; index += 1) {
    await appendExchange(root, exchange(oldRunId, "old", "http://old.example/v1/file-srv/domain?cache=1", 200, { domain: "x" }));
  }
  await appendExchange(root, exchange(oldRunId, "old", "http://old.example/v1/account/activity?token=%5BREDACTED%5D"));
  await appendExchange(root, exchange(oldRunId, "old", "http://old.example/v1/account/activity?page=2"));
  await appendExchange(root, exchange(newRunId, "new", "https://new.example/apis/account/activity?pi=1"));
  await appendExchange(root, exchange(newRunId, "new", "https://new.example/apis/account/activity?pi=2", 500, { error: true }));

  const comparison: ComparisonRunArtifact = {
    version: 1,
    kind: "api-behavior-comparison-run",
    comparisonRunId,
    candidateScenarioId: "account-activity-basic",
    createdAt: "2026-05-26T00:00:00.000Z",
    targets: {
      old: {
        targetId: "old",
        side: "old",
        variant: "old",
        runId: oldRunId,
        manifestPath: oldPaths.manifestPath,
        exchangesPath: oldPaths.exchangesPath,
        browserContext: {
          page: { url: "http://localhost:8080/account/activity", path: "/account/activity", source: "playwright-page-url" },
          browserVisibleRequests: [
            { method: "GET", url: "http://localhost:8080/apis/account/activity?pi=1", path: "/apis/account/activity?pi=1", status: 200, source: "playwright-response" },
          ],
        },
      },
      new: {
        targetId: "new",
        side: "new",
        variant: "new",
        runId: newRunId,
        manifestPath: newPaths.manifestPath,
        exchangesPath: newPaths.exchangesPath,
        browserContext: {
          page: { url: "http://localhost:8008/account/activity", path: "/account/activity", source: "playwright-page-url" },
          browserVisibleRequests: [
            { method: "GET", url: "http://localhost:8008/gateway/apis/account/activity", path: "/gateway/apis/account/activity", status: 200, source: "playwright-response" },
          ],
        },
      },
    },
  };
  const comparisonPath = await writeComparisonRun(root, comparison);
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

  const result = await analyzeComparisonRun({ comparisonPath, artifactDir: root, scenarioDictionaryPath });
  const raw = await readFile(result.analysisPath, "utf8");
  const written = JSON.parse(raw);

  assert.equal(result.analysis.comparisonRunId, comparisonRunId);
  assert.equal(written.kind, "api-behavior-comparison-analysis");
  assert.equal(written.targets.old.page.path, "/account/activity");
  assert.deepEqual(written.targets.old.upstream.endpointSummary[0], {
    method: "GET",
    path: "/v1/file-srv/domain",
    count: 10,
    statuses: { "200": 10 },
    responseTopLevelKeys: ["domain"],
    classificationHints: ["high-frequency-background-candidate"],
  });
  assert.deepEqual(written.targets.old.upstream.endpointSummary[1].classificationHints, ["matches-known-upstream-candidate"]);
  assert.deepEqual(written.targets.old.browserVisible.endpointSummary[0].classificationHints, ["matches-known-browser-api"]);
  assert.deepEqual(written.targets.new.upstream.endpointSummary[0].statuses, { "200": 1, "500": 1 });
});
