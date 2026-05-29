import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";

import { getEnvironmentProfileConfigPath } from "./environment-profiles.ts";
import {
  buildTargetCapturePreparation,
  resolveTargetCapturePlan,
  runTargetCapture,
} from "./target-capture.ts";

const scenarioDictionary = {
  version: 2,
  scenarios: [
    {
      id: "account-activity-basic",
      feature: "Account activity",
      description: "查詢Account activity列表",
      type: "read-only",
      variants: {
        baseline: {
          pagePath: "/account/activity",
          browserApiAllowlist: ["/apis/account/activity"],
          upstreamApiCandidates: ["/v1/account/activity"],
        },
        candidate: {
          pagePath: "/account/activity",
          browserApiAllowlist: ["/gateway/apis/account/activity"],
          upstreamApiCandidates: ["/apis/account/activity"],
        },
      },
    },
  ],
};

test("resolveTargetCapturePlan selects target groups from a version 2 profile", async () => {
  const artifactDir = await writeProfileConfig({
    version: 2,
    defaultProfile: "uat",
    profiles: {
      uat: {
        targets: {
          baseline: {
            variant: "baseline",
            frontendUrl: "http://localhost:8080",
            upstreamTargetUrl: "http://old-api.example.test",
            recorderPort: 18080,
            allowHosts: ["old-api.example.test"],
          },
          candidate: {
            variant: "candidate",
            frontendUrl: "http://localhost:8008",
            upstreamTargetUrl: "https://new-api.example.test",
            recorderPort: 18081,
            allowHosts: ["new-api.example.test"],
          },
          experiment: {
            variant: "candidate",
            frontendUrl: "http://localhost:8010",
            upstreamTargetUrl: "http://127.0.0.1:19082",
            recorderPort: 18082,
          },
        },
        groups: {
          default: ["baseline", "candidate"],
          all: ["baseline", "candidate", "experiment"],
          "candidate-only": ["candidate", "experiment"],
        },
      },
    },
  });
  const scenarioDictionaryPath = join(artifactDir, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify(scenarioDictionary), "utf8");

  const plan = await resolveTargetCapturePlan({
    artifactDir,
    scenarioDictionaryPath,
    scenarioId: "account-activity-basic",
    profileName: "uat",
    groupName: "candidate-only",
  });

  assert.equal(plan.profileName, "uat");
  assert.equal(plan.scenarioId, "account-activity-basic");
  assert.deepEqual(plan.targets.map((target) => target.targetId), ["candidate", "experiment"]);
  assert.deepEqual(plan.targets.map((target) => target.variant), ["candidate", "candidate"]);
  assert.deepEqual(plan.targets.map((target) => target.recorderPort), [18081, 18082]);
  assert.equal(plan.targets[0].pagePath, "/account/activity");
  assert.deepEqual(plan.targets[0].upstreamApiCandidates, ["/apis/account/activity"]);
});

test("resolveTargetCapturePlan supports explicit target selection and one target capture", async () => {
  const artifactDir = await writeProfileConfig({
    version: 2,
    profiles: {
      local: {
        targets: {
          candidate: {
            variant: "candidate",
            frontendUrl: "http://localhost:8008",
            upstreamTargetUrl: "http://127.0.0.1:19081",
            recorderPort: 18081,
          },
        },
      },
    },
  });
  const scenarioDictionaryPath = join(artifactDir, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify(scenarioDictionary), "utf8");

  const plan = await resolveTargetCapturePlan({
    artifactDir,
    scenarioDictionaryPath,
    scenarioId: "account-activity-basic",
    profileName: "local",
    targetIds: ["candidate"],
  });

  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0].targetId, "candidate");
});

test("resolveTargetCapturePlan maps version 1 old/new profile and scenario for compatibility", async () => {
  const artifactDir = await writeProfileConfig({
    version: 1,
    defaultProfile: "uat",
    profiles: {
      uat: {
        oldUrl: "http://localhost:8080",
        newUrl: "http://localhost:8008",
        oldTargetUrl: "http://old-api.example.test",
        newTargetUrl: "https://new-api.example.test",
        oldProxyPort: 18080,
        newProxyPort: 18081,
        allowHosts: ["old-api.example.test", "new-api.example.test"],
      },
    },
  });

  const scenarioDictionaryPath = join(artifactDir, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify(versionOneScenarioDictionary()), "utf8");

  const plan = await resolveTargetCapturePlan({
    artifactDir,
    scenarioDictionaryPath,
    scenarioId: "account-activity-basic",
    profileName: "uat",
  });

  assert.deepEqual(plan.targets.map((target) => target.targetId), ["old", "new"]);
  assert.deepEqual(plan.targets.map((target) => target.variant), ["old", "new"]);
  assert.deepEqual(plan.targets.map((target) => target.pagePath), ["/account/activity", "/account/activity"]);
});

