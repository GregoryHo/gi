import assert from "node:assert/strict";
import { test } from "node:test";

import { createGoalCommandRuntime } from "./commands.ts";
import {
  formatActiveGoalContext,
  handleGoalAgentEnd,
  registerGoalLoop,
} from "./loop.ts";
import { createGoalState, transitionGoalPhase } from "./state.ts";
import { markGoalModeInternalMessage } from "./messages.ts";

const NOW = new Date("2026-06-30T02:40:33.000Z");
const LATER = new Date("2026-06-30T02:41:00.000Z");

function runningGoal() {
  return transitionGoalPhase(createGoalState({
    objective: "Ship goal mode M1",
    acceptanceCriteria: ["tests pass"],
    now: NOW,
  }), "running_iteration", NOW);
}

test("formatActiveGoalContext injects compact goal loop instructions", () => {
  const context = formatActiveGoalContext(runningGoal());

  assert.match(context, /ACTIVE GOAL/);
  assert.match(context, /Ship goal mode M1/);
  assert.match(context, /goal_report/);
  assert.match(context, /max iterations/i);
});

test("formatActiveGoalContext includes compact source plan context", () => {
  const goal = runningGoal();
  goal.sourcePlan = {
    planId: "plan_1",
    title: "Ship M3",
    status: "approved",
    steps: [
      { step: 1, text: "Expose current plan", completed: true },
      { step: 2, text: "Start goal" },
    ],
  };

  const context = formatActiveGoalContext(goal);

  assert.match(context, /\[SOURCE PLAN\]/);
  assert.match(context, /id: plan_1/);
  assert.match(context, /title: Ship M3/);
  assert.match(context, /1\. \[advisory completed\] Expose current plan/);
  assert.match(context, /2\. Start goal/);
  assert.match(context, /advisory, not verification proof/i);
});

test("formatActiveGoalContext includes worker delegation guidance only when enabled", () => {
	const plainContext = formatActiveGoalContext(runningGoal());
	const goal = runningGoal();
	goal.workerDelegation = {
		enabled: true,
		workspace: "/tmp/project",
		allowedProfiles: ["verifier", "reviewer"],
		purpose: "independent verification",
	};

	const context = formatActiveGoalContext(goal);

	assert.doesNotMatch(plainContext, /\[WORKER DELEGATION\]/);
	assert.match(context, /\[WORKER DELEGATION\]/);
	assert.match(context, /allowed profiles: verifier, reviewer/);
	assert.match(context, /workspace: \/tmp\/project/);
	assert.match(context, /agent_worker_start/);
	assert.match(context, /agent_worker_(wait|status)/);
	assert.match(context, /worker summaries are evidence/i);
	assert.match(context, /implementer.*explicit workspace.*confirmation/i);
});

test("handleGoalAgentEnd continues after a continue report when limits allow", () => {
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  const sentMessages: string[] = [];
  runtime.activeGoal = {
    ...transitionGoalPhase(runningGoal(), "verifying", LATER),
    latestReport: {
      status: "continue",
      summary: "Commands done",
      verification: ["npm test passed"],
      completedCriteria: ["commands registered"],
      remainingCriteria: ["loop controller"],
      nextAction: "Implement loop controller",
    },
  };
  runtime.activeIteration = {
    goalId: runtime.activeGoal.id,
    runId: runtime.activeGoal.runId,
    iterationId: 1,
  };

  const result = handleGoalAgentEnd(runtime, {
    sendUserMessage(content: string) {
      sentMessages.push(content);
    },
  });

  assert.equal(result.action, "continue");
  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.equal(runtime.activeGoal.iterationCount, 1);
  assert.equal(runtime.activeIteration, undefined);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0] ?? "", /Implement loop controller/);
});

