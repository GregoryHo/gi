import assert from "node:assert/strict";
import test from "node:test";

import {
  CaptureSessionRegistry,
  type CaptureSessionSummary,
} from "./capture-lifecycle.ts";
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

test("CaptureSessionRegistry starts recorders without browser/page actions and returns old/new aliases", async () => {
  const events: string[] = [];
  const registry = new CaptureSessionRegistry({ createSessionId: () => "capture-fixed" });

  const started = await registry.start(plan, {
    startRecorder: async (target) => {
      events.push(`start:${target.targetId}`);
      return fakeRecorder(target.targetId, target.recorderUrl, 1, events);
    },
  });

  assert.deepEqual(events, ["start:old", "start:new"]);
  assert.equal(started.captureSessionId, "capture-fixed");
  assert.equal(started.status, "active");
  assert.equal(started.oldProxyUrl, "http://127.0.0.1:18080");
  assert.equal(started.newProxyUrl, "http://127.0.0.1:18081");
  assert.equal(started.oldRunDir, "/runs/old-run");
  assert.equal(started.newRunDir, "/runs/new-run");
  assert.deepEqual(started.targets.map((target) => target.targetId), ["old", "new"]);
  assert.deepEqual(registry.listActive().map((session) => session.captureSessionId), ["capture-fixed"]);
});

test("CaptureSessionRegistry stop finalizes each recorder and returns idempotent stopped summaries", async () => {
  const events: string[] = [];
  const registry = new CaptureSessionRegistry({ createSessionId: () => "capture-stop" });
  await registry.start(plan, {
    startRecorder: async (target) => fakeRecorder(target.targetId, target.recorderUrl, target.targetId === "old" ? 2 : 0, events),
  });

  const stopped = await registry.stop("capture-stop");
  const stoppedAgain = await registry.stop("capture-stop");

  assert.deepEqual(events, ["stop:old", "stop:new"]);
  assert.equal(stopped.status, "stopped");
  assert.deepEqual(stopped.targets.map((target) => target.exchangeCount), [2, 0]);
  assert.deepEqual(stopped.warnings, ["No upstream exchanges were recorded for target new; confirm the app points to http://127.0.0.1:18081."]);
  assert.deepEqual(stoppedAgain, stopped);
  assert.deepEqual(registry.listActive(), []);
});

test("CaptureSessionRegistry stopAll stops only active sessions", async () => {
  const events: string[] = [];
  let nextId = 1;
  const registry = new CaptureSessionRegistry({ createSessionId: () => `capture-${nextId++}` });
  const first = await registry.start(plan, { startRecorder: async (target) => fakeRecorder(`first-${target.targetId}`, target.recorderUrl, 1, events) });
  const second = await registry.start(plan, { startRecorder: async (target) => fakeRecorder(`second-${target.targetId}`, target.recorderUrl, 1, events) });
  await registry.stop(first.captureSessionId);

  const stopped = await registry.stopAllActive();

  assert.deepEqual(stopped.map((session: CaptureSessionSummary) => session.captureSessionId), [second.captureSessionId]);
  assert.deepEqual(events, ["stop:first-old", "stop:first-new", "stop:second-old", "stop:second-new"]);
}
);

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
