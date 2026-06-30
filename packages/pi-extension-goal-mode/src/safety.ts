import { notifyGoalChanged, type GoalCommandRuntime } from "./commands.ts";
import { isRunnableGoalPhase } from "./state.ts";

interface GoalSafetyAPI {
  on(event: "tool_call", handler: (event: GoalToolCallEvent, ctx: GoalSafetyContext) => Promise<GoalToolBlock | undefined> | GoalToolBlock | undefined): void;
}

interface GoalToolCallEvent {
  toolName: string;
  input?: Record<string, unknown>;
}

interface GoalSafetyContext {
  hasUI?: boolean;
  ui?: {
    confirm?(title: string, message: string): Promise<boolean> | boolean;
  };
}

interface GoalToolBlock {
  block: true;
  reason: string;
}

const WRITE_TOOLS = new Set(["edit", "write"]);

const DANGEROUS_BASH_PATTERNS = [
  /(^|\s)(rm|rmdir|mv|cp|mkdir|touch|chmod|chown|chgrp|ln|tee|truncate|dd|shred)(\s|$)/i,
  /(^|\s)git\s+(add|commit|push|pull|merge|rebase|reset|checkout|switch|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)(\s|$)/i,
  /(^|\s)npm\s+(install|uninstall|update|ci|link|publish)(\s|$)/i,
  /(^|\s)(yarn|pnpm)\s+(add|remove|install|publish)(\s|$)/i,
  /(^|\s)pip\s+(install|uninstall)(\s|$)/i,
  /(^|\s)sudo(\s|$)/i,
  /(^|\s)(kill|pkill|killall|reboot|shutdown)(\s|$)/i,
  /(^|[^<])>(?!>)/,
  />>/,
];

const AMBIGUOUS_SHELL_OPERATORS = [/;/, /&&/, /\|\|/, /\|/];

const READ_ONLY_OR_VERIFICATION_PATTERNS = [
  /^\s*(pwd|ls|cat|head|tail|less|more|grep|rg|find|fd|wc|sort|uniq|diff|file|stat|du|df|tree|which|whereis|type|env|printenv|uname|whoami|id|date|ps)\b/i,
  /^\s*git\s+(status|log|diff|show|branch|remote)(\s|$)/i,
  /^\s*git\s+config\s+--get\b/i,
  /^\s*git\s+ls-/i,
  /^\s*npm\s+(test|list|ls|view|info|search|outdated|audit)(\s|$)/i,
  /^\s*npm\s+run\s+(test|typecheck|lint|check)(\s|$)/i,
  /^\s*(yarn|pnpm)\s+(test|list|info|why|audit)(\s|$)/i,
  /^\s*(node|python|python3)\s+--version\b/i,
];

export function registerGoalSafety(pi: GoalSafetyAPI, runtime: GoalCommandRuntime): void {
  pi.on("tool_call", async (event, ctx) => {
    const goal = runtime.activeGoal;
    if (!goal || !isRunnableGoalPhase(goal.phase)) return;

    if (WRITE_TOOLS.has(event.toolName)) {
      if (goal.approvals.writesApproved) return;
      const approved = await confirm(ctx, "Approve Goal Mode file writes?", "The active goal is requesting edit/write access. Allow file mutation for this goal?");
      if (!approved) return block("Goal Mode write/edit requires explicit approval.");
      runtime.activeGoal = {
        ...goal,
        approvals: { ...goal.approvals, writesApproved: true },
      };
      notifyGoalChanged(runtime);
      return;
    }

    if (event.toolName === "bash") {
      const command = typeof event.input?.command === "string" ? event.input.command : "";
      if (isReadOnlyOrVerificationBashCommand(command)) return;
      if (goal.approvals.destructiveBashApproved) return;
      const approved = await confirm(ctx, "Approve Goal Mode bash command?", `The active goal is requesting a destructive or ambiguous bash command:\n\n${command}\n\nAllow destructive/ambiguous bash for this goal?`);
      if (!approved) return block("Goal Mode blocked destructive or ambiguous bash without approval.");
      runtime.activeGoal = {
        ...goal,
        approvals: { ...goal.approvals, destructiveBashApproved: true },
      };
      notifyGoalChanged(runtime);
    }
  });
}

export function isReadOnlyOrVerificationBashCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (DANGEROUS_BASH_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
  if (AMBIGUOUS_SHELL_OPERATORS.some((pattern) => pattern.test(trimmed))) return false;
  return READ_ONLY_OR_VERIFICATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

async function confirm(ctx: GoalSafetyContext, title: string, message: string): Promise<boolean> {
  if (!ctx.hasUI || !ctx.ui?.confirm) return false;
  return ctx.ui.confirm(title, message);
}

function block(reason: string): GoalToolBlock {
  return { block: true, reason };
}
