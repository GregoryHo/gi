import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { markGoalModeInternalMessage } from "./messages.ts";
import { notifyGoalChanged, type GoalCommandRuntime } from "./commands.ts";
import type { GoalReport, GoalReportStatus, SourcePlan, WorkerDelegationPolicy, WorkerDelegationProfile } from "./state.ts";
import { createGoalState, getGoalLimitBlocker, isResumableGoalPhase, isRunnableGoalPhase, isTerminalGoalPhase, renewGoalRun, transitionGoalPhase, type ActiveGoalState } from "./state.ts";

type ToolDefinition = Parameters<ExtensionAPI["registerTool"]>[0];

interface GoalToolRegistry {
  registerTool(tool: ToolDefinition): void;
  sendUserMessage?(content: string, options?: { deliverAs?: "followUp" | "steer" | "nextTurn" }): void;
}

interface GoalToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}

interface GoalStartToolParams {
  objective?: unknown;
  acceptanceCriteria?: unknown;
  sourcePlan?: unknown;
  workerDelegation?: unknown;
}

interface GoalControlToolParams {
  action?: unknown;
}

interface GoalReportToolParams {
  status?: unknown;
  summary?: unknown;
  verification?: unknown;
  completedCriteria?: unknown;
  remainingCriteria?: unknown;
  nextAction?: unknown;
  blocker?: unknown;
}

const sourcePlanStepParameters = Type.Object({
  step: Type.Number({ description: "Original plan step number." }),
  text: Type.String({ description: "Original plan step text." }),
  completed: Type.Optional(Type.Boolean({ description: "Advisory Plan Mode completion marker; not verification proof." })),
});

const sourcePlanParameters = Type.Object({
  planId: Type.String({ description: "Source Plan Mode plan id." }),
  title: Type.String({ description: "Source plan title." }),
  status: Type.Optional(Type.String({ description: "Source plan status." })),
  steps: Type.Array(sourcePlanStepParameters, { description: "Source plan steps with original numbering and text." }),
});

const workerDelegationParameters = Type.Object({
	enabled: Type.Boolean({ description: "Whether the user explicitly approved worker assistance for this goal." }),
	workspace: Type.Optional(Type.String({ description: "Explicit worker cwd/workspace to pass to agent_worker_start when available." })),
	allowedProfiles: Type.Optional(Type.Array(Type.String(), { description: "Allowed worker profiles: planner, reviewer, verifier, implementer." })),
	purpose: Type.Optional(Type.String({ description: "Compact reason for worker delegation." })),
});

const goalStartParameters = Type.Object({
  objective: Type.String({ description: "Goal objective to run as a bounded Goal Mode loop." }),
  acceptanceCriteria: Type.Optional(Type.Array(Type.String(), { description: "Goal-specific acceptance criteria." })),
  sourcePlan: Type.Optional(sourcePlanParameters),
	workerDelegation: Type.Optional(workerDelegationParameters),
});

const goalControlParameters = Type.Object({
  action: Type.String({ description: "One of: pause, resume, cancel, step." }),
});

const goalReportParameters = Type.Object({
  status: Type.String({ description: "One of: continue, blocked, done." }),
  summary: Type.String({ description: "Compact progress summary for this iteration." }),
  verification: Type.Array(Type.String(), { description: "Verification evidence gathered this iteration." }),
  completedCriteria: Type.Array(Type.String(), { description: "Acceptance criteria satisfied this iteration." }),
  remainingCriteria: Type.Array(Type.String(), { description: "Acceptance criteria still remaining." }),
  nextAction: Type.Optional(Type.String({ description: "Next bounded action if status is continue." })),
  blocker: Type.Optional(Type.String({ description: "Blocker reason if status is blocked." })),
});

