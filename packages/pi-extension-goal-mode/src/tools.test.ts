import assert from "node:assert/strict";
import { test } from "node:test";

import { createGoalCommandRuntime } from "./commands.ts";
import { registerGoalReportTool } from "./tools.ts";
import { createGoalState, transitionGoalPhase } from "./state.ts";

const NOW = new Date("2026-06-30T02:40:33.000Z");
const LATER = new Date("2026-06-30T02:41:00.000Z");

interface RegisteredTool {
  name: string;
  description?: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters?: unknown;
  execute(toolCallId: string, params: Record<string, unknown>): Promise<{ content: Array<{ type: "text"; text: string }>; details?: Record<string, unknown> }>;
}

function createHarness(now = () => LATER) {
  const tools = new Map<string, RegisteredTool>();
  const sentMessages: Array<{ content: string; options?: unknown }> = [];
  const runtime = createGoalCommandRuntime({ now });
  const pi = {
    registerTool(tool: unknown) {
      const registered = tool as RegisteredTool;
      tools.set(registered.name, registered);
    },
    sendUserMessage(content: string, options?: unknown) {
      sentMessages.push({ content, options });
    },
  };

  registerGoalReportTool(pi, runtime);
  return { tools, runtime, sentMessages };
}

test("registerGoalReportTool registers goal tools", () => {
  const { tools } = createHarness();

  assert.deepEqual([...tools.keys()].sort(), ["goal_control", "goal_report", "goal_start", "goal_status"]);
  assert.match(tools.get("goal_control")?.description ?? "", /pause|resume|cancel/i);
  assert.match(tools.get("goal_report")?.description ?? "", /goal/i);
  assert.match(tools.get("goal_status")?.description ?? "", /current goal/i);
  assert.match(tools.get("goal_start")?.description ?? "", /bounded/i);
  assert.match(tools.get("goal_start")?.promptGuidelines?.join("\n") ?? "", /explicitly asks/);
  assert.match(tools.get("goal_start")?.promptGuidelines?.join("\n") ?? "", /sourcePlan/);
  assert.doesNotMatch(tools.get("goal_start")?.promptGuidelines?.join("\n") ?? "", /plan_get_current|Plan Mode/);
  assert.match(tools.get("goal_status")?.promptGuidelines?.join("\n") ?? "", /goal_control\(resume\)/);
  assert.match(tools.get("goal_control")?.promptGuidelines?.join("\n") ?? "", /starting a duplicate goal/);
});

test("goal_status returns found false when no goal is active", async () => {
  const { tools } = createHarness();

  const result = await tools.get("goal_status")!.execute("call_1", {});

  assert.equal(result.details?.found, false);
  assert.deepEqual(result.details?.nextAllowedActions, ["start"]);
  assert.match(result.content[0]?.text ?? "", /No active goal/i);
});

test("goal_status reports blocked goal context and next actions", async () => {
  const { tools, runtime } = createHarness();
  runtime.activeGoal = transitionGoalPhase(createGoalState({
    objective: "Complete sourced plan",
    now: NOW,
    sourcePlan: {
      planId: "plan_1",
      title: "Ship M3",
      steps: [{ step: 1, text: "Expose plan" }],
    },
  }), "blocked", NOW);
  runtime.activeGoal.latestReport = {
    status: "blocked",
    summary: "Plan gate blocked verification",
    verification: ["npm test was blocked by Plan Mode"],
    completedCriteria: ["plan read"],
    remainingCriteria: ["run tests"],
    blocker: "Plan Mode is still enabled",
  };

  const result = await tools.get("goal_status")!.execute("call_1", {});

  assert.equal(result.details?.found, true);
  assert.equal(result.details?.phase, "blocked");
  assert.equal(result.details?.objective, "Complete sourced plan");
  assert.equal(result.details?.blocker, "Plan Mode is still enabled");
  assert.deepEqual(result.details?.nextAllowedActions, ["resume", "cancel"]);
  assert.deepEqual(result.details?.sourcePlan, runtime.activeGoal.sourcePlan);
  assert.deepEqual(result.details?.latestReport, runtime.activeGoal.latestReport);
});

test("goal_control returns compact no-active-goal guidance", async () => {
  const { tools } = createHarness();

  const result = await tools.get("goal_control")!.execute("call_1", { action: "resume" });

  assert.equal(result.details?.accepted, false);
  assert.equal(result.details?.reason, "no_active_goal");
  assert.deepEqual(result.details?.nextAllowedActions, ["start"]);
  assert.match(result.content[0]?.text ?? "", /No goal to control/i);
});

