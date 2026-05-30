import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";

import { buildApiAuditDashboardLines } from "./dashboard.ts";
import { getEnvironmentProfileConfigPath } from "../config/environment-profiles.ts";

test("buildApiAuditDashboardLines summarizes profiles scenarios runs and actions", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-dashboard-"));
  await writeFile(
    getEnvironmentProfileConfigPath(artifactDir),
    JSON.stringify({
      version: 1,
      defaultProfile: "uat",
      profiles: {
        uat: {
          oldUrl: "http://localhost:8080",
          newUrl: "http://localhost:8008",
          oldTargetUrl: "http://127.0.0.1:19080",
          newTargetUrl: "http://127.0.0.1:19081",
        },
      },
    }),
    "utf8",
  );
  await writeFile(
    join(artifactDir, "scenarios.local.json"),
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
  const runDir = join(artifactDir, "2026-05-25T06-58-22-580Z");
  await mkdir(runDir, { recursive: true });
  await writeFile(
    join(runDir, "manifest.json"),
    JSON.stringify({
      runId: "2026-05-25T06-58-22-580Z",
      createdAt: "2026-05-25T06:58:22.580Z",
      artifactVersion: 1,
      redaction: { marker: "[REDACTED]", policy: "default-v1" },
      scenarios: ["account-activity-basic"],
      layer: "upstream",
      exchangeCount: 33,
    }),
    "utf8",
  );

  const lines = await buildApiAuditDashboardLines({ artifactDir });
  const text = lines.join("\n");

  assert.match(text, /API audit dashboard/);
  assert.match(text, /uat \(default\)/);
  assert.match(text, /account-activity-basic/);
  assert.match(text, /2026-05-25T06-58-22-580Z/);
  assert.match(text, /\/api-audit setup/);
  assert.match(text, /\/api-audit capture --scenario-id account-activity-basic --profile uat/);
});

test("buildApiAuditDashboardLines handles empty local state", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "api-audit-dashboard-empty-"));

  const lines = await buildApiAuditDashboardLines({ artifactDir });
  const text = lines.join("\n");

  assert.match(text, /Profiles: none/);
  assert.match(text, /Recent runs: none/);
  assert.match(text, /\/api-audit setup/);
});
