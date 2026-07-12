import assert from "node:assert/strict";
import { test } from "node:test";

import { createGoalCommandRuntime } from "./commands.ts";
import {
  formatGoalStatusLine,
  GOAL_STATE_ENTRY_TYPE,
  registerGoalPersistenceAndUi,
} from "./persistence.ts";
import { createGoalState, transitionGoalPhase } from "./state.ts";

const NOW = new Date("2026-06-30T02:40:33.000Z");

function createHarness() {
  const handlers = new Map<string, Function>();
  const appended: Array<{ customType: string; data: unknown }> = [];
  const statuses: Array<{ key: string; value: string | undefined }> = [];
	const notifications: Array<{ message: string; level?: string }> = [];
  const runtime = createGoalCommandRuntime({ now: () => NOW });
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    appendEntry(customType: string, data: unknown) {
      appended.push({ customType, data });
    },
  };
  const ctx = {
    sessionManager: {
      getEntries() {
        return [] as unknown[];
      },
    },
    ui: {
      setStatus(key: string, value: string | undefined) {
        statuses.push({ key, value });
      },
		notify(message: string, level?: string) {
			notifications.push({ message, level });
		},
    },
  };

  registerGoalPersistenceAndUi(pi, runtime);
  return { handlers, appended, statuses, notifications, runtime, ctx };
}

test("formatGoalStatusLine renders compact footer status", () => {
  const goal = transitionGoalPhase(createGoalState({ objective: "Ship goal mode M1", now: NOW }), "running_iteration", NOW);

  assert.match(formatGoalStatusLine(goal), /goal/i);
  assert.match(formatGoalStatusLine(goal), /running_iteration/);
  assert.match(formatGoalStatusLine(goal), /0\/8/);
});

test("formatGoalStatusLine includes a compact blocker for blocked goals", () => {
	const goal = transitionGoalPhase(createGoalState({ objective: "Ship goal mode M1", now: NOW }), "blocked", NOW);
	goal.latestReport = {
		status: "blocked",
		summary: "Cannot continue",
		verification: [],
		completedCriteria: [],
		remainingCriteria: ["tests pass"],
		blocker: "Plan Mode is still enabled",
	};

	const status = formatGoalStatusLine(goal);

	assert.match(status, /blocked/);
	assert.match(status, /Plan Mode is still enabled/);
});

test("formatGoalStatusLine truncates long objectives for the footer", () => {
  const goal = transitionGoalPhase(createGoalState({
		objective: "Complete the current plan: manually test Plan Mode and Goal Mode interaction scenarios in an isolated disposable fixture, then roll back any test changes.",
		now: NOW,
  }), "running_iteration", NOW);

  const status = formatGoalStatusLine(goal);

  assert.equal(status.length <= 96, true);
  assert.match(status, /…$/);
  assert.doesNotMatch(status, /then roll back any test changes/);
});

test("registerGoalPersistenceAndUi restores latest goal state on session_start", async () => {
  const { handlers, runtime, statuses, ctx } = createHarness();
  const restored = createGoalState({ objective: "Restored goal", now: NOW });
  ctx.sessionManager.getEntries = () => [
    { type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: createGoalState({ objective: "Old goal", now: NOW }) } },
    { type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: restored } },
  ];

  await handlers.get("session_start")!({}, ctx);

  assert.equal(runtime.activeGoal?.objective, "Restored goal");
  assert.equal(statuses.at(-1)?.key, "goal-mode");
  assert.match(statuses.at(-1)?.value ?? "", /Restored goal/);
});

test("registerGoalPersistenceAndUi restores sourcePlan with goal state", async () => {
  const { handlers, runtime, ctx } = createHarness();
  const restored = createGoalState({
    objective: "Restore sourced goal",
    now: NOW,
    sourcePlan: {
      planId: "plan_1",
      title: "Ship M3",
      steps: [{ step: 1, text: "Expose plan" }],
    },
  });
  ctx.sessionManager.getEntries = () => [
    { type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: restored } },
  ];

  await handlers.get("session_start")!({}, ctx);

  assert.deepEqual(runtime.activeGoal?.sourcePlan, restored.sourcePlan);
  assert.notEqual(runtime.activeGoal?.sourcePlan, restored.sourcePlan);
});