test("goal_control validates action values", async () => {
  const { tools, runtime } = createHarness();
  runtime.activeGoal = createGoalState({ objective: "Validate control", now: NOW });

  await assert.rejects(() => tools.get("goal_control")!.execute("call_1", { action: "restart" }), /goal_control action/i);
});

test("goal_control resumes blocked goal and queues exactly one iteration preserving sourcePlan", async () => {
  const { tools, runtime, sentMessages } = createHarness(() => LATER);
  runtime.activeGoal = transitionGoalPhase(createGoalState({
    objective: "Resume sourced plan",
    now: NOW,
    sourcePlan: {
      planId: "plan_1",
      title: "Ship M3",
      steps: [{ step: 1, text: "Expose plan" }],
    },
  }), "blocked", NOW);

  const result = await tools.get("goal_control")!.execute("call_1", { action: "resume" });

  assert.equal(result.details?.accepted, true);
  assert.equal(result.details?.phase, "running_iteration");
  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.equal(runtime.activeGoal.runId, "run_20260630_024100");
  assert.equal(runtime.activeGoal.sourcePlan?.planId, "plan_1");
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.content ?? "", /Resume the bounded goal loop/);
  assert.deepEqual(sentMessages[0]?.options, { deliverAs: "followUp" });
});

test("goal_control pauses runnable goals and cancels non-terminal goals", async () => {
  const { tools, runtime, sentMessages } = createHarness(() => LATER);
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Control lifecycle", now: NOW }), "running_iteration", NOW);

  const pauseResult = await tools.get("goal_control")!.execute("call_1", { action: "pause" });
  const cancelResult = await tools.get("goal_control")!.execute("call_2", { action: "cancel" });
  const resumeCancelled = await tools.get("goal_control")!.execute("call_3", { action: "resume" });

  assert.equal(pauseResult.details?.accepted, true);
  assert.equal(pauseResult.details?.phase, "paused");
  assert.equal(cancelResult.details?.accepted, true);
  assert.equal(cancelResult.details?.phase, "cancelled");
  assert.equal(resumeCancelled.details?.accepted, false);
  assert.equal(runtime.activeGoal.phase, "cancelled");
  assert.equal(sentMessages.length, 0);
});

test("goal_control step queues only planning goals and does not bypass paused goals", async () => {
  const { tools, runtime, sentMessages } = createHarness(() => LATER);
  runtime.activeGoal = createGoalState({ objective: "Step lifecycle", now: NOW });

  const stepResult = await tools.get("goal_control")!.execute("call_1", { action: "step" });
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Paused lifecycle", now: NOW }), "paused", NOW);
  const pausedStep = await tools.get("goal_control")!.execute("call_2", { action: "step" });

  assert.equal(stepResult.details?.accepted, true);
  assert.equal(stepResult.details?.phase, "running_iteration");
  assert.equal(pausedStep.details?.accepted, false);
  assert.equal(runtime.activeGoal.phase, "paused");
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.content ?? "", /Run one bounded iteration/);
});

test("goal_start starts a bounded goal, queues first iteration, and preserves sourcePlan", async () => {
  const { tools, runtime, sentMessages } = createHarness(() => NOW);

  const result = await tools.get("goal_start")!.execute("call_1", {
    objective: "Use goal to complete the current plan",
    acceptanceCriteria: ["tests pass"],
    sourcePlan: {
      planId: "plan_1",
      title: "Ship M3",
      status: "approved",
      steps: [
        { step: 1, text: "Expose current plan", completed: true },
        { step: 2, text: "Start goal" },
      ],
    },
  });

  assert.equal(runtime.activeGoal?.objective, "Use goal to complete the current plan");
  assert.deepEqual(runtime.activeGoal?.acceptanceCriteria, ["tests pass"]);
  assert.equal(runtime.activeGoal?.sourcePlan?.planId, "plan_1");
  assert.deepEqual(runtime.activeGoal?.sourcePlan?.steps, [
    { step: 1, text: "Expose current plan", completed: true },
    { step: 2, text: "Start goal" },
  ]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.content ?? "", /Use goal to complete the current plan/);
  assert.deepEqual(sentMessages[0]?.options, { deliverAs: "followUp" });
  assert.equal(result.details?.accepted, true);
  assert.equal(result.details?.goalId, runtime.activeGoal?.id);
});