export function registerGoalReportTool(pi: GoalToolRegistry, runtime: GoalCommandRuntime): void {
  pi.registerTool({
    name: "goal_status",
    label: "Goal Status",
    description: "Read the current Goal Mode state, including phase, objective, latest report, blocker, and next allowed actions.",
    promptSnippet: "Inspect the current Goal Mode lifecycle state before deciding whether to start, resume, pause, cancel, or report",
    promptGuidelines: [
      "Use goal_status when the user asks about the current goal or says to continue/resume goal work.",
      "If goal_status reports a paused or blocked goal, prefer goal_control(resume) over starting a duplicate goal.",
      "goal_status is read-only and does not queue work or mutate goal state.",
    ],
    parameters: Type.Object({}),
    async execute(): Promise<GoalToolResult> {
      if (!runtime.activeGoal) {
        return toolResult("No active goal.", {
          found: false,
          nextAllowedActions: ["start"],
        });
      }
			const details = goalStatusDetails(runtime.activeGoal, runtime.now());
      return toolResult(`Goal ${runtime.activeGoal.phase}: ${runtime.activeGoal.objective}`, details);
    },
  });

  pi.registerTool({
    name: "goal_control",
    label: "Control Goal",
    description: "Control the current Goal Mode lifecycle: pause, resume, cancel, or queue one step.",
    promptSnippet: "Control an existing Goal Mode objective when the user asks to pause, resume, continue, cancel, or step it",
    promptGuidelines: [
      "Use goal_control after goal_status when the user asks to continue, resume, pause, cancel, or step an existing goal.",
      "Prefer goal_control(action: 'resume') for paused or blocked goals instead of starting a duplicate goal.",
      "goal_control(action: 'step') only queues work for planning goals; it must not bypass paused or blocked goals.",
    ],
    parameters: goalControlParameters,
    async execute(_toolCallId, params): Promise<GoalToolResult> {
      const action = normalizeGoalControlAction((params as GoalControlToolParams).action);
      const goal = runtime.activeGoal;
      if (!goal) {
        return toolResult("No goal to control. Start one with goal_start or /goal.", {
          accepted: false,
          reason: "no_active_goal",
          nextAllowedActions: ["start"],
        });
      }

      const controlled = controlGoal(pi, runtime, goal, action);
      if (!controlled.accepted) return toolResult(controlled.message, controlled.details);
      notifyGoalChanged(runtime);
      return toolResult(controlled.message, controlled.details);
    },
  });

  pi.registerTool({
    name: "goal_start",
    label: "Start Goal",
    description: "Start a bounded Goal Mode loop from explicit user intent, optionally using a source plan as advisory context.",
    promptSnippet: "Start a bounded Goal Mode objective when the user explicitly asks for goal-style execution",
    promptGuidelines: [
      "Use goal_start only when the user explicitly asks for Goal Mode, bounded autonomous completion, or to use goal to complete work.",
      "If plan-like data is already available, pass it as sourcePlan so Goal Mode can keep it as advisory context.",
			"Pass workerDelegation only when the user explicitly asks for or approves worker assistance; do not opportunistically start workers.",
			"For workerDelegation, prefer planner, reviewer, or verifier for read-only assistance; implementer requires explicit workspace/scope and Agent Workers confirmation.",
			"Do not treat sourcePlan completed markers or worker summaries as verification proof; Goal Mode still requires concrete verification before done.",
    ],
    parameters: goalStartParameters,
    async execute(_toolCallId, params): Promise<GoalToolResult> {
      const startParams = normalizeGoalStartParams(params as GoalStartToolParams);
      if (runtime.activeGoal && !isTerminalGoalPhase(runtime.activeGoal.phase)) {
        return toolResult(`A goal is already ${runtime.activeGoal.phase}. Use goal_status to inspect it, then goal_control to resume, pause, cancel, or step it instead of starting a duplicate goal.`, {
          accepted: false,
          reason: "goal_already_active",
          phase: runtime.activeGoal.phase,
          nextAllowedActions: nextAllowedActions(runtime.activeGoal),
        });
      }

      runtime.activeGoal = createGoalState({
        objective: startParams.objective,
        now: runtime.now(),
        acceptanceCriteria: startParams.acceptanceCriteria,
        sourcePlan: startParams.sourcePlan,
				workerDelegation: startParams.workerDelegation,
      });
      notifyGoalChanged(runtime);
      queueGoalStart(pi, runtime.activeGoal);
      return toolResult(`Goal started: ${runtime.activeGoal.objective}`, {
        accepted: true,
        goalId: runtime.activeGoal.id,
        phase: runtime.activeGoal.phase,
      });
    },
  });

  pi.registerTool({
    name: "goal_report",
    label: "Goal Report",
    description: "Record structured progress for the active Goal Mode objective.",
    promptSnippet: "Report Goal Mode progress, verification evidence, and whether to continue, block, or finish",
    promptGuidelines: [
      "Use goal_report at the end of every Goal Mode iteration.",
      "goal_report status must be continue, blocked, or done.",
      "goal_report verification must include concrete evidence or a clear blocker explaining why verification could not run.",
    ],
    parameters: goalReportParameters,
    async execute(_toolCallId, params): Promise<GoalToolResult> {
      if (!runtime.activeGoal) {
        return toolResult("No active goal. Start one with /goal <objective> before calling goal_report.", {
          accepted: false,
          reason: "no_active_goal",
        });
      }
      if (isTerminalGoalPhase(runtime.activeGoal.phase)) {
        return toolResult(`Goal is ${runtime.activeGoal.phase}; not accepting goal_report for terminal goals.`, {
          accepted: false,
          reason: "terminal_goal",
          phase: runtime.activeGoal.phase,
        });
      }
			if (isResumableGoalPhase(runtime.activeGoal.phase)) {
				return toolResult(`Goal is ${runtime.activeGoal.phase}; resume it before calling goal_report.`, {
					accepted: false,
					reason: "resume_required",
					phase: runtime.activeGoal.phase,
					nextAllowedActions: nextAllowedActions(runtime.activeGoal),
				});
			}

      const report = normalizeGoalReport(params as GoalReportToolParams);
      if (isRunnableGoalPhase(runtime.activeGoal.phase)) {
        runtime.activeGoal = runtime.activeGoal.phase === "running_iteration"
          ? transitionGoalPhase(runtime.activeGoal, "verifying", runtime.now())
          : { ...runtime.activeGoal, phase: "verifying", updatedAt: runtime.now().toISOString() };
      }
      runtime.activeGoal = {
        ...runtime.activeGoal,
        latestReport: report,
      };
      notifyGoalChanged(runtime);

      return toolResult(`Goal report recorded: ${report.status}.`, {
        accepted: true,
        goalId: runtime.activeGoal.id,
        status: report.status,
        phase: runtime.activeGoal.phase,
      });
    },
  });
}