test("runTargetCapture starts selected target recorders, runs page actions, and stops recorders", async () => {
  const artifactDir = await writeProfileConfig({
    version: 2,
    profiles: {
      uat: {
        targets: {
          baseline: {
            variant: "baseline",
            frontendUrl: "http://localhost:8080",
            upstreamTargetUrl: "http://127.0.0.1:19080",
            recorderPort: 18080,
          },
          candidate: {
            variant: "candidate",
            frontendUrl: "http://localhost:8008",
            upstreamTargetUrl: "http://127.0.0.1:19081",
            recorderPort: 18081,
          },
          experiment: {
            variant: "candidate",
            frontendUrl: "http://localhost:8010",
            upstreamTargetUrl: "http://127.0.0.1:19082",
            recorderPort: 18082,
          },
        },
        groups: { all: ["baseline", "candidate", "experiment"] },
      },
    },
  });
  const scenarioDictionaryPath = join(artifactDir, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify(scenarioDictionary), "utf8");
  const plan = await resolveTargetCapturePlan({
    artifactDir,
    scenarioDictionaryPath,
    scenarioId: "account-activity-basic",
    profileName: "uat",
    groupName: "all",
  });
  const events: string[] = [];

  const result = await runTargetCapture(plan, {
    confirm: async () => true,
    startRecorder: async (target) => {
      events.push(`start:${target.targetId}`);
      return {
        runId: `${target.targetId}-run`,
        listenUrl: target.recorderUrl,
        manifestPath: `${target.targetId}/manifest.json`,
        exchangesPath: `${target.targetId}/exchanges.ndjson`,
        exchangeCount: target.targetId === "experiment" ? 0 : 1,
        stop: async () => {
          events.push(`stop:${target.targetId}`);
        },
      };
    },
    runTargetPageAction: async (target) => {
      events.push(`page:${target.targetId}:${target.pagePath}`);
    },
  });

  assert.deepEqual(events, [
    "start:baseline",
    "start:candidate",
    "start:experiment",
    "page:baseline:/account/activity",
    "page:candidate:/account/activity",
    "page:experiment:/account/activity",
    "stop:baseline",
    "stop:candidate",
    "stop:experiment",
  ]);
  assert.equal(result.recorders.length, 3);
  assert.deepEqual(result.warnings, ["No upstream exchanges were recorded for target experiment; confirm the app points to http://127.0.0.1:18082."]);
});

test("runTargetCapture stops recorders when page action fails", async () => {
  const artifactDir = await writeProfileConfig({
    version: 2,
    profiles: {
      uat: {
        targets: {
          baseline: {
            variant: "baseline",
            frontendUrl: "http://localhost:8080",
            upstreamTargetUrl: "http://127.0.0.1:19080",
            recorderPort: 18080,
          },
        },
      },
    },
  });
  const scenarioDictionaryPath = join(artifactDir, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify(scenarioDictionary), "utf8");
  const plan = await resolveTargetCapturePlan({ artifactDir, scenarioDictionaryPath, scenarioId: "account-activity-basic", profileName: "uat" });
  const events: string[] = [];

  await assert.rejects(
    () =>
      runTargetCapture(plan, {
        confirm: async () => true,
        startRecorder: async (target) => ({
          runId: `${target.targetId}-run`,
          listenUrl: target.recorderUrl,
          manifestPath: `${target.targetId}/manifest.json`,
          exchangesPath: `${target.targetId}/exchanges.ndjson`,
          exchangeCount: 1,
          stop: async () => {
            events.push(`stop:${target.targetId}`);
          },
        }),
        runTargetPageAction: async () => {
          throw new Error("page failed");
        },
      }),
    /page failed/,
  );

  assert.deepEqual(events, ["stop:baseline"]);
});

test("buildTargetCapturePreparation summarizes selected targets without raw payloads", async () => {
  const artifactDir = await writeProfileConfig({
    version: 2,
    profiles: {
      uat: {
        targets: {
          baseline: {
            variant: "baseline",
            frontendUrl: "http://localhost:8080",
            upstreamTargetUrl: "http://127.0.0.1:19080",
            recorderPort: 18080,
          },
          candidate: {
            variant: "candidate",
            frontendUrl: "http://localhost:8008",
            upstreamTargetUrl: "http://127.0.0.1:19081",
            recorderPort: 18081,
          },
        },
      },
    },
  });
  const scenarioDictionaryPath = join(artifactDir, "scenarios.json");
  await writeFile(scenarioDictionaryPath, JSON.stringify(scenarioDictionary), "utf8");

  const plan = await resolveTargetCapturePlan({
    artifactDir,
    scenarioDictionaryPath,
    scenarioId: "account-activity-basic",
    profileName: "uat",
  });
  const lines = buildTargetCapturePreparation(plan);

  assert.ok(lines.some((line) => line.includes("baseline")));
  assert.ok(lines.some((line) => line.includes("candidate")));
  assert.ok(lines.some((line) => line.includes("http://127.0.0.1:18080")));
  assert.ok(lines.some((line) => line.includes(`Artifact dir: ${artifactDir}`)));
  assert.equal(lines.join("\n").includes("Items"), false);
});

function versionOneScenarioDictionary() {
  return {
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
  };
}

async function writeProfileConfig(config: unknown): Promise<string> {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-target-profile-"));
  await mkdir(artifactDir, { recursive: true });
  await writeFile(getEnvironmentProfileConfigPath(artifactDir), JSON.stringify(config), "utf8");
  return artifactDir;
}
