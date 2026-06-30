export type GoalPhase = "planning" | "running_iteration" | "verifying" | "paused" | "blocked" | "done" | "cancelled";
export type LegacyGoalPhase = GoalPhase | "stopped";

export type GoalReportStatus = "continue" | "blocked" | "done";

export interface GoalLimits {
  maxIterations: number;
  maxFailures: number;
  maxElapsedMs: number;
}

export interface GoalApprovals {
  writesApproved: boolean;
  destructiveBashApproved: boolean;
}

export interface GoalReport {
  status: GoalReportStatus;
  summary: string;
  verification: string[];
  completedCriteria: string[];
  remainingCriteria: string[];
  nextAction?: string;
  blocker?: string;
}

export interface ActiveGoalState {
  id: string;
  objective: string;
  phase: GoalPhase;
  acceptanceCriteria: string[];
  iterationCount: number;
  failureCount: number;
  startedAt: string;
  updatedAt: string;
  runId: string;
  nextIterationId: number;
  limits: GoalLimits;
  approvals: GoalApprovals;
  latestReport?: GoalReport;
}

export interface CreateGoalStateOptions {
  objective: string;
  now: Date;
  acceptanceCriteria?: string[];
  limits?: Partial<GoalLimits>;
}

export const DEFAULT_GOAL_LIMITS: GoalLimits = {
  maxIterations: 8,
  maxFailures: 2,
  maxElapsedMs: 30 * 60 * 1000,
};

const TERMINAL_PHASES = new Set<GoalPhase>(["done", "cancelled"]);

const ALLOWED_TRANSITIONS: Record<GoalPhase, GoalPhase[]> = {
  planning: ["running_iteration", "paused", "blocked", "cancelled"],
  running_iteration: ["verifying", "paused", "blocked", "cancelled"],
  verifying: ["planning", "paused", "blocked", "done", "cancelled"],
  paused: ["planning", "cancelled"],
  blocked: ["planning", "cancelled"],
  done: [],
  cancelled: [],
};

export function createGoalState(options: CreateGoalStateOptions): ActiveGoalState {
  const objective = options.objective.trim();
  if (!objective) throw new Error("Goal objective is required.");
  const timestamp = options.now.toISOString();
  return {
    id: createGoalId(options.now, objective),
    objective,
    phase: "planning",
    acceptanceCriteria: [...(options.acceptanceCriteria ?? [])],
    iterationCount: 0,
    failureCount: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
    runId: createRunId(options.now),
    nextIterationId: 1,
    limits: { ...DEFAULT_GOAL_LIMITS, ...options.limits },
    approvals: {
      writesApproved: false,
      destructiveBashApproved: false,
    },
  };
}

export function transitionGoalPhase(goal: ActiveGoalState, nextPhase: GoalPhase, now: Date): ActiveGoalState {
  if (isTerminalGoalPhase(goal.phase)) {
    throw new Error(`Cannot transition terminal goal phase ${goal.phase} to ${nextPhase}.`);
  }
  if (!ALLOWED_TRANSITIONS[goal.phase].includes(nextPhase)) {
    throw new Error(`Invalid goal phase transition: ${goal.phase} -> ${nextPhase}.`);
  }
  return {
    ...goal,
    acceptanceCriteria: [...goal.acceptanceCriteria],
    runId: goal.runId,
    nextIterationId: goal.nextIterationId,
    limits: { ...goal.limits },
    approvals: { ...goal.approvals },
    latestReport: goal.latestReport ? copyGoalReport(goal.latestReport) : undefined,
    phase: nextPhase,
    updatedAt: now.toISOString(),
  };
}

export function isTerminalGoalPhase(phase: GoalPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

export function isRunnableGoalPhase(phase: GoalPhase): boolean {
  return phase === "planning" || phase === "running_iteration" || phase === "verifying";
}

export function isResumableGoalPhase(phase: GoalPhase): boolean {
  return phase === "paused" || phase === "blocked";
}

export function renewGoalRun(goal: ActiveGoalState, now: Date): ActiveGoalState {
  return {
    ...goal,
    runId: createRunId(now),
    nextIterationId: 1,
    updatedAt: now.toISOString(),
  };
}

export function normalizeGoalStateForRestore(goal: ActiveGoalState | (Omit<ActiveGoalState, "phase"> & { phase: LegacyGoalPhase })): ActiveGoalState {
  const phase = goal.phase === "stopped" ? "cancelled" : goal.phase;
  return {
    ...goal,
    phase,
    acceptanceCriteria: [...goal.acceptanceCriteria],
    runId: goal.runId ?? createRunId(new Date(goal.startedAt)),
    nextIterationId: goal.nextIterationId ?? 1,
    limits: { ...goal.limits },
    approvals: { ...goal.approvals },
    latestReport: goal.latestReport ? copyGoalReport(goal.latestReport) : undefined,
  };
}

function createGoalId(now: Date, objective: string): string {
  return `goal_${formatTimestamp(now)}_${slugify(objective) || "untitled"}`;
}

function createRunId(now: Date): string {
  return `run_${formatTimestamp(now)}`;
}

function formatTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "_");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function copyGoalReport(report: GoalReport): GoalReport {
  return {
    ...report,
    verification: [...report.verification],
    completedCriteria: [...report.completedCriteria],
    remainingCriteria: [...report.remainingCriteria],
  };
}