type GoalControlAction = "pause" | "resume" | "cancel" | "step";

function controlGoal(pi: GoalToolRegistry, runtime: GoalCommandRuntime, goal: ActiveGoalState, action: GoalControlAction): { accepted: boolean; message: string; details: Record<string, unknown> } {
  if (action === "pause") {
    if (!isRunnableGoalPhase(goal.phase)) return rejectedControl(`Cannot pause goal in ${goal.phase} phase.`, goal, "invalid_phase");
    runtime.activeGoal = transitionGoalPhase(goal, "paused", runtime.now());
    return acceptedControl(`Goal paused: ${runtime.activeGoal.objective}`, runtime.activeGoal);
  }

  if (action === "resume") {
    if (!isResumableGoalPhase(goal.phase)) return rejectedControl(`Cannot resume goal in ${goal.phase} phase.`, goal, "invalid_phase");
		const limitBlocker = getGoalLimitBlocker(goal, runtime.now());
		if (limitBlocker) {
			return rejectedControl(`Cannot resume goal because ${limitBlocker}. Cancel it, then start a new goal if more work is needed.`, goal, "limit_exhausted", ["cancel"]);
		}
    runtime.activeGoal = renewGoalRun(transitionGoalPhase(goal, "planning", runtime.now()), runtime.now());
    runtime.activeGoal = transitionGoalPhase(runtime.activeGoal, "running_iteration", runtime.now());
    queueGoalIteration(pi, runtime.activeGoal, "Resume the bounded goal loop with one iteration.");
    return acceptedControl(`Goal resumed: ${runtime.activeGoal.objective}`, runtime.activeGoal);
  }

  if (action === "cancel") {
    if (isTerminalGoalPhase(goal.phase)) return rejectedControl(`Goal is already ${goal.phase}.`, goal, "terminal_goal");
    runtime.activeGoal = transitionGoalPhase(goal, "cancelled", runtime.now());
    return acceptedControl(`Goal cancelled: ${runtime.activeGoal.objective}`, runtime.activeGoal);
  }

  if (goal.phase !== "planning") return rejectedControl(`Cannot step goal in ${goal.phase} phase.`, goal, "invalid_phase");
  runtime.activeGoal = transitionGoalPhase(goal, "running_iteration", runtime.now());
  queueGoalIteration(pi, runtime.activeGoal, "Run one bounded iteration for the active goal.");
  return acceptedControl(`Queued one goal iteration: ${runtime.activeGoal.objective}`, runtime.activeGoal);
}

