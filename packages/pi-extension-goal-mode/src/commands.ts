import { markGoalModeInternalMessage, type GoalModeInternalMessageMetadata } from "./messages.ts";
import type { ActiveGoalState } from "./state.ts";
import { createGoalState, getGoalLimitBlocker, isResumableGoalPhase, isRunnableGoalPhase, isTerminalGoalPhase, renewGoalRun, transitionGoalPhase } from "./state.ts";

interface GoalCommandDefinition {
  description?: string;
  getArgumentCompletions?: (prefix: string) => Array<{ value: string; label: string }> | null;
  handler(args: string, ctx: GoalCommandContext): Promise<void>;
}

interface GoalCommandRegistry {
  registerCommand(name: string, command: GoalCommandDefinition): void;
  sendUserMessage?(content: string, options?: { deliverAs?: "followUp" | "steer" | "nextTurn" }): void;
}

interface GoalCommandContext {
  ui: {
    notify(message: string, level?: "info" | "error" | "warning"): void;
  };
  isIdle?(): boolean;
  abort?(): void;
}

export interface GoalCommandRuntime {
  activeGoal?: ActiveGoalState;
  activeIteration?: GoalModeInternalMessageMetadata;
  now(): Date;
  onChange?(): void;
}

export interface CreateGoalCommandRuntimeOptions {
  now?: () => Date;
}

export function createGoalCommandRuntime(options: CreateGoalCommandRuntimeOptions = {}): GoalCommandRuntime {
  return {
    now: options.now ?? (() => new Date()),
  };
}

const GOAL_SUBCOMMANDS = ["start", "status", "pause", "resume", "stop", "cancel", "step"] as const;

export function registerGoalCommands(pi: GoalCommandRegistry, runtime: GoalCommandRuntime = createGoalCommandRuntime()): void {
  const lifecycleCommands = new Map<string, GoalCommandDefinition>();
  const registerLifecycleCommand = (name: string, command: GoalCommandDefinition): void => {
	lifecycleCommands.set(name, command);
	pi.registerCommand(name, command);
  };

  pi.registerCommand("goal", {
	description: "Start or control a bounded goal loop: start, status, pause, resume, stop, cancel, or step.",
	getArgumentCompletions: (prefix) => commandCompletions(GOAL_SUBCOMMANDS, prefix),
	handler: async (args, ctx) => {
	  const input = args.trim();
	  const [verb = "", ...rest] = input.split(/\s+/);
	  const aliases: Record<string, string> = {
		status: "goal-status",
		pause: "goal-pause",
		resume: "goal-resume",
		stop: "goal-stop",
		cancel: "goal-stop",
		step: "goal-step",
	  };
	  const legacyName = rest.length === 0 ? aliases[verb] : undefined;
	  if (legacyName) return lifecycleCommands.get(legacyName)?.handler("", ctx);
	  const objective = verb === "start" ? rest.join(" ").trim() : input;
      if (!objective) {
        ctx.ui.notify("Goal objective is required. Usage: /goal <objective>", "error");
        return;
      }

      if (runtime.activeGoal && !isTerminalGoalPhase(runtime.activeGoal.phase)) {
        ctx.ui.notify("A goal is already active. Use /goal-status or /goal-stop before starting another goal.", "warning");
        return;
      }

      runtime.activeGoal = createGoalState({ objective, now: runtime.now() });
      notifyGoalChanged(runtime);
      ctx.ui.notify(`Goal started: ${runtime.activeGoal.objective}`, "info");
      queueGoalIteration(pi, runtime.activeGoal, "Start the bounded goal loop.");
    },
  });

  registerLifecycleCommand("goal-status", {
    description: "Show the active goal status.",
    handler: async (_args, ctx) => {
			ctx.ui.notify(formatGoalStatus(runtime.activeGoal, runtime.now()), "info");
    },
  });

  registerLifecycleCommand("goal-pause", {
    description: "Pause the active goal loop without cancelling it.",
    handler: async (_args, ctx) => {
      if (!runtime.activeGoal || !isRunnableGoalPhase(runtime.activeGoal.phase)) {
        ctx.ui.notify("No runnable goal to pause.", "info");
        return;
      }
      runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "paused", runtime.now());
      notifyGoalChanged(runtime);
      ctx.ui.notify(`Goal paused: ${runtime.activeGoal.objective}. Use /goal-resume to continue.`, "info");
    },
  });

  registerLifecycleCommand("goal-resume", {
    description: "Resume a paused or blocked goal loop.",
    handler: async (_args, ctx) => {
      if (!runtime.activeGoal) {
        ctx.ui.notify("No goal to resume. Use /goal <objective> to start one.", "info");
        return;
      }
      if (!isResumableGoalPhase(runtime.activeGoal.phase)) {
        ctx.ui.notify(`Cannot resume goal in ${runtime.activeGoal.phase} phase. Use /goal <objective> to start a new goal if needed.`, "warning");
        return;
      }
			const limitBlocker = getGoalLimitBlocker(runtime.activeGoal, runtime.now());
			if (limitBlocker) {
				ctx.ui.notify(`Cannot resume goal because ${limitBlocker}. Cancel it, then start a new goal if more work is needed.`, "warning");
				return;
			}
      runtime.activeGoal = renewGoalRun(transitionGoalPhase(runtime.activeGoal, "planning", runtime.now()), runtime.now());
      runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "running_iteration", runtime.now());
      notifyGoalChanged(runtime);
      queueGoalIteration(pi, runtime.activeGoal, "Resume the bounded goal loop with one iteration.");
      ctx.ui.notify(`Goal resumed: ${runtime.activeGoal.objective}`, "info");
    },
  });

  registerLifecycleCommand("goal-stop", {
    description: "Cancel the active or resumable goal loop.",
    handler: async (_args, ctx) => {
      if (!runtime.activeGoal || isTerminalGoalPhase(runtime.activeGoal.phase)) {
        ctx.ui.notify("No active or resumable goal to cancel.", "info");
        return;
      }
	  const result = cancelActiveGoal(runtime, runtime.activeGoal, ctx);
      notifyGoalChanged(runtime);
	  ctx.ui.notify(
		result.aborted
		  ? `Goal cancelled and current Goal Mode operation aborted: ${result.goal.objective}`
		  : `Goal cancelled: ${result.goal.objective}`,
		"info",
	  );
    },
  });

  registerLifecycleCommand("goal-step", {
    description: "Queue one bounded iteration for the active goal.",
    handler: async (_args, ctx) => {
      if (!runtime.activeGoal || isTerminalGoalPhase(runtime.activeGoal.phase)) {
        ctx.ui.notify("No active goal to step.", "info");
        return;
      }
      if (runtime.activeGoal.phase !== "planning") {
        const hint = isResumableGoalPhase(runtime.activeGoal.phase) ? " Use /goal-resume to continue it." : "";
        ctx.ui.notify(`Goal is currently ${runtime.activeGoal.phase}; cannot queue another step yet.${hint}`, "warning");
        return;
      }
      runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "running_iteration", runtime.now());
      notifyGoalChanged(runtime);
      queueGoalIteration(pi, runtime.activeGoal, "Run one bounded iteration for the active goal.");
      ctx.ui.notify(`Queued one goal iteration: ${runtime.activeGoal.objective}`, "info");
    },
  });
}

