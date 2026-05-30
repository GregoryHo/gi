import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getScenario,
  loadScenarioManifest,
  ScenarioManifestError,
} from "./scenarios.ts";
import type { CaptureScenario } from "../types.ts";

const accountActivityScenario: CaptureScenario = {
  id: "account-activity-basic",
  feature: "Account activity",
  description: "custom scenario",
  type: "read-only",
  layer: "browser-visible",
  page: { oldPath: "/old-account", newPath: "/new-account" },
  apiAllowlist: { old: ["/apis/old-account"], new: ["/moapi/apis/new-account"] },
  notes: ["custom note"],
};

test("loadScenarioManifest requires an explicit workspace manifest path", async () => {
  await assert.rejects(() => loadScenarioManifest(), /workspace scenario manifest path is required/);
});

test("loadScenarioManifest reads and validates a custom JSON manifest", async () => {
  const manifestPath = await writeManifest({ version: 1, scenarios: [accountActivityScenario] });

  const manifest = await loadScenarioManifest(manifestPath);
  const scenario = getScenario(manifest, "account-activity-basic");

  assert.equal(scenario.description, "custom scenario");
  assert.deepEqual(scenario.page, { oldPath: "/old-account", newPath: "/new-account" });
});

test("loadScenarioManifest rejects duplicate scenario ids", async () => {
  const manifestPath = await writeManifest({ version: 1, scenarios: [accountActivityScenario, accountActivityScenario] });

  await assert.rejects(() => loadScenarioManifest(manifestPath), ScenarioManifestError);
});

test("loadScenarioManifest rejects missing required page and allowlist fields", async () => {
  const manifestPath = await writeManifest({
    version: 1,
    scenarios: [
      {
        id: "account-activity-basic",
        feature: "Account activity",
        description: "invalid scenario",
        type: "read-only",
        layer: "browser-visible",
        page: { oldPath: "/account/activity" },
        apiAllowlist: { old: ["/apis/account/activity"] },
      },
    ],
  });

  await assert.rejects(() => loadScenarioManifest(manifestPath), /newPath/);
});

async function writeManifest(value: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "api-audit-scenarios-"));
  const manifestPath = join(dir, "api-audit.scenarios.json");
  await writeFile(manifestPath, JSON.stringify(value), "utf8");
  return manifestPath;
}