function acceptedControl(message: string, goal: ActiveGoalState): { accepted: true; message: string; details: Record<string, unknown> } {
  return {
    accepted: true,
    message,
    details: {
      accepted: true,
      goalId: goal.id,
      phase: goal.phase,
      nextAllowedActions: nextAllowedActions(goal),
    },
  };
}

function rejectedControl(message: string, goal: ActiveGoalState, reason: string, allowedActions = nextAllowedActions(goal)): { accepted: false; message: string; details: Record<string, unknown> } {
  return {
    accepted: false,
    message,
    details: {
      accepted: false,
      reason,
      goalId: goal.id,
      phase: goal.phase,
			nextAllowedActions: allowedActions,
    },
  };
}

function goalStatusDetails(goal: ActiveGoalState, now: Date): Record<string, unknown> {
  return {
    found: true,
    goalId: goal.id,
    objective: goal.objective,
    phase: goal.phase,
    iterationCount: goal.iterationCount,
    failureCount: goal.failureCount,
    limits: { ...goal.limits },
    acceptanceCriteria: [...goal.acceptanceCriteria],
    sourcePlan: goal.sourcePlan ? copySourcePlan(goal.sourcePlan) : undefined,
		workerDelegation: goal.workerDelegation ? copyWorkerDelegation(goal.workerDelegation) : undefined,
    latestReport: goal.latestReport ? copyGoalReport(goal.latestReport) : undefined,
    blocker: goal.latestReport?.blocker,
		nextAllowedActions: nextAllowedActions(goal, now),
  };
}

function nextAllowedActions(goal: ActiveGoalState, now?: Date): string[] {
  if (isTerminalGoalPhase(goal.phase)) return [];
	if (isResumableGoalPhase(goal.phase) && now && getGoalLimitBlocker(goal, now)) return ["cancel"];
  if (isResumableGoalPhase(goal.phase)) return ["resume", "cancel"];
  if (goal.phase === "planning") return ["step", "pause", "cancel"];
  return ["pause", "cancel"];
}

export function normalizeGoalStartParams(params: GoalStartToolParams): { objective: string; acceptanceCriteria?: string[]; sourcePlan?: SourcePlan; workerDelegation?: WorkerDelegationPolicy } {
  return {
    objective: nonEmptyString(params.objective, "objective"),
    acceptanceCriteria: params.acceptanceCriteria === undefined ? undefined : stringArray(params.acceptanceCriteria, "acceptanceCriteria"),
    sourcePlan: params.sourcePlan === undefined ? undefined : normalizeSourcePlan(params.sourcePlan),
		workerDelegation: params.workerDelegation === undefined ? undefined : normalizeWorkerDelegation(params.workerDelegation),
  };
}

export function normalizeGoalReport(params: GoalReportToolParams): GoalReport {
  const status = normalizeStatus(params.status);
  const summary = nonEmptyString(params.summary, "summary");
  const verification = stringArray(params.verification, "verification");
  const completedCriteria = stringArray(params.completedCriteria, "completedCriteria");
  const remainingCriteria = stringArray(params.remainingCriteria, "remainingCriteria");
  const nextAction = optionalString(params.nextAction, "nextAction");
  const blocker = optionalString(params.blocker, "blocker");

  return {
    status,
    summary,
    verification,
    completedCriteria,
    remainingCriteria,
    ...(nextAction ? { nextAction } : {}),
    ...(blocker ? { blocker } : {}),
  };
}

function copySourcePlan(sourcePlan: SourcePlan): SourcePlan {
  return {
    ...sourcePlan,
    steps: sourcePlan.steps.map((step) => ({ ...step })),
  };
}

function copyWorkerDelegation(workerDelegation: WorkerDelegationPolicy): WorkerDelegationPolicy {
	return {
		...workerDelegation,
		allowedProfiles: workerDelegation.allowedProfiles ? [...workerDelegation.allowedProfiles] : undefined,
	};
}

function copyGoalReport(report: GoalReport): GoalReport {
  return {
    ...report,
    verification: [...report.verification],
    completedCriteria: [...report.completedCriteria],
    remainingCriteria: [...report.remainingCriteria],
  };
}

