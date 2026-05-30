import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { appendExchange, createComparisonRunId, createRunId, getComparisonRunPath, getRunPaths, writeComparisonRun, writeManifest } from "./artifacts.ts";
import type { ApiExchange, CaptureManifest, ComparisonRunArtifact } from "../types.ts";

test("createRunId creates a filesystem-safe timestamp id", () => {
  const runId = createRunId(new Date("2026-05-24T12:34:56.789Z"));

  assert.equal(runId, "2026-05-24T12-34-56-789Z");
});

test("createComparisonRunId creates a prefixed filesystem-safe id", () => {
  const comparisonRunId = createComparisonRunId(new Date("2026-05-24T12:34:56.789Z"));

  assert.equal(comparisonRunId, "comparison-2026-05-24T12-34-56-789Z");
});

test("writeComparisonRun creates a deterministic comparison grouping artifact", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "api-audit-comparison-"));
  const comparison: ComparisonRunArtifact = {
    version: 1,
    kind: "api-behavior-comparison-run",
    comparisonRunId: "comparison-1",
    candidateScenarioId: "forward-game-transfer",
    discoverySessionId: "discovery-1",
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:01:00.000Z",
    targets: {
      old: {
        targetId: "old",
        side: "old",
        variant: "old",
        runId: "old-run",
        manifestPath: ".pi-api-audit-runs/old-run/manifest.json",
        exchangesPath: ".pi-api-audit-runs/old-run/exchanges.ndjson",
        browserContext: {
          page: {
            url: "http://localhost:8080/account/activity",
            path: "/account/activity",
            source: "playwright-page-url",
          },
          browserVisibleRequests: [
            {
              method: "GET",
              url: "http://localhost:8080/apis/account/activity",
              path: "/apis/account/activity",
              status: 200,
              source: "playwright-response",
            },
          ],
        },
      },
      new: {
        targetId: "new",
        side: "new",
        variant: "new",
        runId: "new-run",
        manifestPath: ".pi-api-audit-runs/new-run/manifest.json",
        exchangesPath: ".pi-api-audit-runs/new-run/exchanges.ndjson",
      },
    },
  };

  const path = await writeComparisonRun(rootDir, comparison);
  const raw = await readFile(path, "utf8");

  assert.equal(path, getComparisonRunPath(rootDir, "comparison-1"));
  assert.equal(raw, `${JSON.stringify(comparison, null, 2)}\n`);
});

test("writeManifest and appendExchange create deterministic run artifacts", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "api-audit-artifacts-"));
  const runId = "run-1";
  const manifest: CaptureManifest = {
    runId,
    createdAt: "2026-05-24T00:00:00.000Z",
    artifactVersion: 1,
    redaction: { marker: "[REDACTED]", policy: "default-v1" },
    scenarios: ["account-activity-basic"],
  };
  const exchange: ApiExchange = {
    runId,
    layer: "browser-visible",
    side: "new",
    scenarioId: "account-activity-basic",
    request: {
      method: "GET",
      url: "http://localhost:8008/gateway/apis/account/activity?page=1",
      headers: { accept: "application/json" },
      body: null,
    },
    response: {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { items: [] },
    },
    timing: { startedAt: "2026-05-24T00:00:00.000Z", durationMs: 5 },
    provenance: { source: "playwright", pageUrl: "http://localhost:8008/account/activity" },
  };

  await writeManifest(rootDir, manifest);
  await appendExchange(rootDir, exchange);
  await appendExchange(rootDir, { ...exchange, side: "old" });

  const paths = getRunPaths(rootDir, runId);
  const manifestRaw = await readFile(paths.manifestPath, "utf8");
  const exchangesRaw = await readFile(paths.exchangesPath, "utf8");

  assert.equal(manifestRaw, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.equal(
    exchangesRaw,
    `${JSON.stringify(exchange)}\n${JSON.stringify({ ...exchange, side: "old" })}\n`,
  );
});
