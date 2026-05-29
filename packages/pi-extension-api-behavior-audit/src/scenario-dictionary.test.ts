import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  getDictionaryScenario,
  loadScenarioDictionary,
  ScenarioDictionaryError,
  toCaptureScenarioManifest,
  validateScenarioDictionary,
} from "./scenario-dictionary.ts";

const validDictionary = {
  version: 1,
  scenarios: [
    {
      id: "account-activity-basic",
      feature: "Account activity",
      description: "查詢Account activity列表",
      type: "read-only",
      page: { oldPath: "/account/activity", newPath: "/account/activity" },
      browserApiAllowlist: {
        old: ["/apis/account/activity"],
        new: ["/gateway/apis/account/activity"],
      },
      upstreamApiCandidates: {
        old: ["/v1/account/activity"],
        new: ["/apis/account/activity"],
      },
      evidence: {
        comparisons: [
          {
            comparisonRunId: "comparison-2026-05-26T06-53-01-380Z",
            targets: {
              old: "2026-05-26T06-54-31-301Z",
              new: "2026-05-26T06-55-18-846Z",
            },
            notes: ["Accepted from M12 scenario suggestion review."],
          },
        ],
      },
      notes: ["Do not claim full parity from this scenario alone."],
    },
  ],
};

test("toCaptureScenarioManifest derives capture scenarios from dictionary browserApiAllowlist", async () => {
  const manifest = toCaptureScenarioManifest(await validateScenarioDictionary(validDictionary));

  assert.deepEqual(manifest.scenarios[0], {
    id: "account-activity-basic",
    feature: "Account activity",
    description: "查詢Account activity列表",
    type: "read-only",
    layer: "browser-visible",
    page: { oldPath: "/account/activity", newPath: "/account/activity" },
    apiAllowlist: {
      old: ["/apis/account/activity"],
      new: ["/gateway/apis/account/activity"],
    },
    notes: ["Do not claim full parity from this scenario alone."],
  });
});

test("loadScenarioDictionary validates files deterministically", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-audit-scenario-dictionary-"));
  const path = join(root, "scenarios.json");
  await writeFile(path, JSON.stringify(validDictionary), "utf8");

  const dictionary = await loadScenarioDictionary(path);
  assert.equal(getDictionaryScenario(dictionary, "account-activity-basic").feature, "Account activity");
});

test("scenario dictionary accepts structured comparison evidence", async () => {
  const dictionary = await validateScenarioDictionary(validDictionary);
  const scenario = getDictionaryScenario(dictionary, "account-activity-basic");

  assert.deepEqual(scenario.evidence?.comparisons?.[0], {
    comparisonRunId: "comparison-2026-05-26T06-53-01-380Z",
    targets: {
      old: "2026-05-26T06-54-31-301Z",
      new: "2026-05-26T06-55-18-846Z",
    },
    notes: ["Accepted from M12 scenario suggestion review."],
  });
});

test("scenario dictionary rejects baseline layer evidence labels", async () => {
  await assert.rejects(
    () =>
      validateScenarioDictionary({
        version: 1,
        scenarios: [
          {
            ...validDictionary.scenarios[0],
            evidence: {
              layerA: ["2026-05-25T03-16-22-781Z"],
              layerB: ["old:2026-05-25T06-58-22-572Z", "new:2026-05-25T06-58-22-580Z"],
            },
          },
        ],
      }),
    /comparisons|layerA|layerB|not allowed/,
  );
});

test("scenario dictionary rejects duplicate ids and missing upstream candidates", async () => {
  await assert.rejects(
    () => validateScenarioDictionary({ ...validDictionary, version: 2 }),
    /version/,
  );
  await assert.rejects(
    () =>
      validateScenarioDictionary({
        version: 1,
        scenarios: [validDictionary.scenarios[0], validDictionary.scenarios[0]],
      }),
    /Duplicate scenario id/,
  );
  await assert.rejects(
    () =>
      validateScenarioDictionary({
        version: 1,
        scenarios: [{ ...validDictionary.scenarios[0], upstreamApiCandidates: undefined }],
      }),
    /upstreamApiCandidates/,
  );
});

test("getDictionaryScenario throws for missing scenario ids", async () => {
  const dictionary = await validateScenarioDictionary(validDictionary);
  assert.throws(
    () => getDictionaryScenario(dictionary, "missing"),
    ScenarioDictionaryError,
  );
});
