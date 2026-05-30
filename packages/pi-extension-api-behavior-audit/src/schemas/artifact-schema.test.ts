import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { appendExchange, writeManifest } from "../adapters/artifacts.ts";
import {
  ArtifactSchemaError,
  loadApiExchanges,
  loadCaptureManifest,
  loadComparisonRun,
  loadValidatedRun,
  validateApiExchange,
  validateCaptureManifest,
  validateComparisonRun,
} from "./artifact-schema.ts";
import type { ApiExchange, CaptureManifest, ComparisonRunArtifact } from "../types.ts";

const validManifest: CaptureManifest = {
  runId: "run-1",
  createdAt: "2026-05-25T00:00:00.000Z",
  artifactVersion: 1,
  redaction: { marker: "[REDACTED]", policy: "default-v1" },
  scenarios: ["account-activity-basic"],
  layer: "upstream",
  exchangeCount: 1,
};

const validComparisonRun: ComparisonRunArtifact = {
  version: 1,
  kind: "api-behavior-comparison-run",
  comparisonRunId: "comparison-run-1",
  candidateScenarioId: "account-activity-basic",
  discoverySessionId: "discovery-1",
  createdAt: "2026-05-25T00:00:00.000Z",
  targets: {
    old: {
      targetId: "old",
      side: "old",
      variant: "old",
      runId: "old-run",
      manifestPath: ".pi-api-audit-runs/old-run/manifest.json",
    },
    new: {
      targetId: "new",
      side: "new",
      variant: "new",
      runId: "new-run",
      manifestPath: ".pi-api-audit-runs/new-run/manifest.json",
    },
  },
};

const validExchange: ApiExchange = {
  runId: "run-1",
  layer: "upstream",
  side: "old",
  scenarioId: "account-activity-basic",
  request: {
    method: "GET",
    url: "http://127.0.0.1:18080/v1/account/activity?token=%5BREDACTED%5D",
    headers: {},
    body: null,
  },
  response: {
    status: 200,
    headers: {},
    body: { Items: null, Others: null, Pager: {} },
  },
  timing: {
    startedAt: "2026-05-25T00:00:00.000Z",
    durationMs: 12,
  },
  provenance: {
    source: "recording-proxy",
  },
};

test("validateCaptureManifest, validateApiExchange, and validateComparisonRun accept v1 artifacts", async () => {
  assert.deepEqual(await validateCaptureManifest(validManifest), validManifest);
  assert.deepEqual(await validateApiExchange(validExchange), validExchange);
  assert.deepEqual(await validateComparisonRun(validComparisonRun), validComparisonRun);
});

test("validateCaptureManifest and validateApiExchange accept target metadata", async () => {
  const manifest: CaptureManifest = {
    ...validManifest,
    recordingProxy: {
      side: "new",
      listenUrl: "http://127.0.0.1:18081",
      targetBaseUrl: "http://127.0.0.1:19081",
      scenarioId: "account-activity-basic",
      targetId: "candidate",
      variant: "candidate",
    },
  };
  const exchange: ApiExchange = {
    ...validExchange,
    side: "new",
    targetId: "candidate",
    variant: "candidate",
  };

  assert.deepEqual(await validateCaptureManifest(manifest), manifest);
  assert.deepEqual(await validateApiExchange(exchange), exchange);
});

test("validators reject unsupported versions and missing required exchange fields", async () => {
  await assert.rejects(
    () => validateCaptureManifest({ ...validManifest, artifactVersion: 2 }),
    /artifactVersion/,
  );
  await assert.rejects(
    () => validateComparisonRun({ ...validComparisonRun, version: 2 }),
    /version/,
  );
  await assert.rejects(
    () => validateApiExchange({ ...validExchange, request: { ...validExchange.request, url: undefined } }),
    /request\.url/,
  );
});

test("writeManifest and appendExchange validate before writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-schema-write-"));
  const paths = await writeManifest(root, validManifest);
  await appendExchange(root, validExchange);

  const comparisonPath = join(root, "comparison.json");
  await writeFile(comparisonPath, `${JSON.stringify(validComparisonRun, null, 2)}\n`, "utf8");
  const loadedManifest = await loadCaptureManifest(paths.manifestPath);
  const loadedComparison = await loadComparisonRun(comparisonPath);
  const loadedExchanges = await loadApiExchanges(paths.exchangesPath);
  assert.equal(loadedManifest.runId, "run-1");
  assert.equal(loadedComparison.comparisonRunId, "comparison-run-1");
  assert.equal(loadedExchanges.length, 1);

  await assert.rejects(
    () => writeManifest(root, { ...validManifest, scenarios: [] }),
    /scenarios/,
  );
});

test("loadValidatedRun verifies manifest exchangeCount against exchanges.ndjson line count", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-schema-run-"));
  const paths = await writeManifest(root, validManifest);
  await appendExchange(root, validExchange);

  const run = await loadValidatedRun(paths.runDir, { verifyExchangeCount: true });
  assert.equal(run.manifest.runId, "run-1");
  assert.equal(run.exchanges.length, 1);

  await writeFile(paths.manifestPath, `${JSON.stringify({ ...validManifest, exchangeCount: 2 }, null, 2)}\n`, "utf8");
  await assert.rejects(
    () => loadValidatedRun(paths.runDir, { verifyExchangeCount: true }),
    /exchangeCount/,
  );
});

test("loadApiExchanges reports invalid ndjson line numbers", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-schema-ndjson-"));
  const path = join(root, "exchanges.ndjson");
  await writeFile(path, `${JSON.stringify(validExchange)}\n{}\n`, "utf8");

  await assert.rejects(() => loadApiExchanges(path), (error) => {
    assert.ok(error instanceof ArtifactSchemaError);
    assert.match(error.message, /line 2/);
    return true;
  });
});
