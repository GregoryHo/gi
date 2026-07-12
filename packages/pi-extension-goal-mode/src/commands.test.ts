import assert from "node:assert/strict";
import { test } from "node:test";

import { createGoalCommandRuntime, registerGoalCommands } from "./commands.ts";
import { createGoalState, transitionGoalPhase } from "./state.ts";

const NOW = new Date("2026-06-30T02:40:33.000Z");
const LATER = new Date("2026-06-30T02:41:00.000Z");

interface RegisteredCommand {
  description?: string;
  getArgumentCompletions?: (prefix: string) => Array<{ value: string }> | null;
  handler(args: string, ctx: FakeCommandContext): Promise<void> | void;
}

interface FakeCommandContext {
  ui: {
    notify(message: string, level?: "info" | "error" | "warning"): void;
  };
  isIdle?(): boolean;
  abort?(): void;
}

function createHarness(now = () => NOW) {
  const commands = new Map<string, RegisteredCommand>();
  const notifications: Array<{ message: string; level?: "info" | "error" | "warning" }> = [];
  const sentMessages: Array<{ content: string; options?: { deliverAs?: string } }> = [];
  const runtime = createGoalCommandRuntime({ now });
  const pi = {
    registerCommand(name: string, command: RegisteredCommand) {
      commands.set(name, command);
    },
    sendUserMessage(content: string, options?: { deliverAs?: string }) {
      sentMessages.push({ content, options });
    },
  };
  const ctx: FakeCommandContext = {
    ui: {
      notify(message: string, level?: "info" | "error" | "warning") {
        notifications.push({ message, level });
      },
    },
  };

  registerGoalCommands(pi, runtime);
  return { commands, notifications, sentMessages, runtime, ctx };
}

test("registerGoalCommands registers goal lifecycle commands", () => {
  const { commands } = createHarness();

  assert.deepEqual([...commands.keys()].sort(), ["goal", "goal-pause", "goal-resume", "goal-status", "goal-step", "goal-stop"]);
});

test("/goal routes lifecycle subcommands while preserving legacy aliases", async () => {
  const { commands, notifications, runtime, ctx } = createHarness();
  runtime.activeGoal = createGoalState({ objective: "Existing goal", now: NOW });

  assert.deepEqual(commands.get("goal")?.getArgumentCompletions?.("res")?.map((item) => item.value), ["resume"]);
  await commands.get("goal")!.handler("status", ctx);
  assert.match(notifications.at(-1)?.message ?? "", /Existing goal/);

  await commands.get("goal")!.handler("pause", ctx);
  assert.equal(runtime.activeGoal.phase, "paused");

  await commands.get("goal")!.handler("resume", ctx);
  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.ok(commands.has("goal-status"));
  assert.ok(commands.has("goal-pause"));
});

test("/goal rejects empty objectives", async () => {
  const { commands, notifications, runtime, ctx } = createHarness();

  await commands.get("goal")!.handler("   ", ctx);

  assert.equal(runtime.activeGoal, undefined);
  assert.match(notifications.at(-1)?.message ?? "", /objective/i);
  assert.equal(notifications.at(-1)?.level, "error");
});

test("/goal starts a tracked goal and queues the first bounded iteration", async () => {
  const { commands, notifications, sentMessages, runtime, ctx } = createHarness();

  await commands.get("goal")!.handler("Ship goal mode M1", ctx);

  assert.equal(runtime.activeGoal?.objective, "Ship goal mode M1");
  assert.equal(runtime.activeGoal?.phase, "planning");
  assert.match(notifications.at(-1)?.message ?? "", /started/i);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.content ?? "", /Ship goal mode M1/);
  assert.equal(sentMessages[0]?.options?.deliverAs, "followUp");
});

test("/goal refuses to replace an active non-terminal goal", async () => {
  const { commands, notifications, runtime, ctx } = createHarness();
  runtime.activeGoal = createGoalState({ objective: "Existing goal", now: NOW });

  await commands.get("goal")!.handler("New goal", ctx);

  assert.equal(runtime.activeGoal.objective, "Existing goal");
  assert.match(notifications.at(-1)?.message ?? "", /already active/i);
  assert.equal(notifications.at(-1)?.level, "warning");
});

test("/goal-status reports no-goal, active, resumable, and terminal guidance", async () => {
  const { commands, notifications, runtime, ctx } = createHarness();

  await commands.get("goal-status")!.handler("", ctx);
  assert.match(notifications.at(-1)?.message ?? "", /No goal/i);
  assert.match(notifications.at(-1)?.message ?? "", /\/goal <objective>/);

  runtime.activeGoal = createGoalState({ objective: "Existing goal", now: NOW });
  await commands.get("goal-status")!.handler("", ctx);
  assert.match(notifications.at(-1)?.message ?? "", /Existing goal/);
  assert.match(notifications.at(-1)?.message ?? "", /planning/);
  assert.match(notifications.at(-1)?.message ?? "", /\/goal-pause/);

  runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "paused", LATER);
  await commands.get("goal-status")!.handler("", ctx);
  assert.match(notifications.at(-1)?.message ?? "", /resumable/i);
  assert.match(notifications.at(-1)?.message ?? "", /\/goal-resume/);

  runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "cancelled", LATER);
  await commands.get("goal-status")!.handler("", ctx);
  assert.match(notifications.at(-1)?.message ?? "", /terminal/i);
  assert.match(notifications.at(-1)?.message ?? "", /\/goal <objective>/);
});

