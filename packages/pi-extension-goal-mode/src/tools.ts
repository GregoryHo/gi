import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { notifyGoalChanged, type GoalCommandRuntime } from "./commands.ts";
import type { GoalReport, GoalReportStatus } from "./state.ts";
import { isRunnableGoalPhase, isTerminalGoalPhase, transitionGoalPhase } from "./state.ts";

type ToolDefinition = Parameters<ExtensionAPI["registerTool"]>[0];

interface GoalToolRegistry {
  registerTool(tool: ToolDefinition): void;
}

interface GoalToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
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
