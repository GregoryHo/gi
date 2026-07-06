import assert from "node:assert/strict";
import test from "node:test";

import type { PlanArtifactV1, PlanIndexEntry } from "./artifact-types.ts";
import {
  buildPlanRoutingPolicy,
  formatActivePlanRoutingContext,
  formatRecentPlansRoutingHint,
} from "./routing.ts";

const activePlan: PlanArtifactV1 = {
  source: "pi-extension-plan-mode",
  version: 1,
  id: "plan_20260628_143012_auth_refactor",
  title: "Auth refactor",
  status: "executing",
  cwd: "/repo",
  createdAt: "2026-06-28T14:30:12.000Z",
  updatedAt: "2026-06-28T15:00:00.000Z",
  session: { primarySessionFile: "/sessions/current.jsonl" },
  sequence: { sessionPlanNumber: 7 },
  steps: [
    { step: 1, text: "Inspect auth module", completed: true },
    { step: 2, text: "Add tests", completed: true },
    { step: 3, text: "Refactor validation" },
    { step: 4, text: "Run verification" },
  ],
};

test("formatActivePlanRoutingContext renders compact active plan summary", () => {
  const context = formatActivePlanRoutingContext(activePlan);

  assert.match(context, /^\[ACTIVE PLAN\]/);
  assert.match(context, /id: plan_20260628_143012_auth_refactor/);
  assert.match(context, /title: Auth refactor/);
  assert.match(context, /status: executing/);
  assert.match(context, /progress: 2\/4/);
  assert.match(context, /1\. ☑ Inspect auth module/);
  assert.match(context, /3\. ☐ Refactor validation/);
});

test("formatActivePlanRoutingContext truncates long step lists", () => {
  const context = formatActivePlanRoutingContext(
    {
      ...activePlan,
      steps: Array.from({ length: 8 }, (_, index) => ({ step: index + 1, text: `Step ${index + 1}` })),
    },
    { maxSteps: 3 },
  );

  assert.match(context, /1\. ☐ Step 1/);
  assert.match(context, /3\. ☐ Step 3/);
  assert.match(context, /\.\.\. 5 more step\(s\)/);
  assert.doesNotMatch(context, /8\. ☐ Step 8/);
});

test("buildPlanRoutingPolicy includes guarded natural-language routing rules", () => {
  const policy = buildPlanRoutingPolicy();

  assert.match(policy, /refines this objective/i);
  assert.match(policy, /distinct new objective/i);
  assert.match(policy, /previous objective/i);
  assert.match(policy, /ambiguous/i);
  assert.match(policy, /Do not silently overwrite/i);
  assert.match(policy, /Do not silently switch/i);
  assert.match(policy, /Do not silently complete/i);
  assert.match(policy, /Do not silently abandon/i);
  assert.match(policy, /plan_record/);
  assert.match(policy, /natural disposition/i);
  assert.doesNotMatch(policy, /\/plan-new/);
  assert.match(policy, /\/plan-history/);
  assert.match(policy, /\/plan-switch <id>/);
});

test("formatRecentPlansRoutingHint returns compact metadata without raw artifact dumps", () => {
  const plans: PlanIndexEntry[] = [
    {
      id: "plan_a",
      title: "Auth refactor",
      status: "completed",
      createdAt: "2026-06-28T14:30:12.000Z",
      updatedAt: "2026-06-28T15:00:00.000Z",
      cwd: "/repo",
      sessionPlanNumber: 1,
      artifactPath: "plans/2026-06/plan_a.json",
      summary: "Refactor auth module",
    },
  ];

  const hint = formatRecentPlansRoutingHint(plans);

  assert.match(hint, /\[RECENT PLANS\]/);
  assert.match(hint, /plan_a \| Auth refactor \| completed/);
  assert.doesNotMatch(hint, /artifactPath/);
  assert.doesNotMatch(hint, /steps/);
});
