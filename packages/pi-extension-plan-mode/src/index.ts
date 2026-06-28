import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  extractCapturedPlan,
  extractDoneSteps,
  formatCapturedPlan,
  getPlanProgress,
  isPlanComplete,
  markCompletedSteps,
  type CapturedPlan,
} from "./plan.ts";
import { getPlanModeToolNames, isReadOnlyBashCommand } from "./safety.ts";
import {
  filterPlanModeContextMessages,
  getLastPlanModeState,
  PLAN_MODE_CONTEXT_TYPE,
  PLAN_MODE_STATE_TYPE,
} from "./state.ts";

const PLAN_EXECUTION_CONTEXT_TYPE = "plan-execution-context";

const PLAN_MODE_INSTRUCTIONS = `[PLAN MODE ACTIVE]
You are in read-only plan mode.

Rules:
- Inspect and reason, but do not make changes.
- Do not edit files or run write/destructive commands.
- Produce a concise implementation plan with risks and verification steps.
- If requirements are unclear, ask clarifying questions before planning.`;

const PLAN_CAPTURE_CHOICES = [
  "Stay in plan mode",
  "Refine the plan",
  "Approve plan and exit plan mode",
  "Execute the plan",
];

export default function planModeExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false;
  let toolsBeforePlanMode: string[] | undefined;
  let capturedPlan: CapturedPlan | undefined;
  let executing = false;

  pi.registerFlag("plan", {
    description: "Start in plan mode (read-only planning)",
    type: "boolean",
    default: false,
  });

  function enablePlanMode(): void {
    if (toolsBeforePlanMode === undefined) {
      toolsBeforePlanMode = pi.getActiveTools();
    }
    pi.setActiveTools(getPlanModeToolNames(toolsBeforePlanMode));
    planModeEnabled = true;
  }

  function disablePlanMode(): void {
    pi.setActiveTools(toolsBeforePlanMode ?? pi.getActiveTools());
    toolsBeforePlanMode = undefined;
    planModeEnabled = false;
  }

  function updateStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus(
      "plan-mode",
      planModeEnabled ? ctx.ui.theme.fg("warning", "⏸ plan") : undefined,
    );

    if (executing && capturedPlan) {
      const progress = getPlanProgress(capturedPlan);
      ctx.ui.setStatus("plan-progress", ctx.ui.theme.fg("accent", `📋 ${progress.completed}/${progress.total}`));
      ctx.ui.setWidget("plan-progress", capturedPlan.steps.map((step) => `${step.completed ? "☑" : "☐"} ${step.text}`));
    } else {
      ctx.ui.setStatus("plan-progress", undefined);
      ctx.ui.setWidget("plan-progress", undefined);
    }
  }

  function persistState(): void {
    pi.appendEntry(PLAN_MODE_STATE_TYPE, {
      enabled: planModeEnabled,
      toolsBeforePlanMode,
      capturedPlan,
      executing,
    });
  }

  function togglePlanMode(ctx: ExtensionContext): void {
    if (planModeEnabled) {
      disablePlanMode();
      ctx.ui.notify("Plan mode disabled. Restored previous tools.", "info");
    } else {
      enablePlanMode();
      ctx.ui.notify("Plan mode enabled. Write tools disabled.", "info");
    }
    updateStatus(ctx);
    persistState();
  }

  function notifyCurrentPlan(ctx: ExtensionContext): void {
    if (!capturedPlan) {
      ctx.ui.notify("No captured plan yet.", "info");
      return;
    }
    const showCompletion = executing || capturedPlan.steps.some((step) => step.completed === true);
    ctx.ui.notify(`Captured plan:\n${formatCapturedPlan(capturedPlan, { showCompletion })}`, "info");
  }

  function startExecution(ctx: ExtensionContext): void {
    if (!capturedPlan) {
      ctx.ui.notify("No captured plan to execute.", "info");
      return;
    }

    disablePlanMode();
    executing = true;
    updateStatus(ctx);
    persistState();

    pi.sendUserMessage(buildExecutionPrompt(capturedPlan), { deliverAs: "followUp" });
  }

  pi.registerCommand("plan", {
    description: "Toggle read-only plan mode",
    handler: async (_args, ctx) => togglePlanMode(ctx),
  });

  pi.registerCommand("plan-current", {
    description: "Show the latest captured plan",
    handler: async (_args, ctx) => notifyCurrentPlan(ctx),
  });

  pi.registerCommand("plan-execute", {
    description: "Execute the latest captured plan with progress tracking",
    handler: async (_args, ctx) => startExecution(ctx),
  });

  pi.on("session_start", async (_event, ctx) => {
    const restored = getLastPlanModeState(ctx.sessionManager.getEntries());
    if (restored) {
      planModeEnabled = restored.enabled;
      toolsBeforePlanMode = restored.toolsBeforePlanMode;
      capturedPlan = restored.capturedPlan;
      executing = restored.executing === true;
    }

    if (pi.getFlag("plan") === true) {
      planModeEnabled = true;
    }

    if (planModeEnabled) {
      enablePlanMode();
    }
    updateStatus(ctx);
  });

  pi.on("tool_call", async (event) => {
    if (!planModeEnabled || event.toolName !== "bash") return;

    const command = (event.input as { command?: unknown }).command;
    if (typeof command !== "string" || !isReadOnlyBashCommand(command)) {
      return {
        block: true,
        reason: `Plan mode blocked this bash command because it is not on the read-only allowlist. Disable /plan to leave plan mode.`,
      };
    }
  });

  pi.on("before_agent_start", async () => {
    if (executing && capturedPlan) {
      return {
        message: {
          customType: PLAN_EXECUTION_CONTEXT_TYPE,
          content: buildExecutionContext(capturedPlan),
          display: false,
        },
      };
    }

    if (!planModeEnabled) return;
    return {
      message: {
        customType: PLAN_MODE_CONTEXT_TYPE,
        content: PLAN_MODE_INSTRUCTIONS,
        display: false,
      },
    };
  });

  pi.on("context", async (event) => {
    if (planModeEnabled) return;
    return { messages: filterPlanModeContextMessages(event.messages) };
  });

  pi.on("agent_end", async (event, ctx) => {
    const text = getLatestAssistantText(event.messages);

    if (executing && capturedPlan) {
      if (!text) return;
      const changed = markCompletedSteps(capturedPlan, extractDoneSteps(text));
      if (changed === 0) return;

      if (isPlanComplete(capturedPlan)) {
        executing = false;
        updateStatus(ctx);
        persistState();
        ctx.ui.notify("Plan execution markers complete. Verify results before claiming success.", "info");
        return;
      }

      updateStatus(ctx);
      persistState();
      return;
    }

    if (!planModeEnabled || !text) return;

    const plan = extractCapturedPlan(text);
    if (!plan) return;

    capturedPlan = plan;
    persistState();

    const summary = formatCapturedPlan(plan);
    ctx.ui.notify(`Captured plan:\n${summary}`, "info");

    if (!ctx.hasUI) return;

    const choice = await ctx.ui.select("Plan captured - what next?", PLAN_CAPTURE_CHOICES);
    if (choice === "Refine the plan") {
      const refinement = await ctx.ui.editor("Refine the plan:", "");
      if (refinement?.trim()) {
        pi.sendUserMessage(refinement.trim(), { deliverAs: "followUp" });
      }
      return;
    }

    if (choice === "Approve plan and exit plan mode") {
      disablePlanMode();
      updateStatus(ctx);
      persistState();
      ctx.ui.notify("Plan approved. Plan mode disabled; no execution was started.", "info");
      return;
    }

    if (choice === "Execute the plan") {
      startExecution(ctx);
    }
  });
}

function buildExecutionPrompt(plan: CapturedPlan): string {
  const remaining = plan.steps.filter((step) => step.completed !== true);
  const first = remaining[0];
  return `Execute the approved plan.

Plan:
${formatCapturedPlan(plan, { showCompletion: true })}

Start with: ${first?.text ?? "the next remaining step"}
After completing each step, include [DONE:n] where n is the completed step number.`;
}

function buildExecutionContext(plan: CapturedPlan): string {
  const remaining = plan.steps.filter((step) => step.completed !== true);
  return `[EXECUTING PLAN]
Follow the approved plan one step at a time.
After completing step n, include [DONE:n] in your response.
Do not claim overall success until verification is complete.

Remaining steps:
${remaining.map((step) => `${step.step}. ${step.text}`).join("\n")}`;
}

function getLatestAssistantText(messages: readonly unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as { role?: unknown; content?: unknown };
    if (message?.role !== "assistant") continue;
    const text = getTextContent(message.content);
    if (text.length > 0) return text;
  }
  return undefined;
}

function getTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const candidate = block as { type?: unknown; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
    })
    .filter((text) => text.length > 0)
    .join("\n");
}
