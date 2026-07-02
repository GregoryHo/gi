import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { markGoalModeInternalMessage } from "./messages.ts";
import { notifyGoalChanged, type GoalCommandRuntime } from "./commands.ts";
import type { GoalReport, GoalReportStatus, SourcePlan } from "./state.ts";
import { createGoalState, isRunnableGoalPhase, isTerminalGoalPhase, transitionGoalPhase } from "./state.ts";

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

const goalStartParameters = Type.Object({
  objective: Type.String({ description: "Goal objective to run as a bounded Goal Mode loop." }),
  acceptanceCriteria: Type.Optional(Type.Array(Type.String(), { description: "Goal-specific acceptance criteria." })),
  sourcePlan: Type.Optional(sourcePlanParameters),
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
    name: "goal_start",
    label: "Start Goal",
    description: "Start a bounded Goal Mode loop from explicit user intent, optionally using a source plan as advisory context.",
    promptSnippet: "Start a bounded Goal Mode objective when the user explicitly asks for goal-style execution",
    promptGuidelines: [
      "Use goal_start only when the user explicitly asks for Goal Mode, bounded autonomous completion, or to use goal to complete work.",
      "For 'use goal to complete the current plan', call plan_get_current first and pass its compact plan data as sourcePlan.",
      "Do not treat sourcePlan completed markers as verification proof; Goal Mode still requires concrete verification before done.",
    ],
    parameters: goalStartParameters,
    async execute(_toolCallId, params): Promise<GoalToolResult> {
      const startParams = normalizeGoalStartParams(params as GoalStartToolParams);
      if (runtime.activeGoal && !isTerminalGoalPhase(runtime.activeGoal.phase)) {
        return toolResult(`A goal is already ${runtime.activeGoal.phase}. Use Goal Mode controls before starting another goal.`, {
          accepted: false,
          reason: "goal_already_active",
          phase: runtime.activeGoal.phase,
        });
      }

      runtime.activeGoal = createGoalState({
        objective: startParams.objective,
        now: runtime.now(),
        acceptanceCriteria: startParams.acceptanceCriteria,
        sourcePlan: startParams.sourcePlan,
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

export function normalizeGoalStartParams(params: GoalStartToolParams): { objective: string; acceptanceCriteria?: string[]; sourcePlan?: SourcePlan } {
  return {
    objective: nonEmptyString(params.objective, "objective"),
    acceptanceCriteria: params.acceptanceCriteria === undefined ? undefined : stringArray(params.acceptanceCriteria, "acceptanceCriteria"),
    sourcePlan: params.sourcePlan === undefined ? undefined : normalizeSourcePlan(params.sourcePlan),
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
  pi.sendUserMessage?.(markGoalModeInternalMessage([
    "Start the bounded goal loop.",
    "",
    `Objective: ${goal.objective}`,
    "Work on exactly one bounded iteration, then report progress with goal_report.",
  ].join("\n"), {
    goalId: goal.id,
    runId: goal.runId,
    iterationId: goal.nextIterationId,
  }), { deliverAs: "followUp" });
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
