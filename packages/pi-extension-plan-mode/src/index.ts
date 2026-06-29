import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  createDeterministicRecap,
  createPlanArtifact,
  isActivePlanStatus,
  type PlanArtifactV1,
  type PlanStatus,
} from "./artifact-types.ts";
import {
  getLatestSessionPlanId,
  getNextSessionPlanNumber,
  getPlanModeProjectDir,
  listPlanIndexEntries,
  readPlanArtifact,
  writeCurrentPlanPointer,
  writePlanArtifact,
} from "./artifacts.ts";
import {
  extractCapturedPlan,
  extractDoneSteps,
  formatCapturedPlan,
  getPlanProgress,
  isPlanComplete,
  markCompletedSteps,
  type CapturedPlan,
} from "./plan.ts";
import { formatActivePlanRoutingContext } from "./routing.ts";
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

const PLAN_NEW_DISPOSITION_CHOICES = ["Complete current plan", "Abandon current plan", "Pause current plan", "Cancel"];

export default function planModeExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false;
  let toolsBeforePlanMode: string[] | undefined;
  let capturedPlan: CapturedPlan | undefined;
  let executing = false;
  let activePlanId: string | undefined;
  let activeArtifact: PlanArtifactV1 | undefined;

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
      activePlanId,
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

  async function notifyCurrentPlan(ctx: ExtensionContext): Promise<void> {
    if (!capturedPlan) {
      ctx.ui.notify("No captured plan yet.", "info");
      return;
    }
    const showCompletion = executing || capturedPlan.steps.some((step) => step.completed === true);
    const metadata = activeArtifact
      ? `Plan ${activeArtifact.id}\nstatus: ${activeArtifact.status}\nsession plan: ${activeArtifact.sequence.sessionPlanNumber}\ntitle: ${activeArtifact.title}\n`
      : "";
    ctx.ui.notify(`Captured plan:\n${metadata}${formatCapturedPlan(capturedPlan, { showCompletion })}`, "info");
  }

  async function startExecution(ctx: ExtensionContext): Promise<void> {
    if (!capturedPlan) {
      ctx.ui.notify("No captured plan to execute.", "info");
      return;
    }

    const artifact = await ensureActiveArtifact(ctx, capturedPlan);
    activeArtifact = updateArtifact(artifact, "executing", capturedPlan);
    await saveActiveArtifact(ctx, activeArtifact);

    disablePlanMode();
    executing = true;
    activePlanId = activeArtifact.id;
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

  pi.registerCommand("plan-history", {
    description: "Show recent plan artifacts",
    handler: async (args, ctx) => showPlanHistory(args, ctx),
  });

  pi.registerCommand("plan-switch", {
    description: "Switch to an existing plan artifact",
    handler: async (args, ctx) => switchPlan(args, ctx),
  });

  pi.registerCommand("plan-complete", {
    description: "Mark the active plan completed",
    handler: async (_args, ctx) => finishActivePlan(ctx, "completed"),
  });

  pi.registerCommand("plan-abandon", {
    description: "Mark the active plan abandoned",
    handler: async (_args, ctx) => finishActivePlan(ctx, "abandoned"),
  });

  pi.registerCommand("plan-new", {
    description: "Start a new active plan flow",
    handler: async (_args, ctx) => startNewPlanFlow(ctx),
  });

  pi.on("session_start", async (_event, ctx) => {
    const restored = getLastPlanModeState(ctx.sessionManager.getEntries());
    if (restored) {
      planModeEnabled = restored.enabled;
      toolsBeforePlanMode = restored.toolsBeforePlanMode;
      capturedPlan = restored.capturedPlan;
      executing = restored.executing === true;
      activePlanId = restored.activePlanId;
    }

    if (activePlanId) {
      activeArtifact = await readPlanArtifact(getArtifactRoot(ctx), activePlanId);
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
          content: appendRoutingContext(buildExecutionContext(capturedPlan), activeArtifact),
          display: false,
        },
      };
    }

    if (!planModeEnabled) return;
    return {
      message: {
        customType: PLAN_MODE_CONTEXT_TYPE,
        content: appendRoutingContext(PLAN_MODE_INSTRUCTIONS, activeArtifact),
        display: false,
      },
    };
  });

  pi.on("context", async (event) => {
    if (planModeEnabled) return;
    return { messages: filterPlanModeContextMessages(event.messages) };
  });

  pi.on("agent_end", async (event, ctx) => {
    if (executing && capturedPlan) {
      const text = getAllAssistantText(event.messages);
      if (!text) return;
      const changed = markCompletedSteps(capturedPlan, extractDoneSteps(text));
      if (changed === 0) return;

      if (activeArtifact) {
        activeArtifact = updateArtifact(activeArtifact, activeArtifact.status, capturedPlan);
      }

      if (isPlanComplete(capturedPlan)) {
        executing = false;
        if (activeArtifact) activeArtifact = updateArtifact(activeArtifact, "completed", capturedPlan, true);
        if (activeArtifact) await saveActiveArtifact(ctx, activeArtifact);
        updateStatus(ctx);
        persistState();
        ctx.ui.notify("Plan execution markers complete. Verify results before claiming success.", "info");
        return;
      }

      if (activeArtifact) await saveActiveArtifact(ctx, activeArtifact);
      updateStatus(ctx);
      persistState();
      return;
    }

    const text = getLatestAssistantText(event.messages);
    if (!planModeEnabled || !text) return;

    const plan = extractCapturedPlan(text);
    if (!plan) return;

    capturedPlan = plan;
    activeArtifact = await ensureActiveArtifact(ctx, plan);
    activeArtifact = updateArtifact(activeArtifact, activeArtifact.status, plan);
    await saveActiveArtifact(ctx, activeArtifact);
    activePlanId = activeArtifact.id;
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
      activeArtifact = updateArtifact(activeArtifact, "approved", plan);
      await saveActiveArtifact(ctx, activeArtifact);
      disablePlanMode();
      updateStatus(ctx);
      persistState();
      ctx.ui.notify("Plan approved. Plan mode disabled; no execution was started.", "info");
      return;
    }

    if (choice === "Execute the plan") {
      await startExecution(ctx);
    }
  });

  async function showPlanHistory(args: string, ctx: ExtensionContext): Promise<void> {
    const sessionFile = args.includes("--session") ? getSessionFile(ctx) : undefined;
    const entries = await listPlanIndexEntries(getArtifactRoot(ctx), { cwd: ctx.cwd, sessionFile });
    if (entries.length === 0) {
      ctx.ui.notify("No plan history found.", "info");
      return;
    }
    ctx.ui.notify(
      entries
        .map((entry) => `${entry.id} | ${entry.title} | ${entry.status} | session plan ${entry.sessionPlanNumber} | ${entry.updatedAt}`)
        .join("\n"),
      "info",
    );
  }

  async function switchPlan(args: string, ctx: ExtensionContext): Promise<void> {
    const planId = args.trim();
    if (!planId) {
      ctx.ui.notify("Usage: /plan-switch <id>", "info");
      return;
    }
    const artifact = await readPlanArtifact(getArtifactRoot(ctx), planId);
    if (!artifact) {
      ctx.ui.notify(`Plan not found: ${planId}`, "warning");
      return;
    }

    activeArtifact = artifact;
    activePlanId = artifact.id;
    capturedPlan = { steps: artifact.steps.map((step) => ({ ...step })) };
    executing = artifact.status === "executing";
    await writeCurrentPlanPointer(getArtifactRoot(ctx), { activePlanId });
    updateStatus(ctx);
    persistState();
    ctx.ui.notify(`Switched to plan ${artifact.id}: ${artifact.title}`, "info");
  }

  async function finishActivePlan(ctx: ExtensionContext, status: "completed" | "abandoned"): Promise<void> {
    const artifact = (await getActiveArtifact(ctx)) ?? (capturedPlan ? await ensureActiveArtifact(ctx, capturedPlan) : undefined);
    if (!artifact) {
      ctx.ui.notify("No active plan.", "info");
      return;
    }
    activePlanId = artifact.id;
    activeArtifact = updateArtifact(artifact, status, capturedPlan, true);
    capturedPlan = { steps: activeArtifact.steps.map((step) => ({ ...step })) };
    executing = false;
    await saveActiveArtifact(ctx, activeArtifact);
    updateStatus(ctx);
    persistState();
    ctx.ui.notify(`Plan ${activeArtifact.id} ${status}.`, "info");
  }

  async function startNewPlanFlow(ctx: ExtensionContext): Promise<void> {
    const artifact = await getActiveArtifact(ctx);
    if (artifact && isActivePlanStatus(artifact.status)) {
      if (!ctx.hasUI) {
        ctx.ui.notify("Active plan exists. Complete, abandon, or switch it before /plan-new.", "warning");
        return;
      }
      const disposition = await ctx.ui.select("Active plan exists - disposition?", PLAN_NEW_DISPOSITION_CHOICES);
      if (disposition === "Cancel" || disposition === undefined) {
        ctx.ui.notify("Plan new cancelled.", "info");
        return;
      }
      if (disposition === "Complete current plan") activeArtifact = updateArtifact(artifact, "completed", capturedPlan, true);
      if (disposition === "Abandon current plan") activeArtifact = updateArtifact(artifact, "abandoned", capturedPlan, true);
      if (disposition === "Pause current plan") activeArtifact = updateArtifact(artifact, "paused", capturedPlan, true);
      if (activeArtifact) await saveActiveArtifact(ctx, activeArtifact);
    }

    capturedPlan = undefined;
    activePlanId = undefined;
    activeArtifact = undefined;
    executing = false;
    await writeCurrentPlanPointer(getArtifactRoot(ctx), {});
    enablePlanMode();
    updateStatus(ctx);
    persistState();
    ctx.ui.notify("Ready to capture a new plan.", "info");
  }

  async function ensureActiveArtifact(ctx: ExtensionContext, plan: CapturedPlan): Promise<PlanArtifactV1> {
    if (activeArtifact && activePlanId === activeArtifact.id && !isTerminalPlanStatus(activeArtifact.status)) return activeArtifact;

    const root = getArtifactRoot(ctx);
    const sessionFile = getSessionFile(ctx);
    const now = new Date();
    const artifact = createPlanArtifact({
      now,
      cwd: ctx.cwd,
      title: deriveTitle(plan),
      steps: plan.steps,
      sessionFile,
      sessionPlanNumber: await getNextSessionPlanNumber(root, sessionFile),
      previousPlanId: await getLatestSessionPlanId(root, sessionFile),
    });
    activePlanId = artifact.id;
    return artifact;
  }

  async function getActiveArtifact(ctx: ExtensionContext): Promise<PlanArtifactV1 | undefined> {
    if (activeArtifact) return activeArtifact;
    if (!activePlanId) return undefined;
    activeArtifact = await readPlanArtifact(getArtifactRoot(ctx), activePlanId);
    return activeArtifact;
  }

  async function saveActiveArtifact(ctx: ExtensionContext, artifact: PlanArtifactV1): Promise<void> {
    await writePlanArtifact(getArtifactRoot(ctx), artifact);
    await writeCurrentPlanPointer(getArtifactRoot(ctx), { activePlanId: artifact.id });
  }
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