test("/goal-status does not recommend resume when objective limits are exhausted", async () => {
	const afterLimit = new Date(NOW.getTime() + 30 * 60 * 1000);
	const { commands, notifications, runtime, ctx } = createHarness(() => afterLimit);
	runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Expired goal", now: NOW }), "blocked", NOW);

	await commands.get("goal-status")!.handler("", ctx);

	assert.match(notifications.at(-1)?.message ?? "", /limit exhausted/i);
	assert.match(notifications.at(-1)?.message ?? "", /\/goal-stop/);
	assert.doesNotMatch(notifications.at(-1)?.message ?? "", /\/goal-resume/);
});

test("/goal-pause pauses an active goal without aborting", async () => {
  const { commands, notifications, runtime, ctx } = createHarness(() => LATER);
  let abortCount = 0;
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Existing goal", now: NOW }), "running_iteration", NOW);
  ctx.isIdle = () => false;
  ctx.abort = () => {
    abortCount += 1;
  };

  await commands.get("goal-pause")!.handler("", ctx);

  assert.equal(runtime.activeGoal.phase, "paused");
  assert.equal(abortCount, 0);
  assert.match(notifications.at(-1)?.message ?? "", /paused/i);
});

test("/goal-resume resumes paused and blocked goals with a new run token and queues one iteration", async () => {
  const { commands, notifications, runtime, sentMessages, ctx } = createHarness(() => LATER);
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Existing goal", now: NOW }), "paused", NOW);
  const oldRunId = runtime.activeGoal.runId;

  await commands.get("goal-resume")!.handler("", ctx);

  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.notEqual(runtime.activeGoal.runId, oldRunId);
  assert.equal(runtime.activeGoal.runId, "run_20260630_024100");
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.content ?? "", /Existing goal/);
  assert.match(notifications.at(-1)?.message ?? "", /resumed/i);
});

test("/goal-resume rejects goals whose objective limits are exhausted", async () => {
	const afterLimit = new Date(NOW.getTime() + 30 * 60 * 1000);
	const { commands, notifications, runtime, sentMessages, ctx } = createHarness(() => afterLimit);
	runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Expired goal", now: NOW }), "blocked", NOW);

	await commands.get("goal-resume")!.handler("", ctx);

	assert.equal(runtime.activeGoal.phase, "blocked");
	assert.equal(sentMessages.length, 0);
	assert.match(notifications.at(-1)?.message ?? "", /cancel.*start/i);
	assert.equal(notifications.at(-1)?.level, "warning");
});

test("/goal-resume rejects done and cancelled goals", async () => {
  const { commands, notifications, runtime, sentMessages, ctx } = createHarness(() => LATER);
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Existing goal", now: NOW }), "cancelled", NOW);

  await commands.get("goal-resume")!.handler("", ctx);

  assert.equal(runtime.activeGoal.phase, "cancelled");
  assert.equal(sentMessages.length, 0);
  assert.match(notifications.at(-1)?.message ?? "", /cannot resume/i);
});

test("/goal-stop marks active goal cancelled", async () => {
  const { commands, notifications, runtime, ctx } = createHarness(() => LATER);
  runtime.activeGoal = createGoalState({ objective: "Existing goal", now: NOW });

  await commands.get("goal-stop")!.handler("", ctx);

  assert.equal(runtime.activeGoal.phase, "cancelled");
  assert.equal(runtime.activeGoal.updatedAt, LATER.toISOString());
  assert.match(notifications.at(-1)?.message ?? "", /cancelled/i);
});

test("/goal-stop aborts the current agent operation when invoked while busy", async () => {
  const { commands, notifications, runtime, ctx } = createHarness(() => LATER);
  let abortCount = 0;
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Existing goal", now: NOW }), "running_iteration", NOW);
  ctx.isIdle = () => false;
  ctx.abort = () => {
    abortCount += 1;
  };

  await commands.get("goal-stop")!.handler("", ctx);

  assert.equal(runtime.activeGoal.phase, "cancelled");
  assert.equal(abortCount, 1);
  assert.match(notifications.at(-1)?.message ?? "", /aborted/i);
});

test("/goal-step refuses paused and blocked goals", async () => {
  const { commands, notifications, runtime, sentMessages, ctx } = createHarness(() => LATER);
  runtime.activeGoal = transitionGoalPhase(createGoalState({ objective: "Existing goal", now: NOW }), "paused", NOW);

  await commands.get("goal-step")!.handler("", ctx);

  assert.equal(sentMessages.length, 0);
  assert.match(notifications.at(-1)?.message ?? "", /resume/i);
});

test("/goal-step queues at most one iteration for an active non-terminal goal", async () => {
  const { commands, notifications, runtime, sentMessages, ctx } = createHarness(() => LATER);
  runtime.activeGoal = createGoalState({ objective: "Existing goal", now: NOW });

  await commands.get("goal-step")!.handler("", ctx);

  assert.equal(runtime.activeGoal.phase, "running_iteration");
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]?.content ?? "", /one bounded iteration/i);
  assert.match(notifications.at(-1)?.message ?? "", /queued/i);
});