function normalizeSourcePlan(value: unknown): SourcePlan {
  if (!value || typeof value !== "object") throw new Error("goal_start sourcePlan must be an object.");
  const source = value as { planId?: unknown; title?: unknown; status?: unknown; steps?: unknown };
  const status = source.status === undefined ? undefined : nonEmptyString(source.status, "sourcePlan.status");
  return {
    planId: nonEmptyString(source.planId, "sourcePlan.planId"),
    title: nonEmptyString(source.title, "sourcePlan.title"),
    ...(status ? { status } : {}),
    steps: normalizeSourcePlanSteps(source.steps),
  };
}

function normalizeWorkerDelegation(value: unknown): WorkerDelegationPolicy {
	if (!value || typeof value !== "object") throw new Error("goal_start workerDelegation must be an object.");
	const source = value as { enabled?: unknown; workspace?: unknown; allowedProfiles?: unknown; purpose?: unknown };
	if (typeof source.enabled !== "boolean") throw new Error("goal_start workerDelegation.enabled must be a boolean.");
	const workspace = source.workspace === undefined ? undefined : nonEmptyString(source.workspace, "workerDelegation.workspace");
	const purpose = source.purpose === undefined ? undefined : nonEmptyString(source.purpose, "workerDelegation.purpose");
	const allowedProfiles = source.allowedProfiles === undefined ? undefined : normalizeWorkerDelegationProfiles(source.allowedProfiles);
	return {
		enabled: source.enabled,
		...(workspace ? { workspace } : {}),
		...(allowedProfiles ? { allowedProfiles } : {}),
		...(purpose ? { purpose } : {}),
	};
}

function normalizeWorkerDelegationProfiles(value: unknown): WorkerDelegationProfile[] {
	if (!Array.isArray(value)) throw new Error("goal_start workerDelegation.allowedProfiles must be an array.");
	const allowed = new Set<WorkerDelegationProfile>(["planner", "reviewer", "verifier", "implementer"]);
	return value.map((item, index) => {
		if (typeof item !== "string") throw new Error(`goal_start workerDelegation.allowedProfiles[${index}] must be a string.`);
		const profile = item.trim();
		if (!allowed.has(profile as WorkerDelegationProfile)) throw new Error(`goal_start workerDelegation.allowedProfiles[${index}] must be one of: planner, reviewer, verifier, implementer.`);
		return profile as WorkerDelegationProfile;
	});
}

function normalizeSourcePlanSteps(value: unknown): SourcePlan["steps"] {
  if (!Array.isArray(value)) throw new Error("goal_start sourcePlan.steps must be an array.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`goal_start sourcePlan.steps[${index}] must be an object.`);
    const step = item as { step?: unknown; text?: unknown; completed?: unknown };
    if (typeof step.step !== "number" || !Number.isFinite(step.step)) throw new Error(`goal_start sourcePlan.steps[${index}].step must be a number.`);
    if (step.completed !== undefined && typeof step.completed !== "boolean") throw new Error(`goal_start sourcePlan.steps[${index}].completed must be a boolean.`);
    return {
      step: step.step,
      text: nonEmptyString(step.text, `sourcePlan.steps[${index}].text`),
      ...(step.completed === undefined ? {} : { completed: step.completed }),
    };
  });
}

function queueGoalStart(pi: GoalToolRegistry, goal: { id: string; runId: string; nextIterationId: number; objective: string }): void {
  queueGoalIteration(pi, goal, "Start the bounded goal loop.");
}

function queueGoalIteration(pi: GoalToolRegistry, goal: { id: string; runId: string; nextIterationId: number; objective: string }, instruction: string): void {
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

function normalizeGoalControlAction(value: unknown): GoalControlAction {
  if (value === "pause" || value === "resume" || value === "cancel" || value === "step") return value;
  throw new Error("goal_control action must be one of: pause, resume, cancel, step.");
}

function normalizeStatus(value: unknown): GoalReportStatus {
  if (value === "continue" || value === "blocked" || value === "done") return value;
  throw new Error("goal_report status must be one of: continue, blocked, done.");
}

function nonEmptyString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`goal_report ${key} must be a non-empty string.`);
  return value.trim();
}

function optionalString(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return nonEmptyString(value, key);
}

function stringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) throw new Error(`goal_report ${key} must be an array of strings.`);
  return value.map((item, index) => {
    if (typeof item !== "string") throw new Error(`goal_report ${key}[${index}] must be a string.`);
    return item.trim();
  }).filter(Boolean);
}

function toolResult(text: string, details: Record<string, unknown>): GoalToolResult {
  return {
    content: [{ type: "text", text }],
    details,
  };
}