function getAllAssistantText(messages: readonly unknown[]): string | undefined {
  const text = messages
    .map((message) => {
      const candidate = message as { role?: unknown; content?: unknown };
      return candidate?.role === "assistant" ? getTextContent(candidate.content) : "";
    })
    .filter((content) => content.length > 0)
    .join("\n");
  return text.length > 0 ? text : undefined;
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

function appendRoutingContext(content: string, activeArtifact: PlanArtifactV1 | undefined): string {
  return activeArtifact ? `${content}\n\n${formatActivePlanRoutingContext(activeArtifact)}` : content;
}

function getArtifactRoot(ctx: ExtensionContext): string {
  return process.env.PI_PLAN_MODE_ARTIFACT_ROOT ?? getPlanModeProjectDir(join(homedir(), ".pi/agent"), ctx.cwd);
}

function getSessionFile(ctx: ExtensionContext): string | undefined {
  return ctx.sessionManager.getSessionFile();
}

function deriveTitle(plan: CapturedPlan): string {
  return plan.steps[0]?.text.slice(0, 80) || "Untitled plan";
}

function updateArtifact(
  artifact: PlanArtifactV1,
  status: PlanStatus,
  plan: CapturedPlan | undefined,
  includeRecap = false,
): PlanArtifactV1 {
  const updated: PlanArtifactV1 = {
    ...artifact,
    status,
    updatedAt: new Date().toISOString(),
    steps: (plan?.steps ?? artifact.steps).map((step) => ({ ...step })),
  };
  if (status === "completed") {
    updated.session = { ...updated.session, completedAtEntryId: updated.session.completedAtEntryId };
  }
  if (includeRecap) updated.recap = createDeterministicRecap(updated);
  return updated;
}

function isTerminalPlanStatus(status: PlanStatus): boolean {
  return status === "paused" || status === "completed" || status === "abandoned";
}
