import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createGoalState,
  DEFAULT_GOAL_LIMITS,
  isTerminalGoalPhase,
  normalizeGoalStateForRestore,
  transitionGoalPhase,
} from "./state.ts";

const NOW = new Date("2026-06-30T02:40:33.000Z");
const LATER = new Date("2026-06-30T02:41:00.000Z");

test("createGoalState initializes bounded active goal state", () => {
  const goal = createGoalState({
    objective: "  Ship goal mode M1  ",
    acceptanceCriteria: ["tests pass"],
    now: NOW,
  });

  assert.match(goal.id, /^goal_20260630_024033_ship_goal_mode_m1$/);
  assert.equal(goal.objective, "Ship goal mode M1");
  assert.equal(goal.phase, "planning");
  assert.deepEqual(goal.acceptanceCriteria, ["tests pass"]);
  assert.equal(goal.iterationCount, 0);
  assert.equal(goal.failureCount, 0);
  assert.equal(goal.startedAt, NOW.toISOString());
  assert.equal(goal.updatedAt, NOW.toISOString());
  assert.equal(goal.runId, "run_20260630_024033");
  assert.equal(goal.nextIterationId, 1);
  assert.deepEqual(goal.sourcePlan, undefined);
  assert.deepEqual(goal.limits, DEFAULT_GOAL_LIMITS);
  assert.deepEqual(goal.approvals, {
    writesApproved: false,
    destructiveBashApproved: false,
  });
});

test("createGoalState preserves optional source plan as advisory context", () => {
  const goal = createGoalState({
    objective: "Complete current plan",
    now: NOW,
    sourcePlan: {
      planId: "plan_1",
      title: "Ship M3",
      status: "approved",
      steps: [
        { step: 1, text: "Inspect plan", completed: true },
        { step: 2, text: "Start goal" },
      ],
    },
  });
  const transitioned = transitionGoalPhase(goal, "running_iteration", LATER);

  assert.deepEqual(goal.sourcePlan, {
    planId: "plan_1",
    title: "Ship M3",
    status: "approved",
    steps: [
      { step: 1, text: "Inspect plan", completed: true },
      { step: 2, text: "Start goal" },
    ],
  });
  assert.deepEqual(transitioned.sourcePlan, goal.sourcePlan);
  assert.notEqual(transitioned.sourcePlan, goal.sourcePlan);
  assert.notEqual(transitioned.sourcePlan?.steps, goal.sourcePlan?.steps);
});

test("createGoalState preserves optional worker delegation policy", () => {
	const goal = createGoalState({
		objective: "Complete with worker verification",
		now: NOW,
		workerDelegation: {
			enabled: true,
			workspace: "/tmp/project",
			allowedProfiles: ["verifier", "reviewer"],
			purpose: "independent verification",
		},
	});
	const transitioned = transitionGoalPhase(goal, "running_iteration", LATER);
	const restored = normalizeGoalStateForRestore(transitioned);

	assert.deepEqual(goal.workerDelegation, {
		enabled: true,
		workspace: "/tmp/project",
		allowedProfiles: ["verifier", "reviewer"],
		purpose: "independent verification",
	});
	assert.deepEqual(transitioned.workerDelegation, goal.workerDelegation);
	assert.notEqual(transitioned.workerDelegation, goal.workerDelegation);
	assert.notEqual(transitioned.workerDelegation?.allowedProfiles, goal.workerDelegation?.allowedProfiles);
	assert.deepEqual(restored.workerDelegation, goal.workerDelegation);
	assert.notEqual(restored.workerDelegation, goal.workerDelegation);
});

test("createGoalState rejects empty objectives", () => {
  assert.throws(() => createGoalState({ objective: "   ", now: NOW }), /objective/i);
});

test("transitionGoalPhase updates timestamp for allowed transitions", () => {
  const goal = createGoalState({ objective: "Ship goal mode M1", now: NOW });
  const running = transitionGoalPhase(goal, "running_iteration", LATER);
  const verifying = transitionGoalPhase(running, "verifying", LATER);
  const nextPlanning = transitionGoalPhase(verifying, "planning", LATER);

  assert.equal(running.phase, "running_iteration");
  assert.equal(verifying.phase, "verifying");
  assert.equal(nextPlanning.phase, "planning");
  assert.equal(nextPlanning.updatedAt, LATER.toISOString());
});

test("transitionGoalPhase allows cancellation from non-terminal phases and rejects terminal transitions", () => {
  const goal = createGoalState({ objective: "Ship goal mode M1", now: NOW });
  const cancelled = transitionGoalPhase(goal, "cancelled", LATER);

  assert.equal(cancelled.phase, "cancelled");
  assert.equal(isTerminalGoalPhase(cancelled.phase), true);
  assert.equal(isTerminalGoalPhase("done"), true);
  assert.equal(isTerminalGoalPhase("cancelled"), true);
  assert.equal(isTerminalGoalPhase("blocked"), false);
  assert.throws(() => transitionGoalPhase(cancelled, "planning", LATER), /terminal/i);
});

test("transitionGoalPhase supports pause, resume, block resume, and cancel", () => {
  const running = transitionGoalPhase(createGoalState({ objective: "Ship goal mode M2", now: NOW }), "running_iteration", LATER);
  const paused = transitionGoalPhase(running, "paused", LATER);
  const resumed = transitionGoalPhase(paused, "planning", LATER);
  const blocked = transitionGoalPhase(resumed, "blocked", LATER);
  const resumedFromBlocked = transitionGoalPhase(blocked, "planning", LATER);
  const cancelled = transitionGoalPhase(resumedFromBlocked, "cancelled", LATER);

  assert.equal(paused.phase, "paused");
  assert.equal(resumed.phase, "planning");
  assert.equal(blocked.phase, "blocked");
  assert.equal(resumedFromBlocked.phase, "planning");
  assert.equal(cancelled.phase, "cancelled");
  assert.throws(() => transitionGoalPhase(cancelled, "planning", LATER), /terminal/i);
});

test("normalizeGoalStateForRestore maps legacy stopped state to cancelled", () => {
  const stopped = { ...createGoalState({ objective: "Legacy goal", now: NOW }), phase: "stopped" as const };
  const restored = normalizeGoalStateForRestore(stopped);

  assert.equal(restored.phase, "cancelled");
});

test("transitionGoalPhase rejects invalid phase jumps", () => {
  const goal = createGoalState({ objective: "Ship goal mode M1", now: NOW });

  assert.throws(() => transitionGoalPhase(goal, "done", LATER), /invalid/i);
});
