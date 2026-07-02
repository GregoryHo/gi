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

  assert.deepEqual([...tools.keys()].sort(), ["goal_report", "goal_start"]);
  assert.match(tools.get("goal_report")?.description ?? "", /goal/i);
  assert.match(tools.get("goal_start")?.description ?? "", /bounded/i);
  assert.match(tools.get("goal_start")?.promptGuidelines?.join("\n") ?? "", /plan_get_current first/);
  assert.match(tools.get("goal_start")?.promptGuidelines?.join("\n") ?? "", /explicitly asks/);
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
