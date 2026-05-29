import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";

import { getEnvironmentProfileConfigPath } from "./environment-profiles.ts";
import {
  buildScenarioDiscoveryPreparation,
  formatPreparedScenarioDiscoverySessions,
  prepareScenarioDiscoverySession,
  resolveScenarioDiscoveryPlan,
  capturePreparedScenarioDiscoveryWindow,
  runPreparedScenarioDiscoverySession,
  runScenarioDiscovery,
  startBrowserVisibleApiCapture,
  stopPreparedScenarioDiscoverySession,
} from "./discovery.ts";

test("resolveScenarioDiscoveryPlan accepts candidate scenario ids not in dictionary", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    defaultProfile: "uat",
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
        oldProxyPort: 18080,
        newProxyPort: 18081,
      },
    },
  });

  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "forward-game+transfer",
    targetIds: ["new"],
    candidatePagePath: "/game/forward",
  });

  assert.equal(plan.candidateScenarioId, "forward-game+transfer");
  assert.equal(plan.profileName, "uat");
  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0].targetId, "new");
  assert.equal(plan.targets[0].frontendUrl, "http://localhost:8008");
  assert.equal(plan.targets[0].candidatePagePath, "/game/forward");
});

test("resolveScenarioDiscoveryPlan selects groups from target-based profiles", async () => {
  const artifactDir = await writeProfileConfig({
    version: 2,
    defaultProfile: "uat",
    profiles: {
      uat: {
        targets: {
          candidate: {
            variant: "candidate",
            side: "new",
            frontendUrl: "http://localhost:8008",
            upstreamTargetUrl: "http://127.0.0.1:19081",
            recorderPort: 18081,
          },
          experiment: {
            variant: "candidate",
            side: "new",
            frontendUrl: "http://localhost:8010",
            upstreamTargetUrl: "http://127.0.0.1:19082",
            recorderPort: 18082,
          },
        },
        groups: { "candidate-only": ["candidate", "experiment"] },
      },
    },
  });

  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "forward-game+transfer",
    groupName: "candidate-only",
  });

  assert.deepEqual(plan.targets.map((target) => target.targetId), ["candidate", "experiment"]);
  assert.deepEqual(plan.targets.map((target) => target.variant), ["candidate", "candidate"]);
});

test("buildScenarioDiscoveryPreparation warns that SOT is not modified", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "forward-game+transfer",
    targetIds: ["new"],
  });

  const text = buildScenarioDiscoveryPreparation(plan).join("\n");

  assert.match(text, /Manual-assisted scenario discovery/);
  assert.match(text, /forward-game\+transfer/);
  assert.match(text, /does not modify scenario dictionary/);
});

test("formatPreparedScenarioDiscoverySessions summarizes persistent sessions", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "scenario-discovery-session",
    targetIds: ["new"],
  });
  const session = await prepareScenarioDiscoverySession(plan, {
    startRecorder: async (target) => ({
      runId: `${target.targetId}-run`,
      listenUrl: target.recorderUrl,
      manifestPath: `${target.targetId}/manifest.json`,
      exchangesPath: `${target.targetId}/exchanges.ndjson`,
      exchangeCount: 0,
      recording: false,
      stop: async () => undefined,
    }),
  });

  const text = formatPreparedScenarioDiscoverySessions([session]).join("\n");

  assert.match(text, /Active scenario discovery sessions/);
  assert.match(text, new RegExp(session.sessionId));
  assert.match(text, /new/);
  assert.match(text, /paused/);
});

test("stopPreparedScenarioDiscoverySession stops persistent discovery recorders", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "scenario-discovery-session",
    targetIds: ["new"],
  });
  const events: string[] = [];
  const session = await prepareScenarioDiscoverySession(plan, {
    startRecorder: async (target) => ({
      runId: `${target.targetId}-run`,
      listenUrl: target.recorderUrl,
      manifestPath: `${target.targetId}/manifest.json`,
      exchangesPath: `${target.targetId}/exchanges.ndjson`,
      exchangeCount: 0,
      stop: async () => {
        events.push(`stop:${target.targetId}`);
      },
    }),
  });

  await stopPreparedScenarioDiscoverySession(session);

  assert.deepEqual(events, ["stop:new"]);
});