test("handleGoalAgentEnd does not continue paused or blocked goals", () => {
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  const sentMessages: string[] = [];
  runtime.activeGoal = {
    ...transitionGoalPhase(runningGoal(), "paused", LATER),
    latestReport: {
      status: "continue",
      summary: "Continue later",
      verification: ["manual inspection"],
      completedCriteria: [],
      remainingCriteria: ["resume"],
      nextAction: "Resume later",
    },
  };

  const paused = handleGoalAgentEnd(runtime, {
    sendUserMessage(content: string) {
      sentMessages.push(content);
    },
  });

  assert.deepEqual(paused, { action: "none", reason: "not_runnable" });
  assert.equal(runtime.activeGoal.phase, "paused");
  assert.equal(sentMessages.length, 0);

  runtime.activeGoal = {
    ...transitionGoalPhase(transitionGoalPhase(runningGoal(), "verifying", LATER), "blocked", LATER),
    latestReport: runtime.activeGoal.latestReport,
  };
  const blocked = handleGoalAgentEnd(runtime, { sendUserMessage(content: string) { sentMessages.push(content); } });

  assert.deepEqual(blocked, { action: "none", reason: "not_runnable" });
  assert.equal(runtime.activeGoal.phase, "blocked");
  assert.equal(sentMessages.length, 0);
});

test("handleGoalAgentEnd ignores ordinary turns without an active Goal Mode iteration", () => {
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = runningGoal();

  const result = handleGoalAgentEnd(runtime, { sendUserMessage() {} });

  assert.deepEqual(result, { action: "none", reason: "no_active_iteration" });
  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.equal(runtime.activeGoal.failureCount, 0);
  assert.equal(runtime.activeGoal.latestReport, undefined);
});

test("handleGoalAgentEnd finalizes reported verifying goals without an active iteration", () => {
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = {
		...transitionGoalPhase(runningGoal(), "verifying", LATER),
		latestReport: {
			status: "done",
			summary: "Fixture deleted",
			verification: ["rollback command reported success"],
			verificationEvidence: [{ kind: "command", reference: "git restore fixture", summary: "Rollback succeeded", status: "passed" }],
			completedCriteria: ["rolled back"],
			remainingCriteria: [],
		},
  };

  const result = handleGoalAgentEnd(runtime, { sendUserMessage() {} });

  assert.equal(result.action, "done");
  assert.equal(runtime.activeGoal.phase, "done");
  assert.equal(runtime.activeIteration, undefined);
});

test("handleGoalAgentEnd blocks done reports that have no verification evidence", () => {
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  const sentMessages: string[] = [];
  runtime.activeGoal = {
    ...transitionGoalPhase(runningGoal(), "verifying", LATER),
    latestReport: {
      status: "done",
      summary: "All done",
      verification: [],
      completedCriteria: ["all"],
      remainingCriteria: [],
    },
  };
  runtime.activeIteration = {
    goalId: runtime.activeGoal.id,
    runId: runtime.activeGoal.runId,
    iterationId: 1,
  };

  const result = handleGoalAgentEnd(runtime, {
    sendUserMessage(content: string) {
      sentMessages.push(content);
    },
  });

  assert.equal(result.action, "blocked");
  assert.equal(runtime.activeGoal.phase, "blocked");
  assert.equal(runtime.activeIteration, undefined);
  assert.match(runtime.activeGoal.latestReport?.blocker ?? "", /verification/i);
  assert.equal(sentMessages.length, 0);
});

test("handleGoalAgentEnd increments failures for missing reports and blocks at the limit", () => {
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = {
    ...runningGoal(),
    failureCount: 1,
    limits: { maxIterations: 8, maxFailures: 2, maxElapsedMs: 30 * 60 * 1000 },
  };
  runtime.activeIteration = {
    goalId: runtime.activeGoal.id,
    runId: runtime.activeGoal.runId,
    iterationId: 1,
  };

  const result = handleGoalAgentEnd(runtime, { sendUserMessage() {} });

  assert.equal(result.action, "blocked");
  assert.equal(runtime.activeGoal.phase, "blocked");
  assert.equal(runtime.activeIteration, undefined);
  assert.equal(runtime.activeGoal.failureCount, 2);
  assert.match(runtime.activeGoal.latestReport?.blocker ?? "", /missing goal_report/i);
});

test("registerGoalLoop wires before_agent_start and agent_end handlers", async () => {
  const handlers = new Map<string, Function>();
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = runningGoal();
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    sendUserMessage() {},
  };

  registerGoalLoop(pi, runtime);

  assert.equal(handlers.has("before_agent_start"), true);
  assert.equal(handlers.has("agent_end"), true);
  assert.equal(handlers.has("input"), true);
  const beforeResult = await handlers.get("before_agent_start")!({ systemPrompt: "base" }, {});
  assert.match(beforeResult.systemPrompt, /ACTIVE GOAL/);
});

