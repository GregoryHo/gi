import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeterministicRecap,
  createPlanArtifact,
  createPlanId,
  isActivePlanStatus,
} from "./artifact-types.ts";

test("createPlanId creates stable timestamped slug ids", () => {
  assert.equal(
    createPlanId(new Date("2026-06-28T14:30:12.000Z"), "Auth refactor plan!"),
    "plan_20260628_143012_auth_refactor_plan",
  );
});

test("createPlanArtifact creates a v1 artifact with session sequence", () => {
  const artifact = createPlanArtifact({
    now: new Date("2026-06-28T14:30:12.000Z"),
    cwd: "/repo",
    title: "Auth refactor",
    steps: [{ step: 1, text: "Inspect code" }],
    sessionFile: "/sessions/a.jsonl",
    sessionPlanNumber: 7,
    previousPlanId: "plan_prev",
  });

  assert.deepEqual(artifact, {
    source: "pi-extension-plan-mode",
    version: 1,
    id: "plan_20260628_143012_auth_refactor",
    title: "Auth refactor",
    status: "draft",
    cwd: "/repo",
    createdAt: "2026-06-28T14:30:12.000Z",
    updatedAt: "2026-06-28T14:30:12.000Z",
    session: { primarySessionFile: "/sessions/a.jsonl" },
    sequence: { sessionPlanNumber: 7, previousPlanId: "plan_prev" },
    steps: [{ step: 1, text: "Inspect code" }],
  });
});

test("createDeterministicRecap summarizes completion without LLM", () => {
  assert.deepEqual(
    createDeterministicRecap({
      source: "pi-extension-plan-mode",
      version: 1,
      id: "plan_id",
      title: "Auth refactor",
      status: "completed",
      cwd: "/repo",
      createdAt: "2026-06-28T14:30:12.000Z",
      updatedAt: "2026-06-28T15:00:00.000Z",
      session: {},
      sequence: { sessionPlanNumber: 1 },
      steps: [
        { step: 1, text: "Inspect", completed: true },
        { step: 2, text: "Verify" },
      ],
    }),
    {
      summary: "Plan \"Auth refactor\" completed 1/2 step(s).",
      completedSteps: 1,
      totalSteps: 2,
    },
  );
});

test("isActivePlanStatus identifies non-terminal plans", () => {
  assert.equal(isActivePlanStatus("draft"), true);
  assert.equal(isActivePlanStatus("executing"), true);
  assert.equal(isActivePlanStatus("completed"), false);
  assert.equal(isActivePlanStatus("abandoned"), false);
});
