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
  parameters?: unknown;
  execute(toolCallId: string, params: Record<string, unknown>): Promise<{ content: Array<{ type: "text"; text: string }>; details?: Record<string, unknown> }>;
}

function createHarness(now = () => LATER) {
  const tools = new Map<string, RegisteredTool>();
  const runtime = createGoalCommandRuntime({ now });
  const pi = {
    registerTool(tool: unknown) {
      const registered = tool as RegisteredTool;
      tools.set(registered.name, registered);
    },
  };

  registerGoalReportTool(pi, runtime);
  return { tools, runtime };
}

test("registerGoalReportTool registers goal_report", () => {
  const { tools } = createHarness();

  assert.deepEqual([...tools.keys()], ["goal_report"]);
  assert.match(tools.get("goal_report")?.description ?? "", /goal/i);
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
