import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("review viewer includes candidate suggestions before SOT evidence is accepted", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-review-viewer-"));
  const runsDir = join(root, ".pi-api-audit-runs");
  const candidatesDir = join(runsDir, "candidates");
  const analysisDir = join(runsDir, "analysis");
  await mkdir(candidatesDir, { recursive: true });
  await mkdir(analysisDir, { recursive: true });

  const sotPath = join(runsDir, "scenarios.local.json");
  const analysisPath = join(analysisDir, "comparison-review-only.json");
  const reviewOutput = join(runsDir, "review.html");
  const reportOutput = join(runsDir, "index.html");

  await writeFile(
    sotPath,
    JSON.stringify({
      version: 1,
      scenarios: [
        {
          id: "transaction-history",
          feature: "Transaction history",
          description: "交易流水",
          type: "read-only",
          page: { oldPath: "/transactions", newPath: "/transactions" },
          browserApiAllowlist: { old: [], new: [] },
          upstreamApiCandidates: { old: [], new: [] },
        },
      ],
    }),
    "utf8",
  );
  await writeFile(
    analysisPath,
    JSON.stringify({
      version: 1,
      kind: "api-behavior-comparison-analysis",
      comparisonRunId: "comparison-review-only",
      candidateScenarioId: "transaction-history",
      generatedAt: "2026-06-01T00:00:00.000Z",
      targets: {
        old: {
          targetId: "old",
          side: "old",
          runId: "old-run",
          upstream: { endpointSummary: [{ method: "GET", path: "/v1/transactions", count: 1, statuses: { 200: 1 }, classificationHints: [] }] },
          browserVisible: { endpointSummary: [] },
        },
        new: {
          targetId: "new",
          side: "new",
          runId: "new-run",
          upstream: { endpointSummary: [{ method: "GET", path: "/api/transactions", count: 1, statuses: { 200: 1 }, classificationHints: [] }] },
          browserVisible: { endpointSummary: [] },
        },
      },
    }),
    "utf8",
  );
  await writeFile(
    join(candidatesDir, "transaction-history-comparison-review-only.json"),
    JSON.stringify({
      version: 1,
      kind: "scenario-dictionary-suggestion",
      mode: "existing-scenario-patch",
      scenarioId: "transaction-history",
      comparisonRunId: "comparison-review-only",
      sourceAnalysisPath: analysisPath,
      generatedAt: "2026-06-01T00:00:00.000Z",
      observed: {
        page: { oldPath: "/transactions", newPath: "/transactions" },
        candidateMatches: { upstream: { old: [], new: [] }, browserVisible: { old: [], new: [] } },
        possibleAdditionalUpstream: { old: ["/v1/transactions"], new: ["/api/transactions"] },
        backgroundCandidates: { upstream: { old: [], new: [] } },
      },
      notes: ["Review-only candidate should appear before SOT evidence is accepted."],
      suggestedPatch: {
        scenarioId: "transaction-history",
        appendEvidenceComparison: { comparisonRunId: "comparison-review-only", targets: { old: "old-run", new: "new-run" } },
      },
    }),
    "utf8",
  );

  await execFileAsync("python3", [
    "tools/build-viewer.py",
    "--sot",
    sotPath,
    "--runs-dir",
    runsDir,
    "--report-output",
    reportOutput,
    "--review-output",
    reviewOutput,
  ]);

  const reviewHtml = await readFile(reviewOutput, "utf8");
  assert.match(reviewHtml, /Candidate endpoint curation/);
  assert.match(reviewHtml, /not an old\/new behavior diff/);
  assert.match(reviewHtml, /comparison-review-only/);
  assert.match(reviewHtml, /\/v1\/transactions/);
  assert.match(reviewHtml, /\/api\/transactions/);
});