test("goal_start rejects active and resumable goals", async () => {
  const { tools, runtime, sentMessages } = createHarness(() => NOW);
  runtime.activeGoal = createGoalState({ objective: "Existing goal", now: NOW });

  const activeResult = await tools.get("goal_start")!.execute("call_1", { objective: "New goal" });
  runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "paused", NOW);
  const pausedResult = await tools.get("goal_start")!.execute("call_2", { objective: "New goal" });

  assert.equal(activeResult.details?.accepted, false);
  assert.equal(pausedResult.details?.accepted, false);
  assert.deepEqual(pausedResult.details?.nextAllowedActions, ["resume", "cancel"]);
  assert.match(activeResult.content[0]?.text ?? "", /goal_status/i);
  assert.match(activeResult.content[0]?.text ?? "", /goal_control/i);
  assert.equal(runtime.activeGoal.objective, "Existing goal");
  assert.equal(sentMessages.length, 0);
});

test("goal_report returns a compact no-active-goal result when no goal is active", async () => {
  const { tools } = createHarness();

  const result = await tools.get("goal_report")!.execute("call_1", {
    status: "continue",
    summary: "Did one thing",
    verification: ["not run yet"],
    completedCriteria: [],
    remainingCriteria: ["tests pass"],
  });

  assert.match(result.content[0]?.text ?? "", /No active goal/i);
  assert.equal(result.details?.accepted, false);
});

test("goal_report validates status values", async () => {
  const { tools, runtime } = createHarness();
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Ship goal mode M1", now: NOW }), "running_iteration", NOW);

  await assert.rejects(() => tools.get("goal_report")!.execute("call_1", {
    status: "maybe",
    summary: "Did one thing",
    verification: ["not run yet"],
    completedCriteria: [],
    remainingCriteria: ["tests pass"],
  }), /status/i);
});

test("goal_report records structured progress and moves the goal to verifying", async () => {
  const { tools, runtime } = createHarness();
  runtime.activeGoal = transitionGoalPhase(createGoalState({
    objective: "Ship goal mode M1",
    acceptanceCriteria: ["tests pass"],
    now: NOW,
  }), "running_iteration", NOW);

  const result = await tools.get("goal_report")!.execute("call_1", {
    status: "continue",
    summary: "Implemented command adapter",
    verification: ["npm test --workspace @gregho/pi-extension-goal-mode passed"],
    completedCriteria: ["commands registered"],
    remainingCriteria: ["loop controller"],
    nextAction: "Implement loop controller",
  });

  assert.equal(runtime.activeGoal.phase, "verifying");
  assert.equal(runtime.activeGoal.updatedAt, LATER.toISOString());
  assert.deepEqual(runtime.activeGoal.latestReport, {
    status: "continue",
    summary: "Implemented command adapter",
    verification: ["npm test --workspace @gregho/pi-extension-goal-mode passed"],
    completedCriteria: ["commands registered"],
    remainingCriteria: ["loop controller"],
    nextAction: "Implement loop controller",
  });
  assert.match(result.content[0]?.text ?? "", /recorded/i);
  assert.equal(result.details?.accepted, true);
  assert.equal(result.details?.status, "continue");
});

test("goal_report records paused goal progress without resuming", async () => {
  const { tools, runtime } = createHarness();
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Ship goal mode M2", now: NOW }), "paused", NOW);

  const result = await tools.get("goal_report")!.execute("call_1", {
    status: "continue",
    summary: "Paused progress noted",
    verification: ["manual inspection"],
    completedCriteria: [],
    remainingCriteria: ["resume later"],
  });

  assert.equal(runtime.activeGoal.phase, "paused");
  assert.equal(runtime.activeGoal.latestReport?.summary, "Paused progress noted");
  assert.equal(result.details?.accepted, true);
  assert.equal(result.details?.phase, "paused");
});

test("goal_report rejects terminal done and cancelled goals", async () => {
  const { tools, runtime } = createHarness();
  runtime.activeGoal = transitionGoalPhase(
    transitionGoalPhase(createGoalState({ objective: "Ship goal mode M2", now: NOW }), "running_iteration", NOW),
    "cancelled",
    NOW,
  );

  const result = await tools.get("goal_report")!.execute("call_1", {
    status: "continue",
    summary: "Should not record",
    verification: ["not relevant"],
    completedCriteria: [],
    remainingCriteria: [],
  });

  assert.equal(result.details?.accepted, false);
  assert.match(result.content[0]?.text ?? "", /not accepting/i);
});