test("registerGoalPersistenceAndUi restores workerDelegation with goal state", async () => {
	const { handlers, runtime, ctx } = createHarness();
	const restored = createGoalState({
		objective: "Restore worker-assisted goal",
		now: NOW,
		workerDelegation: {
			enabled: true,
			workspace: "/tmp/project",
			allowedProfiles: ["verifier"],
			purpose: "independent verification",
		},
	});
	ctx.sessionManager.getEntries = () => [
		{ type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: restored } },
	];

	await handlers.get("session_start")!({}, ctx);

	assert.deepEqual(runtime.activeGoal?.workerDelegation, restored.workerDelegation);
	assert.notEqual(runtime.activeGoal?.workerDelegation, restored.workerDelegation);
});

test("registerGoalPersistenceAndUi normalizes legacy stopped state to cancelled on restore", async () => {
  const { handlers, runtime, ctx } = createHarness();
  const legacyStopped = { ...createGoalState({ objective: "Legacy stopped", now: NOW }), phase: "stopped" };
  ctx.sessionManager.getEntries = () => [
    { type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: legacyStopped } },
  ];

  await handlers.get("session_start")!({}, ctx);

  assert.equal(runtime.activeGoal?.phase, "cancelled");
});

test("registerGoalPersistenceAndUi settles restored verifying done reports and clears status", async () => {
  const { handlers, runtime, statuses, ctx } = createHarness();
  const restored = {
		...transitionGoalPhase(createGoalState({ objective: "Finished goal", now: NOW }), "running_iteration", NOW),
		phase: "verifying" as const,
		latestReport: {
			status: "done" as const,
			summary: "Finished",
			verification: ["tests passed"],
			completedCriteria: ["all done"],
			remainingCriteria: [],
		},
  };
  ctx.sessionManager.getEntries = () => [
		{ type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: restored } },
  ];

  await handlers.get("session_start")!({}, ctx);

  assert.equal(runtime.activeGoal?.phase, "done");
  assert.deepEqual(statuses.at(-1), { key: "goal-mode", value: undefined });
});

test("runtime onChange persists active goal and updates status", async () => {
  const { handlers, runtime, appended, statuses, ctx } = createHarness();
  await handlers.get("session_start")!({}, ctx);
  runtime.activeGoal = createGoalState({ objective: "Persisted goal", now: NOW });

  runtime.onChange?.();

  assert.equal(appended.length, 1);
  assert.equal(appended[0]?.customType, GOAL_STATE_ENTRY_TYPE);
  assert.deepEqual(appended[0]?.data, { activeGoal: runtime.activeGoal });
  assert.match(statuses.at(-1)?.value ?? "", /Persisted goal/);
});

test("runtime onChange notifies once when a goal reaches done", async () => {
	const { handlers, runtime, notifications, ctx } = createHarness();
	const running = transitionGoalPhase(createGoalState({ objective: "Finished goal", now: NOW }), "running_iteration", NOW);
	ctx.sessionManager.getEntries = () => [
		{ type: "custom", customType: GOAL_STATE_ENTRY_TYPE, data: { activeGoal: running } },
	];
	await handlers.get("session_start")!({}, ctx);

	runtime.activeGoal = {
		...transitionGoalPhase({ ...running, phase: "verifying" }, "done", NOW),
		latestReport: {
			status: "done",
			summary: "All checks passed",
			verification: ["tests passed"],
			completedCriteria: ["all done"],
			remainingCriteria: [],
		},
	};
	runtime.onChange?.();
	runtime.onChange?.();

	assert.deepEqual(notifications, [{ message: "Goal done: Finished goal", level: "info" }]);
});

test("runtime onChange clears status when no goal is active", async () => {
  const { handlers, runtime, statuses, ctx } = createHarness();
  await handlers.get("session_start")!({}, ctx);

  runtime.onChange?.();

  assert.deepEqual(statuses.at(-1), { key: "goal-mode", value: undefined });
});
