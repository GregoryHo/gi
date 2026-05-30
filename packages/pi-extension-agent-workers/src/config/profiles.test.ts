import assert from "node:assert/strict";
import test from "node:test";

import { getWorkerProfiles, getBuiltInWorkerProfiles, resolveWorkerProfile, validateCustomWorkerProfiles } from "./profiles.ts";

test("getBuiltInWorkerProfiles includes safe profile metadata", () => {
  const profiles = getBuiltInWorkerProfiles();

  assert.ok(profiles.some((profile) => profile.name === "planner" && profile.mode === "plan" && profile.readOnly));
  assert.ok(profiles.some((profile) => profile.name === "reviewer" && profile.mode === "review" && profile.readOnly));

  const implementer = profiles.find((profile) => profile.name === "implementer");
  assert.equal(implementer?.mode, "implement");
  assert.equal(implementer?.canModifyWorkspace, true);
  assert.equal(implementer?.readOnly, false);
  assert.equal(implementer?.requireConfirmation, true);
  assert.match(implementer?.systemPrompt ?? "", /minimal diffs/i);
  assert.match(implementer?.systemPrompt ?? "", /no unrelated refactors/i);
  assert.match(implementer?.recommendedUse ?? "", /focused implementation/i);

  const verifier = profiles.find((profile) => profile.name === "verifier");
  assert.equal(verifier?.mode, "review");
  assert.equal(verifier?.canModifyWorkspace, false);
  assert.equal(verifier?.readOnly, true);
  assert.match(verifier?.systemPrompt ?? "", /do not modify files/i);
  assert.match(verifier?.systemPrompt ?? "", /acceptance criteria/i);
  assert.match(verifier?.recommendedUse ?? "", /independent verification/i);
});

test("resolveWorkerProfile returns a copy and rejects unknown profiles", () => {
  const planner = resolveWorkerProfile("planner");
  assert.equal(planner.name, "planner");

  planner.name = "mutated";
  assert.equal(resolveWorkerProfile("planner").name, "planner");
  assert.throws(() => resolveWorkerProfile("missing"), /Available profiles: planner, reviewer, implementer, verifier/);
});

test("validateCustomWorkerProfiles accepts safe custom profiles", () => {
  const profiles = validateCustomWorkerProfiles([
    {
      name: "docs-checker",
      description: "Check docs only.",
      adapter: "demo",
      mode: "review",
      systemPrompt: "Review docs for consistency.",
      requireConfirmation: false,
      readOnly: true,
      canModifyWorkspace: false,
      recommendedUse: "Use for local demo docs review.",
      defaultTimeoutMs: 1000,
    },
  ]);

  assert.equal(profiles[0]?.name, "docs-checker");
  assert.equal(profiles[0]?.readOnly, true);
});

test("validateCustomWorkerProfiles rejects unsafe or colliding profiles", () => {
  assert.throws(
    () => validateCustomWorkerProfiles([{ name: "planner", description: "x", adapter: "demo", mode: "review", requireConfirmation: false, readOnly: true, canModifyWorkspace: false, recommendedUse: "x" }]),
    /cannot override built-in profile: planner/,
  );
  assert.throws(
    () => validateCustomWorkerProfiles([{ name: "unsafe", description: "x", adapter: "claude-code", mode: "review", requireConfirmation: false, readOnly: true, canModifyWorkspace: false, recommendedUse: "x" }]),
    /must require confirmation/,
  );
});

test("getWorkerProfiles merges built-ins with custom profiles", () => {
  const profiles = getWorkerProfiles([
    {
      name: "docs-checker",
      description: "Check docs only.",
      adapter: "demo",
      mode: "review",
      requireConfirmation: false,
      readOnly: true,
      canModifyWorkspace: false,
      recommendedUse: "Use for docs review.",
    },
  ]);

  assert.ok(profiles.some((profile) => profile.name === "planner"));
  assert.ok(profiles.some((profile) => profile.name === "docs-checker"));
});
