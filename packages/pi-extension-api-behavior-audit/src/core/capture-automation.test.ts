import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runAutomatedCapture } from "./capture-automation.ts";
import { CaptureSessionRegistry } from "./capture-lifecycle.ts";
import type { TargetCapturePlan, TargetRecorderHandle } from "../adapters/target-capture.ts";

const plan: TargetCapturePlan = {
  artifactDir: "/workspace/.pi-api-audit-runs",
  profileName: "uat",
  scenarioId: "account-activity-basic",
  feature: "Account activity",
  description: "Account activity smoke",
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

test("runAutomatedCapture passes capture metadata to automation and stops recorders after success", async () => {
  const events: string[] = [];
  const registry = new CaptureSessionRegistry({ createSessionId: () => "capture-auto" });

  const result = await runAutomatedCapture(
    await testPlan(),
    {
      automationScript: "/workspace/.pi-api-audit-runs/probe.mjs",
      headless: true,
      openBrowser: false,
      maxDurationMs: 1000,
    },
    {
      registry,
      startRecorder: async (target) => fakeRecorder(target.targetId, target.recorderUrl, 1, events),
      runScript: async ({ scriptPath, metadata, headless, signal }) => {
        events.push(`script:${scriptPath}:${headless}:${signal.aborted}`);
        assert.equal(metadata.captureSessionId, "capture-auto");
        assert.deepEqual(metadata.targets.map((target) => target.targetId), ["old", "new"]);
        assert.deepEqual(metadata.targets.map((target) => target.proxyUrl), ["http://127.0.0.1:18080", "http://127.0.0.1:18081"]);
        return { status: "succeeded", exitCode: 0, stdout: "ok", stderr: "" };
      },
    },
  );

  assert.deepEqual(events, ["script:/workspace/.pi-api-audit-runs/probe.mjs:true:false", "stop:old", "stop:new"]);
  assert.equal(result.capture.status, "stopped");
  assert.equal(result.automation.status, "succeeded");
  assert.equal(result.automation.stdout, "ok");
});

test("runAutomatedCapture stops and returns automation failure details when script fails", async () => {
  const events: string[] = [];
  const registry = new CaptureSessionRegistry({ createSessionId: () => "capture-fail" });

  const result = await runAutomatedCapture(
    await testPlan(),
    { automationScript: "/workspace/fail.mjs", openBrowser: false, maxDurationMs: 1000 },
    {
      registry,
      startRecorder: async (target) => fakeRecorder(target.targetId, target.recorderUrl, 1, events),
      runScript: async () => {
        throw new Error("script failed");
      },
    },
  );

  assert.deepEqual(events, ["stop:old", "stop:new"]);
  assert.equal(result.capture.status, "stopped");
  assert.equal(result.automation.status, "failed");
  assert.match(result.automation.error ?? "", /script failed/);
});

test("runAutomatedCapture times out automation and still stops recorders", async () => {
  const events: string[] = [];
  const registry = new CaptureSessionRegistry({ createSessionId: () => "capture-timeout" });

  const result = await runAutomatedCapture(
    await testPlan(),
    { automationScript: "/workspace/hang.mjs", openBrowser: false, maxDurationMs: 1 },
    {
      registry,
      startRecorder: async (target) => fakeRecorder(target.targetId, target.recorderUrl, 1, events),
      runScript: async ({ signal }) => {
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        return { status: "succeeded", exitCode: 0, stdout: "late", stderr: "" };
      },
    },
  );

  assert.deepEqual(events, ["stop:old", "stop:new"]);
  assert.equal(result.capture.status, "stopped");
  assert.equal(result.automation.status, "timed-out");
  assert.match(result.automation.error ?? "", /timed out after 1ms/);
});

test("runAutomatedCapture rejects browserless runs without an automation script", async () => {
  const registry = new CaptureSessionRegistry({ createSessionId: () => "capture-invalid" });

  await assert.rejects(
    async () => runAutomatedCapture(await testPlan(), { openBrowser: false }, { registry }),
    /automationScript is required/,
  );
  assert.deepEqual(registry.listActive(), []);
});

async function testPlan(): Promise<TargetCapturePlan> {
  return { ...plan, artifactDir: await mkdtemp(join(tmpdir(), "api-audit-automation-test-")) };
}

function fakeRecorder(targetId: string, listenUrl: string, exchangeCount: number, events: string[]): TargetRecorderHandle {
  return {
    runId: `${targetId}-run`,
    listenUrl,
    manifestPath: `/runs/${targetId}-run/manifest.json`,
    exchangesPath: `/runs/${targetId}-run/exchanges.ndjson`,
    exchangeCount,
    stop: async () => {
      events.push(`stop:${targetId}`);
    },
  };
}
