import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { getPlanModeToolNames, isReadOnlyBashCommand } from "./safety.ts";
import {
  filterPlanModeContextMessages,
  getLastPlanModeState,
  PLAN_MODE_CONTEXT_TYPE,
  PLAN_MODE_STATE_TYPE,
} from "./state.ts";

const PLAN_MODE_INSTRUCTIONS = `[PLAN MODE ACTIVE]
You are in read-only plan mode.

Rules:
- Inspect and reason, but do not make changes.
- Do not edit files or run write/destructive commands.
- Produce a concise implementation plan with risks and verification steps.
- If requirements are unclear, ask clarifying questions before planning.`;

export default function planModeExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false;
  let toolsBeforePlanMode: string[] | undefined;

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
  }

  function persistState(): void {
    pi.appendEntry(PLAN_MODE_STATE_TYPE, {
      enabled: planModeEnabled,
      toolsBeforePlanMode,
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

  pi.registerCommand("plan", {
    description: "Toggle read-only plan mode",
    handler: async (_args, ctx) => togglePlanMode(ctx),
  });

  pi.on("session_start", async (_event, ctx) => {
    const restored = getLastPlanModeState(ctx.sessionManager.getEntries());
    if (restored) {
      planModeEnabled = restored.enabled;
      toolsBeforePlanMode = restored.toolsBeforePlanMode;
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
}