test("capturePreparedScenarioDiscoveryWindow records a window without stopping persistent session", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "scenario-discovery-session",
    targetIds: ["new"],
  });
  const events: string[] = [];
  const session = await prepareScenarioDiscoverySession(plan, {
    startRecorder: async (target) => ({
      runId: `${target.targetId}-session`,
      listenUrl: target.recorderUrl,
      manifestPath: `${target.targetId}/session-manifest.json`,
      exchangesPath: `${target.targetId}/session-exchanges.ndjson`,
      exchangeCount: 0,
      beginRecordingWindow: async (options) => {
        events.push(`begin:${options.scenarioId}`);
        return {
          runId: `${target.targetId}-${options.scenarioId}`,
          manifestPath: `${target.targetId}/${options.scenarioId}/manifest.json`,
          exchangesPath: `${target.targetId}/${options.scenarioId}/exchanges.ndjson`,
          exchangeCount: 2,
          finish: async () => {
            events.push(`finish:${options.scenarioId}`);
          },
        };
      },
      stop: async () => {
        events.push(`stop:${target.targetId}`);
      },
    }),
  });

  const result = await capturePreparedScenarioDiscoveryWindow(
    session,
    { candidateScenarioId: "forward-game+transfer", candidatePagePath: "/game/forward" },
    { confirm: async () => true },
  );

  assert.deepEqual(events, ["begin:forward-game+transfer", "finish:forward-game+transfer"]);
  assert.equal(result.recorders.length, 1);
  assert.equal(result.recorders[0].recorder.runId, "new-forward-game+transfer");
});

test("capturePreparedScenarioDiscoveryWindow records browser-assisted targets sequentially", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "scenario-discovery-session",
    targetIds: ["old", "new"],
  });
  const events: string[] = [];
  const session = await prepareScenarioDiscoverySession(plan, {
    startRecorder: async (target) => ({
      runId: `${target.targetId}-session`,
      listenUrl: target.recorderUrl,
      manifestPath: `${target.targetId}/session-manifest.json`,
      exchangesPath: `${target.targetId}/session-exchanges.ndjson`,
      exchangeCount: 0,
      beginRecordingWindow: async (options) => {
        events.push(`begin:${target.targetId}:${options.scenarioId}`);
        return {
          runId: `${target.targetId}-${options.scenarioId}`,
          manifestPath: `${target.targetId}/${options.scenarioId}/manifest.json`,
          exchangesPath: `${target.targetId}/${options.scenarioId}/exchanges.ndjson`,
          exchangeCount: 1,
          finish: async () => {
            events.push(`finish:${target.targetId}:${options.scenarioId}`);
          },
        };
      },
      stop: async () => undefined,
    }),
  });

  await capturePreparedScenarioDiscoveryWindow(
    session,
    { candidateScenarioId: "account-activity-basic", browser: true },
    { confirm: async () => true },
    {
      captureBrowserPageContext: async (target) => {
        events.push(`browser:${target.targetId}`);
        return {
          url: `${target.frontendUrl}/account/activity`,
          path: "/account/activity",
          source: "playwright-page-url",
        };
      },
    },
  );

  assert.deepEqual(events, [
    "begin:old:account-activity-basic",
    "browser:old",
    "finish:old:account-activity-basic",
    "begin:new:account-activity-basic",
    "browser:new",
    "finish:new:account-activity-basic",
  ]);
});

test("capturePreparedScenarioDiscoveryWindow can attach browser-assisted page context", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "scenario-discovery-session",
    targetIds: ["new"],
  });
  const events: string[] = [];
  const session = await prepareScenarioDiscoverySession(plan, {
    startRecorder: async (target) => ({
      runId: `${target.targetId}-session`,
      listenUrl: target.recorderUrl,
      manifestPath: `${target.targetId}/session-manifest.json`,
      exchangesPath: `${target.targetId}/session-exchanges.ndjson`,
      exchangeCount: 0,
      beginRecordingWindow: async (options) => {
        let candidatePage: { url: string; path: string; source: string } | undefined;
        return {
          runId: `${target.targetId}-${options.scenarioId}`,
          manifestPath: `${target.targetId}/${options.scenarioId}/manifest.json`,
          exchangesPath: `${target.targetId}/${options.scenarioId}/exchanges.ndjson`,
          exchangeCount: 1,
          get candidatePage() {
            return candidatePage;
          },
          finish: async (metadata) => {
            candidatePage = metadata?.candidatePage;
            events.push(`finish:${metadata?.candidatePage?.path}`);
          },
        };
      },
      stop: async () => undefined,
    }),
  });

  const result = await capturePreparedScenarioDiscoveryWindow(
    session,
    { candidateScenarioId: "account-activity-basic", browser: true },
    { confirm: async () => true },
    {
      captureBrowserPageContext: async (target) => ({
        url: `${target.frontendUrl}/account/activity`,
        path: "/account/activity",
        source: "playwright-page-url",
      }),
    },
  );

  assert.deepEqual(events, ["finish:/account/activity"]);
  assert.equal(result.recorders[0].recorder.candidatePage?.path, "/account/activity");
});

