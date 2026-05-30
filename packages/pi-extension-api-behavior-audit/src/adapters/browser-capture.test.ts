import assert from "node:assert/strict";
import test from "node:test";

import { createAccountActivityManifest, getAccountActivityCaptureUrl, isAccountActivityApiUrl } from "./browser-capture.ts";
import type { CaptureScenario } from "../types.ts";

const accountActivityScenario: CaptureScenario = {
  id: "account-activity-basic",
  feature: "Account activity",
  description: "查詢Account activity列表",
  type: "read-only",
  layer: "browser-visible",
  page: {
    oldPath: "/account/activity",
    newPath: "/account/activity",
  },
  apiAllowlist: {
    old: ["/apis/account/activity"],
    new: ["/gateway/apis/account/activity"],
  },
};

test("getAccountActivityCaptureUrl resolves the scenario page under each base URL", () => {
  assert.equal(getAccountActivityCaptureUrl("http://localhost:8080", "old", accountActivityScenario), "http://localhost:8080/account/activity");
  assert.equal(getAccountActivityCaptureUrl("http://localhost:8008/app", "new", accountActivityScenario), "http://localhost:8008/account/activity");
});

test("isAccountActivityApiUrl matches only expected Layer A browser-visible APIs", () => {
  assert.equal(isAccountActivityApiUrl("old", "http://localhost:8080/apis/account/activity?pi=1", accountActivityScenario), true);
  assert.equal(isAccountActivityApiUrl("new", "http://localhost:8008/gateway/apis/account/activity?pi=1", accountActivityScenario), true);
  assert.equal(isAccountActivityApiUrl("old", "http://localhost:8080/gateway/apis/account/activity", accountActivityScenario), false);
  assert.equal(isAccountActivityApiUrl("new", "http://localhost:8008/apis/account/activity", accountActivityScenario), false);
  assert.equal(isAccountActivityApiUrl("new", "http://localhost:8008/gateway/apis/account/summary", accountActivityScenario), false);
});

test("createAccountActivityManifest records Layer A validation metadata", () => {
  const manifest = createAccountActivityManifest({
    runId: "run-1",
    createdAt: "2026-05-24T00:00:00.000Z",
    oldBaseUrl: "http://localhost:8080",
    newBaseUrl: "http://localhost:8008",
    scenario: accountActivityScenario,
  });

  assert.deepEqual(manifest, {
    runId: "run-1",
    createdAt: "2026-05-24T00:00:00.000Z",
    artifactVersion: 1,
    redaction: { marker: "[REDACTED]", policy: "default-v1" },
    scenarios: ["account-activity-basic"],
    layer: "browser-visible",
    targets: {
      oldBaseUrl: "http://localhost:8080",
      newBaseUrl: "http://localhost:8008",
    },
    scenarioSnapshots: [accountActivityScenario],
    notes: ["Layer A browser-visible capture is validation-only, not final backend behavior evidence."],
  });
});
