import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
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
	readSessionCurrentPlanPointer,
  writeCurrentPlanPointer,
  writePlanArtifact,
	writeSessionCurrentPlanPointer,
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

  pi.registerTool({
    name: "plan_control",
    label: "Control Plan Mode",
    description: "Enable or disable Plan Mode read-only gates. Does not execute plans or start other extensions.",
    promptSnippet: "Control Plan Mode itself when the user asks to enable or disable planning gates",
    promptGuidelines: [
      "Use plan_control when the user explicitly asks to enable or disable Plan Mode.",
      "Do not use plan_control when the user only asks to inspect or show the current plan.",
      "plan_control does not execute plans, start goals, or delegate work; it only controls Plan Mode's own read-only gate.",
    ],
    parameters: Type.Object({
      action: Type.String({ description: "One of: enable, disable." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const action = normalizePlanControlAction((params as { action?: unknown }).action);
      if (action === "enable") enablePlanMode();
      else disablePlanMode();
      updateStatus(ctx);
      persistState();
      return toolResult(`Plan Mode ${action === "enable" ? "enabled" : "disabled"}.`, {
        accepted: true,
        enabled: planModeEnabled,
      });
    },
  });

  pi.registerTool({
    name: "plan_get_current",
    label: "Get Current Plan",
    description: "Return the current Plan Mode artifact as compact read-only data. Does not execute the plan or start Goal Mode.",
    promptSnippet: "Read the current Plan Mode plan artifact without changing plan state",
    promptGuidelines: [
      "Use plan_get_current when the user asks to inspect, show, or use the current plan as data.",
      "Calling plan_get_current does not execute the plan or change any plan state.",
      "Do not use plan_get_current as permission to execute work; it only returns compact plan data.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const artifact = await getCurrentPlanForTool(ctx);
      if (!artifact) {
        return toolResult("No current plan found.", { found: false });
      }
      const details = compactPlanToolDetails(artifact);
      return toolResult(`Current plan: ${artifact.title} (${artifact.status}).`, details);
    },
  });

	pi.registerTool({
		name: "plan_record",
		label: "Record Plan",
		description: "Create or refine a Plan Mode artifact from structured plan steps. Requires explicit disposition before replacing an active plan.",
		promptSnippet: "Record a new or refined plan while Plan Mode is active",
		promptGuidelines: [
			"Use plan_record when Plan Mode is active and the user asks you to generate or refine a plan.",
			"Use intent refine_current when the user is refining the current objective; preserve the current plan id.",
			"Use intent new for a distinct new objective only when no active plan would be silently overwritten.",
			"If an active plan exists, ask a natural disposition question and pass activePlanDisposition before replacing it.",
			"Do not ask the user to run /plan-new for ordinary new planning requests; use this tool when safe.",
		],
		parameters: Type.Object({
			intent: Type.String({ description: "One of: new, refine_current." }),
			title: Type.String({ description: "Compact plan title." }),
			steps: Type.Array(Type.Object({
				step: Type.Number({ description: "Original step number." }),
				text: Type.String({ description: "Plan step text." }),
			}), { description: "Numbered plan steps." }),
			activePlanDisposition: Type.Optional(Type.String({ description: "When replacing an active plan, one of: complete, abandon, pause." })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			return recordPlanFromTool(params, ctx);
		},
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

		const root = getArtifactRoot(ctx);
		const sessionFile = getSessionFile(ctx);
		if (!activePlanId && sessionFile) {
			activePlanId = (await readSessionCurrentPlanPointer(root, sessionFile)).activePlanId;
		}

    if (activePlanId) {
			activeArtifact = await readPlanArtifact(root, activePlanId);
			if (activeArtifact && !restored) {
				capturedPlan = { steps: activeArtifact.steps.map((step) => ({ ...step })) };
				executing = activeArtifact.status === "executing";
			}
			if (activeArtifact && sessionFile) {
				await writeSessionCurrentPlanPointer(root, sessionFile, { activePlanId });
			}
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
		await writePlanPointers(ctx, { activePlanId });
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
		await writePlanPointers(ctx, {});
    enablePlanMode();
    updateStatus(ctx);
    persistState();
    ctx.ui.notify("Ready to capture a new plan.", "info");
  }

	async function recordPlanFromTool(params: unknown, ctx: ExtensionContext) {
		const record = normalizePlanRecordParams(params);
		const plan: CapturedPlan = { steps: record.steps };
		const existing = await getActiveArtifact(ctx);

		if (record.intent === "refine_current") {
			if (!existing) return toolResult("No current plan to refine.", { accepted: false, reason: "no_current_plan" });
			capturedPlan = plan;
			activeArtifact = { ...updateArtifact(existing, existing.status, plan), title: record.title };
			activePlanId = activeArtifact.id;
			executing = false;
			await saveActiveArtifact(ctx, activeArtifact);
			enablePlanMode();
			updateStatus(ctx);
			persistState();
			return toolResult(`Plan refined: ${activeArtifact.title}.`, { accepted: true, ...compactPlanToolDetails(activeArtifact) });
		}

		if (existing && isActivePlanStatus(existing.status)) {
			if (!record.activePlanDisposition) {
				return toolResult("Active plan requires a disposition before recording a new plan.", {
					accepted: false,
					reason: "needs_disposition",
					currentPlan: compactPlanToolDetails(existing),
					allowedDispositions: ["complete", "abandon", "pause"],
				});
			}
			activeArtifact = updateArtifact(existing, dispositionToPlanStatus(record.activePlanDisposition), capturedPlan, true);
			await saveActiveArtifact(ctx, activeArtifact);
		}

		capturedPlan = plan;
		executing = false;
		const root = getArtifactRoot(ctx);
		const sessionFile = getSessionFile(ctx);
		activeArtifact = createPlanArtifact({
			now: new Date(),
			cwd: ctx.cwd,
			title: record.title,
			steps: plan.steps,
			sessionFile,
			sessionPlanNumber: await getNextSessionPlanNumber(root, sessionFile),
			previousPlanId: await getLatestSessionPlanId(root, sessionFile),
		});
		activePlanId = activeArtifact.id;
		await saveActiveArtifact(ctx, activeArtifact);
		enablePlanMode();
		updateStatus(ctx);
		persistState();
		return toolResult(`Plan recorded: ${activeArtifact.title}.`, { accepted: true, ...compactPlanToolDetails(activeArtifact) });
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

  async function getCurrentPlanForTool(ctx: ExtensionContext): Promise<PlanArtifactV1 | undefined> {
    const root = getArtifactRoot(ctx);
		const sessionFile = getSessionFile(ctx);
		const pointer = sessionFile ? await readSessionCurrentPlanPointer(root, sessionFile) : {};
    if (pointer.activePlanId) {
      const artifact = await readPlanArtifact(root, pointer.activePlanId);
      if (artifact) return artifact;
    }
    return getActiveArtifact(ctx);
  }

  async function saveActiveArtifact(ctx: ExtensionContext, artifact: PlanArtifactV1): Promise<void> {
    await writePlanArtifact(getArtifactRoot(ctx), artifact);
		await writePlanPointers(ctx, { activePlanId: artifact.id });
  }

	async function writePlanPointers(ctx: ExtensionContext, pointer: { activePlanId?: string }): Promise<void> {
		const root = getArtifactRoot(ctx);
		const sessionFile = getSessionFile(ctx);
		if (sessionFile) await writeSessionCurrentPlanPointer(root, sessionFile, pointer);
		await writeCurrentPlanPointer(root, pointer);
	}
}

function compactPlanToolDetails(artifact: PlanArtifactV1): Record<string, unknown> {
  return {
    found: true,
    planId: artifact.id,
    title: artifact.title,
    status: artifact.status,
    cwd: artifact.cwd,
    steps: artifact.steps.map((step) => ({
      step: step.step,
      text: step.text,
      ...(step.completed === undefined ? {} : { completed: step.completed }),
    })),
  };
}

function normalizePlanControlAction(value: unknown): "enable" | "disable" {
  if (value === "enable" || value === "disable") return value;
  throw new Error("plan_control action must be one of: enable, disable.");
}

interface PlanRecordParams {
  intent: "new" | "refine_current";
  title: string;
  steps: Array<{ step: number; text: string }>;
  activePlanDisposition?: "complete" | "abandon" | "pause";
}

function normalizePlanRecordParams(value: unknown): PlanRecordParams {
	if (!value || typeof value !== "object") throw new Error("plan_record params must be an object.");
	const candidate = value as { intent?: unknown; title?: unknown; steps?: unknown; activePlanDisposition?: unknown };
	const intent = normalizePlanRecordIntent(candidate.intent);
	const title = nonEmptyString(candidate.title, "title");
	const steps = normalizePlanRecordSteps(candidate.steps);
	const activePlanDisposition = candidate.activePlanDisposition === undefined
		? undefined
		: normalizePlanDisposition(candidate.activePlanDisposition);
	return { intent, title, steps, ...(activePlanDisposition ? { activePlanDisposition } : {}) };
}

function normalizePlanRecordIntent(value: unknown): PlanRecordParams["intent"] {
	if (value === "new" || value === "refine_current") return value;
	throw new Error("plan_record intent must be one of: new, refine_current.");
}

function normalizePlanDisposition(value: unknown): NonNullable<PlanRecordParams["activePlanDisposition"]> {
	if (value === "complete" || value === "abandon" || value === "pause") return value;
	throw new Error("plan_record activePlanDisposition must be one of: complete, abandon, pause.");
}

function normalizePlanRecordSteps(value: unknown): PlanRecordParams["steps"] {
	if (!Array.isArray(value) || value.length === 0) throw new Error("plan_record steps must be a non-empty array.");
	return value.map((item, index) => {
		if (!item || typeof item !== "object") throw new Error(`plan_record steps[${index}] must be an object.`);
		const step = item as { step?: unknown; text?: unknown };
		if (typeof step.step !== "number" || !Number.isFinite(step.step)) throw new Error(`plan_record steps[${index}].step must be a number.`);
		return { step: step.step, text: nonEmptyString(step.text, `steps[${index}].text`) };
	});
}

function dispositionToPlanStatus(disposition: NonNullable<PlanRecordParams["activePlanDisposition"]>): PlanStatus {
  if (disposition === "complete") return "completed";
  if (disposition === "abandon") return "abandoned";
  return "paused";
}

function nonEmptyString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`plan_record ${key} must be a non-empty string.`);
  return value.trim();
}

function toolResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
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
  return activeArtifact && isActivePlanStatus(activeArtifact.status) ? `${content}\n\n${formatActivePlanRoutingContext(activeArtifact)}` : content;
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