test("startBrowserVisibleApiCapture records fetch and xhr responses only", () => {
  let responseHandler: ((response: unknown) => void) | undefined;
  const page = {
    on: (event: string, handler: (response: unknown) => void) => {
      assert.equal(event, "response");
      responseHandler = handler;
    },
    off: (event: string, handler: (response: unknown) => void) => {
      assert.equal(event, "response");
      assert.equal(handler, responseHandler);
      responseHandler = undefined;
    },
  };

  const capture = startBrowserVisibleApiCapture(page as never);
  responseHandler?.({
    request: () => ({ method: () => "GET", resourceType: () => "document" }),
    url: () => "http://localhost:8008/account/activity",
    status: () => 200,
  });
  responseHandler?.({
    request: () => ({ method: () => "POST", resourceType: () => "fetch" }),
    url: () => "http://localhost:8008/gateway/apis/account/activity?token=secret&safe=1",
    status: () => 200,
  });
  capture.stop();

  assert.equal(responseHandler, undefined);
  assert.deepEqual(capture.observations, [
    {
      method: "POST",
      url: "http://localhost:8008/gateway/apis/account/activity?token=%5BREDACTED%5D&safe=1",
      path: "/gateway/apis/account/activity?token=%5BREDACTED%5D&safe=1",
      status: 200,
      source: "playwright-response",
    },
  ]);
});

test("prepareScenarioDiscoverySession starts paused recorders and runPrepared arms them", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "forward-game+transfer",
    targetIds: ["new"],
  });
  const events: string[] = [];

  const session = await prepareScenarioDiscoverySession(plan, {
    startRecorder: async (target) => {
      events.push(`prepare:${target.targetId}`);
      let recording = false;
      return {
        runId: `${target.targetId}-run`,
        listenUrl: target.recorderUrl,
        manifestPath: `${target.targetId}/manifest.json`,
        exchangesPath: `${target.targetId}/exchanges.ndjson`,
        exchangeCount: 3,
        get recording() {
          return recording;
        },
        setRecording: async (next) => {
          recording = next;
          events.push(`recording:${target.targetId}:${next}`);
        },
        stop: async () => {
          events.push(`stop:${target.targetId}`);
        },
      };
    },
  });

  assert.match(session.sessionId, /^discovery-/);
  assert.equal(session.recorders[0].recorder.recording, false);

  const result = await runPreparedScenarioDiscoverySession(session, {
    confirm: async () => true,
  });

  assert.deepEqual(events, ["prepare:new", "recording:new:true", "stop:new"]);
  assert.equal(result.recorders.length, 1);
});

test("runScenarioDiscovery records selected targets until user confirms done", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://127.0.0.1:19080",
        newTargetUrl: "http://127.0.0.1:19081",
      },
    },
  });
  const plan = await resolveScenarioDiscoveryPlan({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "forward-game+transfer",
    targetIds: ["new"],
  });
  const events: string[] = [];

  const result = await runScenarioDiscovery(plan, {
    confirm: async (_message) => true,
    startRecorder: async (target, currentPlan) => {
      events.push(`start:${currentPlan.candidateScenarioId}:${target.targetId}`);
      return {
        runId: `${target.targetId}-run`,
        listenUrl: target.recorderUrl,
        manifestPath: `${target.targetId}/manifest.json`,
        exchangesPath: `${target.targetId}/exchanges.ndjson`,
        exchangeCount: 2,
        stop: async () => {
          events.push(`stop:${target.targetId}`);
        },
      };
    },
    runManualPageAction: async (target) => {
      events.push(`manual:${target.targetId}`);
    },
  });

  assert.deepEqual(events, ["start:forward-game+transfer:new", "manual:new", "stop:new"]);
  assert.equal(result.recorders.length, 1);
  assert.deepEqual(result.warnings, []);
});

async function writeProfileConfig(config: unknown): Promise<string> {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-discovery-profile-"));
  await mkdir(artifactDir, { recursive: true });
  await writeFile(getEnvironmentProfileConfigPath(artifactDir), JSON.stringify(config), "utf8");
  return artifactDir;
}
