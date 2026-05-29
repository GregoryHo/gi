import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { saveEnvironmentProfile } from "./environment-profiles.ts";
import { writeManifest, appendExchange } from "./artifacts.ts";
import {
  buildPrepareAccountActivityUpstreamCaptureResult,
  executeListScenariosTool,
  executeClearEnvironmentProfileTool,
  executeListTargetsTool,
  executePrepareScenarioDiscoveryTool,
  executePrepareTargetCaptureTool,
  executePrepareUpstreamCaptureTool,
  executeRunScenarioDiscoveryTool,
  executeRunTargetCaptureTool,
  executeRunUpstreamCaptureTool,
  executeRunAccountActivityUpstreamCaptureTool,
  executeSaveEnvironmentProfileTool,
  executeShowEnvironmentProfilesTool,
  executeValidateRunTool,
  registerApiAuditTools,
} from "./tools.ts";
import type { ApiExchange, CaptureManifest } from "./types.ts";

const validManifest: CaptureManifest = {
  runId: "tool-run-1",
  createdAt: "2026-05-25T00:00:00.000Z",
  artifactVersion: 1,
  redaction: { marker: "[REDACTED]", policy: "default-v1" },
  scenarios: ["account-activity-basic"],
  layer: "upstream",
  exchangeCount: 1,
};

const validExchange: ApiExchange = {
  runId: "tool-run-1",
  layer: "upstream",
  side: "old",
  scenarioId: "account-activity-basic",
  request: { method: "GET", url: "http://127.0.0.1:18080/v1/account/activity", headers: {}, body: null },
  response: { status: 200, headers: {}, body: { Items: null, Others: null, Pager: {} } },
  timing: { startedAt: "2026-05-25T00:00:00.000Z", durationMs: 1 },
  provenance: { source: "recording-proxy" },
};

test("registerApiAuditTools registers natural-language tool entrypoints", () => {
  const tools: Array<{ name: string; promptSnippet?: string; promptGuidelines?: string[] }> = [];
  registerApiAuditTools({
    registerTool(definition: { name: string; promptSnippet?: string; promptGuidelines?: string[] }) {
      tools.push(definition);
    },
  } as never);

  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "api_audit_list_scenarios",
      "api_audit_validate_run",
      "api_audit_prepare_account_history_upstream_capture",
      "api_audit_run_account_history_upstream_capture",
      "api_audit_prepare_upstream_capture",
      "api_audit_run_upstream_capture",
      "api_audit_show_environment_profiles",
      "api_audit_save_environment_profile",
      "api_audit_clear_environment_profile",
      "api_audit_list_targets",
      "api_audit_prepare_target_capture",
      "api_audit_run_target_capture",
      "api_audit_prepare_scenario_discovery",
      "api_audit_run_scenario_discovery",
    ],
  );
  assert.ok(tools.every((tool) => tool.promptSnippet));
  assert.ok(tools.some((tool) => tool.promptGuidelines?.some((line) => line.includes("api_audit"))));
});

test("registered profile show tool resolves default artifact dir from execution cwd", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "api-audit-tool-workspace-"));
  const cwd = join(workspaceRoot, "nested");
  await mkdir(cwd, { recursive: true });
  const artifactDir = join(workspaceRoot, ".pi-api-audit-runs");
  await saveEnvironmentProfile(artifactDir, "uat", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
  });

  let showTool: { execute: (...args: never[]) => Promise<{ content: Array<{ text: string }>; details: Record<string, unknown> }> } | undefined;
  registerApiAuditTools({
    registerTool(definition: { name: string; execute: (...args: never[]) => Promise<{ content: Array<{ text: string }>; details: Record<string, unknown> }> }) {
      if (definition.name === "api_audit_show_environment_profiles") showTool = definition;
    },
  } as never);

  const result = await showTool?.execute("tool-1" as never, {} as never, undefined as never, undefined as never, {
    cwd: workspaceRoot,
    hasUI: false,
    ui: {},
  } as never);

  assert.ok(result);
  assert.equal(result.details.artifactDir, artifactDir);
  assert.match(result.content[0].text, /uat/);
});

