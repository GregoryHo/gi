import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("evidence pipeline docs describe artifact responsibilities and deterministic hints", async () => {
  const docsPath = join(process.cwd(), "../../docs/pi-extension-api-behavior-audit/evidence-pipeline.md");
  const content = await readFile(docsPath, "utf8");

  for (const expected of [
    "raw run",
    "comparison",
    "analysis",
    "suggestion",
    "scenario dictionary",
    "matches-known-upstream-candidate",
    "matches-known-browser-api",
    "high-frequency-background-candidate",
    "possibleAdditionalUpstream",
    "Drift guardrails",
  ]) {
    assert.match(content, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
