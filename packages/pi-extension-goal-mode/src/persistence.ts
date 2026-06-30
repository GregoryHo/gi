import type { GoalCommandRuntime } from "./commands.ts";
import type { ActiveGoalState } from "./state.ts";
import { isTerminalGoalPhase, normalizeGoalStateForRestore } from "./state.ts";

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
  };
}

export function registerGoalPersistenceAndUi(pi: GoalPersistenceAPI, runtime: GoalCommandRuntime): void {
  let lastSessionContext: GoalSessionContext | undefined;

  runtime.onChange = () => {
    if (runtime.activeGoal) {
      pi.appendEntry(GOAL_STATE_ENTRY_TYPE, { activeGoal: runtime.activeGoal });
    }
    updateGoalStatus(lastSessionContext, runtime.activeGoal);
  };

  pi.on("session_start", async (_event, ctx) => {
    lastSessionContext = ctx;
    runtime.activeGoal = restoreLatestGoalState(ctx.sessionManager?.getEntries() ?? []);
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
    return normalizeGoalStateForRestore(entry.data.activeGoal);
  }
  return undefined;
}

export function formatGoalStatusLine(goal: ActiveGoalState): string {
  return `goal: ${goal.phase} ${goal.iterationCount}/${goal.limits.maxIterations} ${goal.objective}`;
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