test("registered list scenarios tool does not fall back to package scenarios", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "api-audit-list-scenarios-workspace-"));
  let listTool: { execute: (...args: never[]) => Promise<{ content: Array<{ text: string }>; details: Record<string, unknown> }> } | undefined;
  registerApiAuditTools({
    registerTool(definition: { name: string; execute: (...args: never[]) => Promise<{ content: Array<{ text: string }>; details: Record<string, unknown> }> }) {
      if (definition.name === "api_audit_list_scenarios") listTool = definition;
    },
  } as never);

  const result = await listTool?.execute("tool-1" as never, {} as never, undefined as never, undefined as never, {
    cwd: workspaceRoot,
    hasUI: false,
    ui: {},
  } as never);

  assert.ok(result);
  assert.match(result.content[0].text, /No workspace API audit scenario dictionary/);
  assert.doesNotMatch(result.content[0].text, /account-activity-basic/);
  assert.deepEqual(result.details.scenarios, []);
});

test("executeListScenariosTool returns scenario dictionary SOT details without payload bodies", async () => {
  const scenarioDictionaryPath = await writeScenarioDictionaryFixture();
  const result = await executeListScenariosTool({ scenarioDictionaryPath });

  assert.match(result.content[0].text, /account-activity-basic/);
  const scenario = result.details.scenarios[0] as {
    id: string;
    upstreamApiCandidates: { old: string[]; new: string[] };
  };
  assert.equal(scenario.id, "account-activity-basic");
  assert.deepEqual(scenario.upstreamApiCandidates.old, ["/v1/account/activity"]);
  assert.deepEqual(scenario.upstreamApiCandidates.new, ["/apis/account/activity"]);
  assert.equal(JSON.stringify(result).includes("Items"), false);
});

test("executeValidateRunTool validates a run through schema-backed loaders", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-tool-run-"));
  const paths = await writeManifest(root, validManifest);
  await appendExchange(root, validExchange);

  const result = await executeValidateRunTool({ runDir: paths.runDir, verifyExchangeCount: true });

  assert.match(result.content[0].text, /valid/);
  assert.equal(result.details.valid, true);
  assert.equal(result.details.runId, "tool-run-1");
  assert.equal(result.details.exchangeCount, 1);
});

test("buildPrepareAccountActivityUpstreamCaptureResult gives deterministic instructions and command args", () => {
  const result = buildPrepareAccountActivityUpstreamCaptureResult({
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://old-api.example.test",
    newTargetUrl: "https://new-api.example.test",
    oldProxyPort: 18080,
    newProxyPort: 18081,
    allowHosts: ["old-api.example.test", "new-api.example.test"],
  });

  assert.match(result.content[0].text, /old Go app/);
  assert.match(result.content[0].text, /http:\/\/127\.0\.0\.1:18080/);
  assert.match(String(result.details.commandArgs), /account-activity-upstream/);
  assert.equal(result.details.oldRecorderUrl, "http://127.0.0.1:18080");
  assert.equal(result.details.newRecorderUrl, "http://127.0.0.1:18081");
});

test("scenario discovery tools prepare and run candidate ids without dictionary entries", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-discovery-tool-"));
  await saveEnvironmentProfile(artifactDir, "uat", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
    oldProxyPort: 18080,
    newProxyPort: 18081,
  });

  const prepared = await executePrepareScenarioDiscoveryTool({
    artifactDir,
    profileName: "uat",
    candidateScenarioId: "forward-game+transfer",
    targetIds: ["new"],
  });
  assert.match(prepared.content[0].text, /forward-game\+transfer/);
  assert.equal(prepared.details.targetCount, 1);

  const result = await executeRunScenarioDiscoveryTool(
    {
      artifactDir,
      profileName: "uat",
      candidateScenarioId: "forward-game+transfer",
      targetIds: ["new"],
    },
    {
      hasUI: true,
      confirm: async () => true,
      notify: () => undefined,
    },
    {
      startRecorder: async (target) => ({
        runId: `${target.targetId}-run`,
        listenUrl: target.recorderUrl,
        manifestPath: `${target.targetId}/manifest.json`,
        exchangesPath: `${target.targetId}/exchanges.ndjson`,
        exchangeCount: 1,
        stop: async () => undefined,
      }),
      runManualPageAction: async (target) => {
        assert.equal(target.targetId, "new");
      },
    },
  );
  assert.match(result.content[0].text, /Scenario discovery complete/);
  assert.equal(result.details.candidateScenarioId, "forward-game+transfer");
});