function commandCompletions(values: readonly string[], prefix: string): Array<{ value: string; label: string }> | null {
  const query = prefix.trim();
  if (query.includes(" ")) return null;
  const matches = values.filter((value) => value.startsWith(query)).map((value) => ({ value, label: value }));
  return matches.length > 0 ? matches : null;
}

export function cancelActiveGoal(
  runtime: GoalCommandRuntime,
  goal: ActiveGoalState,
  ctx: { isIdle?(): boolean; abort?(): void } = {},
): { goal: ActiveGoalState; aborted: boolean } {
  const activeIteration = runtime.activeIteration;
  const shouldAbort = ctx.isIdle?.() === false && activeIteration?.goalId === goal.id && activeIteration.runId === goal.runId;
  runtime.activeGoal = transitionGoalPhase(goal, "cancelled", runtime.now());
  runtime.activeIteration = undefined;
  if (shouldAbort) ctx.abort?.();
  return { goal: runtime.activeGoal, aborted: shouldAbort };
}

export function notifyGoalChanged(runtime: GoalCommandRuntime): void {
  runtime.onChange?.();
}

export function formatGoalStatus(goal: ActiveGoalState | undefined, now?: Date): string {
  if (!goal) return "No goal. Use /goal <objective> to start one.";
  const base = [
    `Goal: ${goal.objective}`,
    `Phase: ${goal.phase}`,
    `Iterations: ${goal.iterationCount}/${goal.limits.maxIterations}`,
    `Failures: ${goal.failureCount}/${goal.limits.maxFailures}`,
	`Max elapsed: ${goal.limits.maxElapsedMs}ms`,
	`Acceptance: ${goal.acceptanceCriteria.length > 0 ? goal.acceptanceCriteria.join("; ") : "not specified"}`,
	...(goal.latestReport ? [`Latest: ${goal.latestReport.status} — ${truncateGoalDetail(goal.latestReport.summary)}`] : []),
  ];
  if (isRunnableGoalPhase(goal.phase)) return [...base, "Status: active", "Next: /goal-pause, /goal-stop, or /goal-step when planning."].join("\n");
	const limitBlocker = now ? getGoalLimitBlocker(goal, now) : undefined;
	if (isResumableGoalPhase(goal.phase) && limitBlocker) {
		return [...base, `Status: limit exhausted (${limitBlocker})`, "Next: /goal-stop, then /goal <objective> if more work is needed."].join("\n");
	}
  if (isResumableGoalPhase(goal.phase)) return [...base, "Status: resumable", "Next: /goal-resume or /goal-stop."].join("\n");
  return [...base, "Status: terminal", "Next: /goal <objective> to start a new goal."].join("\n");
}

function truncateGoalDetail(value: string): string {
  return value.length <= 160 ? value : `${value.slice(0, 159)}…`;
}

function queueGoalIteration(pi: GoalCommandRegistry, goal: ActiveGoalState, instruction: string): void {
  pi.sendUserMessage?.(markGoalModeInternalMessage([
    instruction,
    "",
    `Objective: ${goal.objective}`,
    "Work on exactly one bounded iteration, then report progress with goal_report.",
  ].join("\n"), {
    goalId: goal.id,
    runId: goal.runId,
    iterationId: goal.nextIterationId,
  }), { deliverAs: "followUp" });
}
