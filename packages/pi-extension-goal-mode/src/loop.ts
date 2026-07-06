import { notifyGoalChanged, type GoalCommandRuntime } from "./commands.ts";
import { extractGoalModeInternalMessage, isGoalModeInternalMessage, markGoalModeInternalMessage } from "./messages.ts";
import type { ActiveGoalState, GoalReport } from "./state.ts";
import { isRunnableGoalPhase, isTerminalGoalPhase, transitionGoalPhase } from "./state.ts";
import { buildMissingVerificationBlocker, isGoalReportAcceptableForDone } from "./verification.ts";

interface GoalLoopAPI {
  on(event: "before_agent_start" | "agent_end" | "input", handler: (event: any, ctx: any) => unknown): void;
  sendUserMessage?(content: string, options?: { deliverAs?: "followUp" | "steer" | "nextTurn" }): void;
}

interface GoalLoopSender {
  sendUserMessage?(content: string, options?: { deliverAs?: "followUp" | "steer" | "nextTurn" }): void;
}

export type GoalLoopAction = "none" | "continue" | "blocked" | "done";

export interface GoalLoopResult {
  action: GoalLoopAction;
  reason?: string;
}

export function registerGoalLoop(pi: GoalLoopAPI, runtime: GoalCommandRuntime): void {
  pi.on("input", async (event, ctx) => {
    if (event.source !== "extension" || typeof event.text !== "string" || !isGoalModeInternalMessage(event.text)) return;
    const internalMessage = extractGoalModeInternalMessage(event.text);
    const goal = runtime.activeGoal;
    if (!goal || !internalMessage || !isRunnableGoalPhase(goal.phase) || !isCurrentGoalFollowUp(goal, internalMessage.metadata)) {
      ctx.ui?.notify?.("Discarded stale Goal Mode follow-up because no runnable matching goal is active.", "info");
      return { action: "handled" };
    }
    const acceptedGoal = goal.phase === "planning" ? transitionGoalPhase(goal, "running_iteration", runtime.now()) : goal;
    runtime.activeGoal = {
      ...acceptedGoal,
      nextIterationId: goal.nextIterationId + 1,
    };
    runtime.activeIteration = { ...internalMessage.metadata };
    notifyGoalChanged(runtime);
    return { action: "transform", text: internalMessage.text };
  });

  pi.on("before_agent_start", async (event) => {
    const goal = runtime.activeGoal;
    if (!goal || !isRunnableGoalPhase(goal.phase)) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${formatActiveGoalContext(goal)}`,
    };
  });

  pi.on("agent_end", async () => {
    handleGoalAgentEnd(runtime, pi);
  });
}

export function formatActiveGoalContext(goal: ActiveGoalState): string {
  return [
    "[ACTIVE GOAL]",
    `id: ${goal.id}`,
    `objective: ${goal.objective}`,
    `phase: ${goal.phase}`,
    `iterations: ${goal.iterationCount}/${goal.limits.maxIterations}`,
    `max iterations: ${goal.limits.maxIterations}`,
    `failures: ${goal.failureCount}/${goal.limits.maxFailures}`,
    `max failures: ${goal.limits.maxFailures}`,
    `max elapsed ms: ${goal.limits.maxElapsedMs}`,
    goal.acceptanceCriteria.length > 0 ? `acceptance criteria: ${goal.acceptanceCriteria.join("; ")}` : "acceptance criteria: not specified",
    ...formatSourcePlanContext(goal),
		...formatWorkerDelegationContext(goal),
    "Loop contract: work on one bounded iteration, verify with concrete evidence, then call goal_report.",
    "goal_report status must be continue, blocked, or done. Do not claim done without verification evidence.",
  ].join("\n");
}

function formatSourcePlanContext(goal: ActiveGoalState): string[] {
  if (!goal.sourcePlan) return [];
  const steps = goal.sourcePlan.steps.slice(0, 8).map((step) => {
    const prefix = step.completed ? "[advisory completed] " : "";
    return `${step.step}. ${prefix}${step.text}`;
  });
  const remainingCount = goal.sourcePlan.steps.length - steps.length;
  return [
    "[SOURCE PLAN]",
    `id: ${goal.sourcePlan.planId}`,
    `title: ${goal.sourcePlan.title}`,
    ...(goal.sourcePlan.status ? [`status: ${goal.sourcePlan.status}`] : []),
    "steps:",
    ...steps,
    ...(remainingCount > 0 ? [`... ${remainingCount} more step(s)`] : []),
    "Plan completed markers are advisory, not verification proof. Verify concrete results before reporting done.",
  ];
}

function formatWorkerDelegationContext(goal: ActiveGoalState): string[] {
	if (!goal.workerDelegation?.enabled) return [];
	const profiles = goal.workerDelegation.allowedProfiles?.join(", ") ?? "planner, reviewer, verifier";
	return [
		"[WORKER DELEGATION]",
		...(goal.workerDelegation.purpose ? [`purpose: ${goal.workerDelegation.purpose}`] : []),
		`allowed profiles: ${profiles}`,
		...(goal.workerDelegation.workspace ? [`workspace: ${goal.workerDelegation.workspace}`] : []),
		"Use agent_worker_start only for bounded subtasks explicitly allowed by the user.",
		"Use agent_worker_wait or agent_worker_status before relying on worker results.",
		"Worker summaries are evidence for goal_report, not automatic proof of completion.",
		"The implementer profile requires explicit workspace/scope and Agent Workers confirmation.",
		"Do not bypass Agent Workers confirmation, workspace preflight, or workspace-collision rules.",
	];
}

export function handleGoalAgentEnd(runtime: GoalCommandRuntime, sender: GoalLoopSender): GoalLoopResult {
  const goal = runtime.activeGoal;
  if (!goal || isTerminalGoalPhase(goal.phase)) {
    runtime.activeIteration = undefined;
    return { action: "none", reason: "no_active_goal" };
  }
  if (!isRunnableGoalPhase(goal.phase)) {
    runtime.activeIteration = undefined;
    return { action: "none", reason: "not_runnable" };
  }
  const hasDirectReport = goal.phase === "verifying" && !!goal.latestReport;
  if (!runtime.activeIteration && !hasDirectReport) return { action: "none", reason: "no_active_iteration" };
  if (runtime.activeIteration && !isCurrentActiveGoalIteration(goal, runtime.activeIteration)) {
    runtime.activeIteration = undefined;
    return { action: "none", reason: "stale_active_iteration" };
  }
  runtime.activeIteration = undefined;

  if (!goal.latestReport) {
    runtime.activeGoal = recordMissingReport(goal, runtime.now());
    notifyGoalChanged(runtime);
    return runtime.activeGoal.phase === "blocked"
      ? { action: "blocked", reason: "missing_goal_report" }
      : { action: "none", reason: "missing_goal_report" };
  }

  const report = goal.latestReport;
  if (report.status === "blocked") {
    runtime.activeGoal = transitionGoalPhaseFromVerifying(goal, "blocked", runtime.now(), report);
    notifyGoalChanged(runtime);
    return { action: "blocked", reason: report.blocker ?? "reported_blocked" };
  }

  if (report.status === "done") {
    if (!isGoalReportAcceptableForDone(report)) {
      const blockerReport: GoalReport = {
        ...report,
        status: "blocked",
        blocker: buildMissingVerificationBlocker(),
      };
      runtime.activeGoal = transitionGoalPhaseFromVerifying(goal, "blocked", runtime.now(), blockerReport);
      notifyGoalChanged(runtime);
      return { action: "blocked", reason: "missing_verification" };
    }
    runtime.activeGoal = transitionGoalPhaseFromVerifying(goal, "done", runtime.now(), report);
    notifyGoalChanged(runtime);
    return { action: "done" };
  }

  const limitBlocker = getContinuationLimitBlocker(goal, runtime.now());
  if (limitBlocker) {
    const blockerReport: GoalReport = {
      ...report,
      status: "blocked",
      blocker: limitBlocker,
    };
    runtime.activeGoal = transitionGoalPhaseFromVerifying(goal, "blocked", runtime.now(), blockerReport);
    notifyGoalChanged(runtime);
    return { action: "blocked", reason: limitBlocker };
  }

  const nextGoal = transitionGoalPhase(
    transitionGoalPhase({ ...goal, latestReport: report }, "planning", runtime.now()),
    "running_iteration",
    runtime.now(),
  );
  runtime.activeGoal = {
    ...nextGoal,
    iterationCount: goal.iterationCount + 1,
    latestReport: report,
  };
  notifyGoalChanged(runtime);
  queueContinuation(sender, runtime.activeGoal);
  return { action: "continue" };
}

function isCurrentGoalFollowUp(goal: ActiveGoalState, metadata: { goalId: string; runId: string; iterationId: number }): boolean {
  return metadata.goalId === goal.id && metadata.runId === goal.runId && metadata.iterationId === goal.nextIterationId;
}

function isCurrentActiveGoalIteration(goal: ActiveGoalState, metadata: { goalId: string; runId: string; iterationId: number }): boolean {
  return metadata.goalId === goal.id && metadata.runId === goal.runId;
}

function recordMissingReport(goal: ActiveGoalState, now: Date): ActiveGoalState {
  const failureCount = goal.failureCount + 1;
  const missingReport: GoalReport = {
    status: "blocked",
    summary: "Goal iteration ended without a goal_report call.",
    verification: [],
    completedCriteria: [],
    remainingCriteria: [...goal.acceptanceCriteria],
    blocker: "missing goal_report",
  };
  const next: ActiveGoalState = {
    ...goal,
    failureCount,
    updatedAt: now.toISOString(),
    latestReport: missingReport,
  };
  if (failureCount >= goal.limits.maxFailures) {
    return transitionGoalPhaseFromAny(next, "blocked", now, missingReport);
  }
  return next;
}

function getContinuationLimitBlocker(goal: ActiveGoalState, now: Date): string | undefined {
  if (goal.iterationCount >= goal.limits.maxIterations) return "max iterations reached";
  const elapsedMs = now.getTime() - new Date(goal.startedAt).getTime();
  if (elapsedMs >= goal.limits.maxElapsedMs) return "max elapsed time reached";
  if (goal.failureCount >= goal.limits.maxFailures) return "max failures reached";
  return undefined;
}

function transitionGoalPhaseFromVerifying(goal: ActiveGoalState, phase: "blocked" | "done", now: Date, report: GoalReport): ActiveGoalState {
  const current = goal.phase === "verifying" ? goal : { ...goal, phase: "verifying" as const };
  return {
    ...transitionGoalPhase(current, phase, now),
    latestReport: copyGoalReport(report),
  };
}

function transitionGoalPhaseFromAny(goal: ActiveGoalState, phase: "blocked", now: Date, report: GoalReport): ActiveGoalState {
  if (goal.phase === "verifying") return transitionGoalPhaseFromVerifying(goal, phase, now, report);
  return {
    ...goal,
    phase,
    updatedAt: now.toISOString(),
    latestReport: copyGoalReport(report),
  };
}

function queueContinuation(sender: GoalLoopSender, goal: ActiveGoalState): void {
  const nextAction = goal.latestReport?.nextAction ?? "Continue the next bounded goal iteration.";
  sender.sendUserMessage?.(markGoalModeInternalMessage([
    "Continue Goal Mode with one bounded iteration.",
    `Objective: ${goal.objective}`,
    `Next action: ${nextAction}`,
    "After the iteration, verify the result and call goal_report.",
  ].join("\n"), {
    goalId: goal.id,
    runId: goal.runId,
    iterationId: goal.nextIterationId,
  }), { deliverAs: "followUp" });
}

function copyGoalReport(report: GoalReport): GoalReport {
  return {
    ...report,
    verification: [...report.verification],
    completedCriteria: [...report.completedCriteria],
    remainingCriteria: [...report.remainingCriteria],
  };
}