test("target-based tools list and prepare selected targets", async () => {
  const scenarioDictionaryPath = await writeScenarioDictionaryFixture();
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-target-tool-"));
  await saveEnvironmentProfile(artifactDir, "uat", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
    oldProxyPort: 18080,
    newProxyPort: 18081,
  });

  const listed = await executeListTargetsTool({
    artifactDir,
    scenarioDictionaryPath,
    profileName: "uat",
    scenarioId: "account-activity-basic",
  });
  assert.match(listed.content[0].text, /old/);
  assert.match(listed.content[0].text, /new/);

  const prepared = await executePrepareTargetCaptureTool({
    artifactDir,
    scenarioDictionaryPath,
    profileName: "uat",
    scenarioId: "account-activity-basic",
    targetIds: ["new"],
  });
  assert.match(prepared.content[0].text, /Selected targets: new/);
  assert.equal(prepared.details.targetCount, 1);
});

test("executeRunTargetCaptureTool runs selected targets with explicit confirmation", async () => {
  const scenarioDictionaryPath = await writeScenarioDictionaryFixture();
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-target-run-tool-"));
  await saveEnvironmentProfile(artifactDir, "uat", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
    oldProxyPort: 18080,
    newProxyPort: 18081,
  });
  const confirmations: string[] = [];

  const result = await executeRunTargetCaptureTool(
    {
      artifactDir,
      scenarioDictionaryPath,
      profileName: "uat",
      scenarioId: "account-activity-basic",
      targetIds: ["new"],
    },
    {
      hasUI: true,
      confirm: async (_title, message) => {
        confirmations.push(message);
        return true;
      },
      notify: () => undefined,
    },
    {
      startRecorder: async (target) => ({
        runId: `${target.targetId}-run`,
        listenUrl: target.recorderUrl,
        manifestPath: `${target.targetId}/manifest.json`,
        exchangesPath: `${target.targetId}/exchanges.ndjson`,
        exchangeCount: 1,
        stop: async () => undefined,
      }),
      runTargetPageAction: async (target) => {
        assert.equal(target.targetId, "new");
      },
    },
  );

  assert.equal(confirmations.length, 1);
  assert.match(result.content[0].text, /Target capture complete/);
  assert.equal(result.details.targetCount, 1);
});

test("environment profile tools show save and clear profiles", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-tool-"));

  const saved = await executeSaveEnvironmentProfileTool({
    artifactDir,
    profileName: "uat",
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://127.0.0.1:19080",
    newTargetUrl: "http://127.0.0.1:19081",
    makeDefault: true,
  });
  assert.match(saved.content[0].text, /Saved API audit environment profile: uat/);

  const shown = await executeShowEnvironmentProfilesTool({ artifactDir });
  assert.match(shown.content[0].text, /uat/);
  assert.equal(shown.details.defaultProfile, "uat");

  const cleared = await executeClearEnvironmentProfileTool({ artifactDir, profileName: "uat" });
  assert.match(cleared.content[0].text, /Cleared API audit environment profile: uat/);
});

test("executePrepareUpstreamCaptureTool can resolve URLs from profileName", async () => {
  const scenarioDictionaryPath = await writeScenarioDictionaryFixture();
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-profile-prepare-"));
  await saveEnvironmentProfile(artifactDir, "uat", {
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://old-api.example.test",
    newTargetUrl: "https://new-api.example.test",
    oldProxyPort: 18080,
    newProxyPort: 18081,
    allowHosts: ["old-api.example.test", "new-api.example.test"],
  });

  const result = await executePrepareUpstreamCaptureTool({
    artifactDir,
    scenarioDictionaryPath,
    profileName: "uat",
    scenarioId: "account-activity-basic",
  });

  assert.match(result.content[0].text, /account-activity-basic/);
  assert.equal(result.details.oldTargetBaseUrl, "http://old-api.example.test");
  assert.equal(result.details.newTargetBaseUrl, "https://new-api.example.test");
});

test("executePrepareUpstreamCaptureTool reads scenario paths and candidates from dictionary SOT", async () => {
  const scenarioDictionaryPath = await writeScenarioDictionaryFixture();
  const result = await executePrepareUpstreamCaptureTool({
    scenarioDictionaryPath,
    scenarioId: "account-activity-basic",
    oldUrl: "http://localhost:8080",
    newUrl: "http://localhost:8008",
    oldTargetUrl: "http://old-api.example.test",
    newTargetUrl: "https://new-api.example.test",
    oldProxyPort: 18080,
    newProxyPort: 18081,
    allowHosts: ["old-api.example.test", "new-api.example.test"],
  });

  assert.match(result.content[0].text, /account-activity-basic/);
  assert.match(result.content[0].text, /\/account\/activity/);
  assert.match(result.content[0].text, /\/v1\/account\/activity/);
  assert.equal(result.details.scenarioId, "account-activity-basic");
  assert.deepEqual(result.details.page, { oldPath: "/account/activity", newPath: "/account/activity" });
  assert.deepEqual(result.details.upstreamApiCandidates, {
    old: ["/v1/account/activity"],
    new: ["/apis/account/activity"],
  });
});