test("registerGoalLoop accepts current runnable Goal Mode follow-up and advances expected iteration", async () => {
  const handlers = new Map<string, Function>();
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = runningGoal();
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    sendUserMessage() {},
  };

  registerGoalLoop(pi, runtime);

  const result = await handlers.get("input")!({
    source: "extension",
    text: markGoalModeInternalMessage("Continue Goal Mode with one bounded iteration.", {
      goalId: runtime.activeGoal.id,
      runId: runtime.activeGoal.runId,
      iterationId: runtime.activeGoal.nextIterationId,
    }),
  }, { ui: { notify() {} } });

  assert.deepEqual(result, { action: "transform", text: "Continue Goal Mode with one bounded iteration." });
  assert.equal(runtime.activeGoal.nextIterationId, 2);
  assert.deepEqual(runtime.activeIteration, {
    goalId: runtime.activeGoal.id,
    runId: runtime.activeGoal.runId,
    iterationId: 1,
  });
});

test("registerGoalLoop transitions accepted planning follow-up to running_iteration", async () => {
  const handlers = new Map<string, Function>();
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = createGoalState({ objective: "Start from goal_start", now: NOW });
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    sendUserMessage() {},
  };

  registerGoalLoop(pi, runtime);

  await handlers.get("input")!({
    source: "extension",
    text: markGoalModeInternalMessage("Start the bounded goal loop.", {
      goalId: runtime.activeGoal.id,
      runId: runtime.activeGoal.runId,
      iterationId: runtime.activeGoal.nextIterationId,
    }),
  }, { ui: { notify() {} } });

  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.equal(runtime.activeGoal.nextIterationId, 2);
  assert.deepEqual(runtime.activeIteration, {
    goalId: runtime.activeGoal.id,
    runId: runtime.activeGoal.runId,
    iterationId: 1,
  });
});

test("registerGoalLoop blocks stale queued Goal Mode follow-ups after stop", async () => {
  const handlers = new Map<string, Function>();
  const notifications: string[] = [];
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = { ...runningGoal(), phase: "cancelled" };
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    sendUserMessage() {},
  };

  registerGoalLoop(pi, runtime);

  const result = await handlers.get("input")!({
    source: "extension",
    text: markGoalModeInternalMessage("Continue Goal Mode with one bounded iteration.", {
      goalId: runtime.activeGoal.id,
      runId: runtime.activeGoal.runId,
      iterationId: runtime.activeGoal.nextIterationId,
    }),
  }, {
    ui: {
      notify(message: string) {
        notifications.push(message);
      },
    },
  });

  assert.deepEqual(result, { action: "handled" });
  assert.equal(runtime.activeIteration, undefined);
  assert.match(notifications.at(-1) ?? "", /discarded stale/i);
});

test("registerGoalLoop blocks token mismatched and paused Goal Mode follow-ups", async () => {
  const handlers = new Map<string, Function>();
  const notifications: string[] = [];
  const runtime = createGoalCommandRuntime({ now: () => LATER });
  runtime.activeGoal = runningGoal();
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
    sendUserMessage() {},
  };

  registerGoalLoop(pi, runtime);

  const wrongToken = await handlers.get("input")!({
    source: "extension",
    text: markGoalModeInternalMessage("Continue", {
      goalId: runtime.activeGoal.id,
      runId: "old_run",
      iterationId: runtime.activeGoal.nextIterationId,
    }),
  }, { ui: { notify(message: string) { notifications.push(message); } } });

  runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "paused", LATER);
  const paused = await handlers.get("input")!({
    source: "extension",
    text: markGoalModeInternalMessage("Continue", {
      goalId: runtime.activeGoal.id,
      runId: runtime.activeGoal.runId,
      iterationId: runtime.activeGoal.nextIterationId,
    }),
  }, { ui: { notify(message: string) { notifications.push(message); } } });

  assert.deepEqual(wrongToken, { action: "handled" });
  assert.deepEqual(paused, { action: "handled" });
  assert.match(notifications.join("\n"), /discarded stale/i);
});
