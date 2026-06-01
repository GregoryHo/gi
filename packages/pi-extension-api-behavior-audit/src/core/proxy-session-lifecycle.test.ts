import assert from "node:assert/strict";
import { dirname } from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ProxySessionRegistry } from "./proxy-session-lifecycle.ts";
import type { RecordingWindowOptions } from "../adapters/recording-proxy.ts";
import type { TargetCapturePlan, TargetRecorderHandle } from "../adapters/target-capture.ts";

function makePlan(): TargetCapturePlan {
  return {
    profileName: "uat",
    scenarioId: "account-activity-basic",
    feature: "Account activity",
    description: "Account activity smoke",
    artifactDir: ".pi-api-audit-runs",
    targets: [
      {
        targetId: "old",
        variant: "old",
        side: "old",
        frontendUrl: "http://localhost:8080",
        upstreamTargetUrl: "http://127.0.0.1:19080",
        recorderPort: 18080,
        recorderUrl: "http://127.0.0.1:18080",
        allowHosts: [],
        pagePath: "/account/activity",
        browserApiAllowlist: ["/apis/account/activity"],
        upstreamApiCandidates: ["/v1/account/activity"],
      },
      {
        targetId: "new",
        variant: "new",
        side: "new",
        frontendUrl: "http://localhost:8008",
        upstreamTargetUrl: "http://127.0.0.1:19081",
        recorderPort: 18081,
        recorderUrl: "http://127.0.0.1:18081",
        allowHosts: [],
        pagePath: "/account/activity",
        browserApiAllowlist: ["/gateway/apis/account/activity"],
        upstreamApiCandidates: ["/apis/account/activity"],
      },
    ],
  };
}

test("ProxySessionRegistry finalizes recording windows without stopping persistent proxies", async () => {
  const events: string[] = [];
  let runCounter = 0;
  const registry = new ProxySessionRegistry({
    createProxySessionId: () => "proxy-session-1",
    createRecordingWindowId: () => `window-${runCounter + 1}`,
    createComparisonRunId: () => `comparison-${runCounter + 1}`,
    now: () => new Date("2026-06-01T00:00:00.000Z"),
  });

  const started = await registry.startProxySession(makePlan(), {
    startRecorder: async (target): Promise<TargetRecorderHandle> => ({
      runId: `bootstrap-${target.targetId}`,
      listenUrl: target.recorderUrl,
      manifestPath: `.pi-api-audit-runs/bootstrap-${target.targetId}/manifest.json`,
      exchangesPath: `.pi-api-audit-runs/bootstrap-${target.targetId}/exchanges.ndjson`,
      exchangeCount: 0,
      beginRecordingWindow: async (options: RecordingWindowOptions) => {
        runCounter += 1;
        const runId = `${target.targetId}-run-${runCounter}`;
        events.push(`begin:${target.targetId}:${options.comparisonRunId}`);
        return {
          runId,
          manifestPath: `.pi-api-audit-runs/${runId}/manifest.json`,
          exchangesPath: `.pi-api-audit-runs/${runId}/exchanges.ndjson`,
          exchangeCount: target.targetId === "old" ? 1 : 0,
          finish: async () => {
            events.push(`finish:${target.targetId}:${runId}`);
          },
        };
      },
      stop: async () => {
        events.push(`stop-proxy:${target.targetId}`);
      },
    } as TargetRecorderHandle),
  });

  assert.equal(started.proxySessionId, "proxy-session-1");
  assert.equal(started.status, "active");
  assert.equal(started.targets[0].proxyUrl, "http://127.0.0.1:18080");

  const window = await registry.startRecordingWindow("proxy-session-1");
  assert.equal(window.recordingWindowId, "window-1");
  assert.equal(window.status, "active");
  assert.equal(window.comparisonRunId, "comparison-1");
  assert.equal(window.targets[0].runDir, dirname(window.targets[0].manifestPath));

  const stoppedWindow = await registry.stopRecordingWindow("window-1");
  assert.equal(stoppedWindow.status, "stopped");
  assert.equal(stoppedWindow.comparisonPath, ".pi-api-audit-runs/comparisons/comparison-1.json");
  const comparison = JSON.parse(await readFile(stoppedWindow.comparisonPath, "utf8")) as {
    kind: string;
    comparisonRunId: string;
    candidateScenarioId: string;
    targets: Record<string, { runId: string; manifestPath: string; exchangesPath: string; side: string }>;
  };
  assert.equal(comparison.kind, "api-behavior-comparison-run");
  assert.equal(comparison.comparisonRunId, "comparison-1");
  assert.equal(comparison.candidateScenarioId, "account-activity-basic");
  assert.equal(comparison.targets.old.runId, "old-run-1");
  assert.equal(comparison.targets.new.runId, "new-run-2");
  assert.equal(comparison.targets.old.manifestPath, ".pi-api-audit-runs/old-run-1/manifest.json");
  assert.equal(comparison.targets.new.exchangesPath, ".pi-api-audit-runs/new-run-2/exchanges.ndjson");
  assert.deepEqual(stoppedWindow.warnings, ["No upstream exchanges were recorded for target new; confirm the app points to http://127.0.0.1:18081."]);
  assert.deepEqual(events, [
    "begin:old:comparison-1",
    "begin:new:comparison-1",
    "finish:old:old-run-1",
    "finish:new:new-run-2",
  ]);
  assert.deepEqual(registry.listProxySessions().map((session) => session.proxySessionId), ["proxy-session-1"]);

  const secondWindow = await registry.startRecordingWindow("proxy-session-1", { comparisonRunId: "comparison-manual" });
  assert.equal(secondWindow.comparisonRunId, "comparison-manual");
  await registry.stopProxySession("proxy-session-1");
  assert.equal(registry.listProxySessions()[0].status, "stopped");
  assert.deepEqual(events.slice(-2), ["stop-proxy:old", "stop-proxy:new"]);
});

test("ProxySessionRegistry rejects overlapping recording windows on one proxy session", async () => {
  const registry = new ProxySessionRegistry({
    createProxySessionId: () => "proxy-session-1",
    createRecordingWindowId: () => "window-1",
    createComparisonRunId: () => "comparison-1",
  });
  await registry.startProxySession(makePlan(), {
    startRecorder: async (target): Promise<TargetRecorderHandle> => ({
      runId: `bootstrap-${target.targetId}`,
      listenUrl: target.recorderUrl,
      manifestPath: `.pi-api-audit-runs/bootstrap-${target.targetId}/manifest.json`,
      exchangesPath: `.pi-api-audit-runs/bootstrap-${target.targetId}/exchanges.ndjson`,
      exchangeCount: 0,
      beginRecordingWindow: async () => ({
        runId: `${target.targetId}-run`,
        manifestPath: `.pi-api-audit-runs/${target.targetId}-run/manifest.json`,
        exchangesPath: `.pi-api-audit-runs/${target.targetId}-run/exchanges.ndjson`,
        exchangeCount: 1,
        finish: async () => {},
      }),
      stop: async () => {},
    } as TargetRecorderHandle),
  });

  await registry.startRecordingWindow("proxy-session-1");
  await assert.rejects(
    () => registry.startRecordingWindow("proxy-session-1"),
    /already has an active recording window/,
  );
});