test("executeRunUpstreamCaptureTool uses scenarioId and scenario paths for capture flow", async () => {
  const scenarioDictionaryPath = await writeScenarioDictionaryFixture();
  const confirmations: string[] = [];
  const result = await executeRunUpstreamCaptureTool(
    {
      scenarioDictionaryPath,
      scenarioId: "account-activity-basic",
      oldUrl: "http://localhost:8080",
      newUrl: "http://localhost:8008",
      oldTargetUrl: "http://127.0.0.1:19080",
      newTargetUrl: "http://127.0.0.1:19081",
      oldProxyPort: 18080,
      newProxyPort: 18081,
    },
    {
      hasUI: true,
      confirm: async (_title, message) => {
        confirmations.push(message);
        return true;
      },
      notify: () => undefined,
    },
    {
      runCapture: async (options) => {
        assert.equal(options.scenario?.id, "account-activity-basic");
        assert.deepEqual(options.scenario?.page, { oldPath: "/account/activity", newPath: "/account/activity" });
        return {
          oldRecorder: {
            runId: "old-run",
            listenUrl: `http://127.0.0.1:${options.oldProxyPort}`,
            manifestPath: "old/manifest.json",
            exchangesPath: "old/exchanges.ndjson",
            exchangeCount: 2,
            stop: async () => undefined,
          },
          newRecorder: {
            runId: "new-run",
            listenUrl: `http://127.0.0.1:${options.newProxyPort}`,
            manifestPath: "new/manifest.json",
            exchangesPath: "new/exchanges.ndjson",
            exchangeCount: 3,
            stop: async () => undefined,
          },
          instructions: ["configure apps"],
          warnings: [],
        };
      },
    },
  );

  assert.equal(confirmations.length, 1);
  assert.match(result.content[0].text, /account-activity-basic/);
  assert.equal(result.details.scenarioId, "account-activity-basic");
  const oldDetails = result.details.old as { exchangeCount: number };
  assert.equal(oldDetails.exchangeCount, 2);
});

async function writeScenarioDictionaryFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "api-audit-scenario-fixture-"));
  const path = join(root, "scenarios.json");
  await writeFile(
    path,
    JSON.stringify({
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
    }),
    "utf8",
  );
  return path;
}

test("executeRunAccountActivityUpstreamCaptureTool reuses capture flow with explicit confirmation", async () => {
  const manifestPath = await writeScenarioDictionaryFixture();
  const confirmations: string[] = [];
  const result = await executeRunAccountActivityUpstreamCaptureTool(
    {
      oldUrl: "http://localhost:8080",
      newUrl: "http://localhost:8008",
      oldTargetUrl: "http://127.0.0.1:19080",
      newTargetUrl: "http://127.0.0.1:19081",
      manifestPath,
      oldProxyPort: 18080,
      newProxyPort: 18081,
    },
    {
      hasUI: true,
      confirm: async (_title, message) => {
        confirmations.push(message);
        return true;
      },
      notify: () => undefined,
    },
    {
      runCapture: async (options) => ({
        oldRecorder: {
          runId: "old-run",
          listenUrl: `http://127.0.0.1:${options.oldProxyPort}`,
          manifestPath: "old/manifest.json",
          exchangesPath: "old/exchanges.ndjson",
          exchangeCount: 2,
          stop: async () => undefined,
        },
        newRecorder: {
          runId: "new-run",
          listenUrl: `http://127.0.0.1:${options.newProxyPort}`,
          manifestPath: "new/manifest.json",
          exchangesPath: "new/exchanges.ndjson",
          exchangeCount: 3,
          stop: async () => undefined,
        },
        instructions: ["configure apps"],
        warnings: [],
      }),
    },
  );

  assert.equal(confirmations.length, 1);
  assert.match(result.content[0].text, /complete/);
  const oldDetails = result.details.old as { exchangeCount: number };
  const newDetails = result.details.new as { exchangeCount: number };
  assert.equal(oldDetails.exchangeCount, 2);
  assert.equal(newDetails.exchangeCount, 3);
});
