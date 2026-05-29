import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountActivityUpstreamInstructions,
  parseAccountActivityUpstreamArgs,
  runAccountActivityUpstreamCapture,
  AccountActivityUpstreamConfigError,
} from "./upstream-account-activity.ts";
import type { CaptureScenario } from "./types.ts";

const accountActivityScenario: CaptureScenario = {
  id: "account-activity-basic",
  feature: "Account activity",
  description: "查詢Account activity列表",
  type: "read-only",
  layer: "browser-visible",
  page: { oldPath: "/account/activity", newPath: "/account/activity" },
  apiAllowlist: { old: ["/apis/account/activity"], new: ["/gateway/apis/account/activity"] },
};

test("parseAccountActivityUpstreamArgs parses local page URLs, proxy ports, and targets", () => {
  const config = parseAccountActivityUpstreamArgs(
    "account-activity-upstream --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --old-proxy-port 18080 --new-proxy-port 18081 --artifact-dir ./runs --manifest ./api-audit.scenarios.json",
  );

  assert.deepEqual(config, {
    command: "account-activity-upstream",
    oldBaseUrl: "http://localhost:8080",
    newBaseUrl: "http://localhost:8008",
    oldTargetBaseUrl: "http://127.0.0.1:19080",
    newTargetBaseUrl: "http://127.0.0.1:19081",
    oldProxyPort: 18080,
    newProxyPort: 18081,
    artifactDir: "./runs",
    manifestPath: "./api-audit.scenarios.json",
    allowedHosts: [],
  });
});

test("parseAccountActivityUpstreamArgs rejects remote page URLs, remote targets, and duplicate ports", () => {
  assert.throws(
    () =>
      parseAccountActivityUpstreamArgs(
        "account-activity-upstream --old-url https://prod.example.test --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --old-proxy-port 18080 --new-proxy-port 18081",
      ),
    AccountActivityUpstreamConfigError,
  );
  assert.throws(
    () =>
      parseAccountActivityUpstreamArgs(
        "account-activity-upstream --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url https://api.example.test --new-target-url http://127.0.0.1:19081 --old-proxy-port 18080 --new-proxy-port 18081",
      ),
    /backend target URLs must be local or explicitly allowed/,
  );
  assert.throws(
    () =>
      parseAccountActivityUpstreamArgs(
        "account-activity-upstream --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --old-proxy-port 18080 --new-proxy-port 18080",
      ),
    /must be different/,
  );
});

test("parseAccountActivityUpstreamArgs accepts explicitly allowlisted backend targets", () => {
  const config = parseAccountActivityUpstreamArgs(
    "account-activity-upstream --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url https://old-api.example.test --new-target-url https://new-api.example.test --allow-host old-api.example.test --allow-host new-api.example.test --old-proxy-port 18080 --new-proxy-port 18081",
  );

  assert.deepEqual(config.allowedHosts, ["old-api.example.test", "new-api.example.test"]);
});

test("buildAccountActivityUpstreamInstructions names old and new recorder URLs", () => {
  const lines = buildAccountActivityUpstreamInstructions({
    oldRecorderUrl: "http://127.0.0.1:18080",
    newRecorderUrl: "http://127.0.0.1:18081",
  });

  assert.ok(lines.some((line) => line.includes("old Go app")));
  assert.ok(lines.some((line) => line.includes("http://127.0.0.1:18080")));
  assert.ok(lines.some((line) => line.includes("new")));
  assert.ok(lines.some((line) => line.includes("http://127.0.0.1:18081")));
  assert.ok(lines.some((line) => line.includes("Do not use production")));
});

test("runAccountActivityUpstreamCapture starts two recorders, waits for confirmation, runs page actions, and reports counts", async () => {
  const started: Array<{ side: string; listenPort: number; targetBaseUrl: string }> = [];
  const confirmations: string[] = [];
  const pageActions: string[] = [];

  const result = await runAccountActivityUpstreamCapture(
    {
      oldBaseUrl: "http://localhost:8080",
      newBaseUrl: "http://localhost:8008",
      oldTargetBaseUrl: "http://127.0.0.1:19080",
      newTargetBaseUrl: "http://127.0.0.1:19081",
      oldProxyPort: 18080,
      newProxyPort: 18081,
      artifactDir: "./runs",
      scenario: accountActivityScenario,
    },
    {
      confirm: async (message) => {
        confirmations.push(message);
        return true;
      },
    },
    {
      startProxy: async (options) => {
        started.push({ side: options.side, listenPort: options.listenPort, targetBaseUrl: options.targetBaseUrl });
        return {
          runId: `${options.side}-run`,
          listenUrl: `http://127.0.0.1:${options.listenPort}`,
          manifestPath: `${options.side}/manifest.json`,
          exchangesPath: `${options.side}/exchanges.ndjson`,
          exchangeCount: options.side === "old" ? 1 : 0,
          stop: async () => undefined,
        };
      },
      runPageActions: async (options) => {
        pageActions.push(`${options.oldBaseUrl}|${options.newBaseUrl}|${options.scenario.id}`);
      },
    },
  );

  assert.deepEqual(started, [
    { side: "old", listenPort: 18080, targetBaseUrl: "http://127.0.0.1:19080" },
    { side: "new", listenPort: 18081, targetBaseUrl: "http://127.0.0.1:19081" },
  ]);
  assert.equal(confirmations.length, 1);
  assert.deepEqual(pageActions, ["http://localhost:8080|http://localhost:8008|account-activity-basic"]);
  assert.equal(result.oldRecorder.exchangeCount, 1);
  assert.equal(result.newRecorder.exchangeCount, 0);
  assert.deepEqual(result.warnings, ["No new-side upstream exchanges were recorded; confirm the new app points to the new recorder URL."]);
});
