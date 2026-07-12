import type { GoalCommandRuntime } from "./commands.ts";
import type { ActiveGoalState } from "./state.ts";
import { isTerminalGoalPhase, normalizeGoalStateForRestore, transitionGoalPhase } from "./state.ts";
import { buildMissingVerificationBlocker, isGoalReportAcceptableForDone } from "./verification.ts";

export const GOAL_STATE_ENTRY_TYPE = "goal-mode-state";

interface GoalPersistenceAPI {
  on(event: "session_start", handler: (event: unknown, ctx: GoalSessionContext) => Promise<void> | void): void;
  appendEntry(customType: string, data: unknown): void;
}

interface GoalSessionContext {
  sessionManager?: {
    getEntries(): unknown[];
  };
  ui?: {
    setStatus(key: string, value: string | undefined): void;
		notify?(message: string, level?: "info" | "error" | "warning"): void;
  };
}

export function registerGoalPersistenceAndUi(pi: GoalPersistenceAPI, runtime: GoalCommandRuntime): void {
  let lastSessionContext: GoalSessionContext | undefined;
	let lastPhase: ActiveGoalState["phase"] | undefined;

  runtime.onChange = () => {
    if (runtime.activeGoal) {
      pi.appendEntry(GOAL_STATE_ENTRY_TYPE, { activeGoal: runtime.activeGoal });
    }
		if (runtime.activeGoal?.phase === "done" && lastPhase !== "done") {
			lastSessionContext?.ui?.notify?.(`Goal done: ${runtime.activeGoal.objective}`, "info");
		}
    updateGoalStatus(lastSessionContext, runtime.activeGoal);
		lastPhase = runtime.activeGoal?.phase;
  };

  pi.on("session_start", async (_event, ctx) => {
    lastSessionContext = ctx;
    runtime.activeGoal = restoreLatestGoalState(ctx.sessionManager?.getEntries() ?? []);
		lastPhase = runtime.activeGoal?.phase;
    updateGoalStatus(ctx, runtime.activeGoal);
  });

  function updateGoalStatus(ctx: GoalSessionContext | undefined, goal: ActiveGoalState | undefined): void {
    const value = goal && !isTerminalGoalPhase(goal.phase) ? formatGoalStatusLine(goal) : undefined;
    ctx?.ui?.setStatus("goal-mode", value);
  }
}

export function restoreLatestGoalState(entries: readonly unknown[]): ActiveGoalState | undefined {
  for (const entry of [...entries].reverse()) {
    if (!isGoalStateEntry(entry)) continue;
		return settleRestoredGoalState(normalizeGoalStateForRestore(entry.data.activeGoal));
  }
  return undefined;
}

export function formatGoalStatusLine(goal: ActiveGoalState): string {
	const blocker = goal.phase === "blocked" && goal.latestReport?.blocker
		? ` · ${goal.latestReport.blocker}`
		: "";
	return truncateStatusLine(`goal: ${goal.phase} ${goal.iterationCount}/${goal.limits.maxIterations} ${truncateObjective(goal.objective)}${blocker}`);
}

function settleRestoredGoalState(goal: ActiveGoalState): ActiveGoalState {
  if (goal.phase !== "verifying" || !goal.latestReport) return goal;
  const now = new Date(goal.updatedAt);
  if (goal.latestReport.status === "blocked") return transitionGoalPhase(goal, "blocked", now);
  if (goal.latestReport.status !== "done") return goal;
  if (isGoalReportAcceptableForDone(goal.latestReport)) return transitionGoalPhase(goal, "done", now);
  return {
		...transitionGoalPhase(goal, "blocked", now),
		latestReport: {
			...goal.latestReport,
			status: "blocked",
			blocker: buildMissingVerificationBlocker(),
		},
  };
}

function truncateObjective(objective: string): string {
  const maxLength = 64;
  return objective.length <= maxLength ? objective : `${objective.slice(0, maxLength - 1)}…`;
}

function truncateStatusLine(status: string): string {
  const maxLength = 96;
  return status.length <= maxLength ? status : `${status.slice(0, maxLength - 1)}…`;
}

function isGoalStateEntry(entry: unknown): entry is { type: "custom"; customType: typeof GOAL_STATE_ENTRY_TYPE; data: { activeGoal: ActiveGoalState } } {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as { type?: unknown; customType?: unknown; data?: unknown };
  if (candidate.type !== "custom" || candidate.customType !== GOAL_STATE_ENTRY_TYPE) return false;
  const data = candidate.data as { activeGoal?: unknown } | undefined;
  return isActiveGoalStateLike(data?.activeGoal);
}

function isActiveGoalStateLike(value: unknown): value is ActiveGoalState {
  if (!value || typeof value !== "object") return false;
  const goal = value as Partial<ActiveGoalState>;
  return typeof goal.id === "string" && typeof goal.objective === "string" && typeof goal.phase === "string";
}
