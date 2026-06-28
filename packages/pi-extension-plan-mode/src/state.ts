import type { CapturedPlan } from "./plan.ts";

export const PLAN_MODE_STATE_TYPE = "plan-mode";
export const PLAN_MODE_CONTEXT_TYPE = "plan-mode-context";

export interface PlanModeState {
  enabled: boolean;
  toolsBeforePlanMode?: string[];
  capturedPlan?: CapturedPlan;
  executing?: boolean;
}

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
}

export function getLastPlanModeState(entries: readonly unknown[]): PlanModeState | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index] as CustomEntryLike;
    if (entry?.type !== "custom" || entry.customType !== PLAN_MODE_STATE_TYPE) continue;
    const state = parsePlanModeState(entry.data);
    if (state) return state;
  }
  return undefined;
}

export function filterPlanModeContextMessages<T>(messages: readonly T[]): T[] {
  return messages.filter((message) => !isPlanModeContextMessage(message));
}

function parsePlanModeState(data: unknown): PlanModeState | undefined {
  if (!data || typeof data !== "object") return undefined;
  const state = data as { enabled?: unknown; toolsBeforePlanMode?: unknown; capturedPlan?: unknown; executing?: unknown };
  if (typeof state.enabled !== "boolean") return undefined;
  if (state.toolsBeforePlanMode !== undefined && !isStringArray(state.toolsBeforePlanMode)) return undefined;
  if (state.capturedPlan !== undefined && !isCapturedPlan(state.capturedPlan)) return undefined;
  if (state.executing !== undefined && typeof state.executing !== "boolean") return undefined;
  return {
    enabled: state.enabled,
    toolsBeforePlanMode: state.toolsBeforePlanMode,
    capturedPlan: state.capturedPlan,
    executing: state.executing,
  };
}

function isCapturedPlan(value: unknown): value is CapturedPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as { steps?: unknown };
  return (
    Array.isArray(plan.steps) &&
    plan.steps.length > 0 &&
    plan.steps.every((step) => {
      if (!step || typeof step !== "object") return false;
      const candidate = step as { step?: unknown; text?: unknown; completed?: unknown };
      return (
        typeof candidate.step === "number" &&
        Number.isFinite(candidate.step) &&
        typeof candidate.text === "string" &&
        (candidate.completed === undefined || typeof candidate.completed === "boolean")
      );
    })
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlanModeContextMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const candidate = message as { customType?: unknown; role?: unknown; content?: unknown };
  if (candidate.customType === PLAN_MODE_CONTEXT_TYPE) return true;
  return containsPlanModeMarker(candidate.content);
}

function containsPlanModeMarker(content: unknown): boolean {
  if (typeof content === "string") return content.includes("[PLAN MODE ACTIVE]");
  if (!Array.isArray(content)) return false;
  return content.some((item) => {
    if (!item || typeof item !== "object") return false;
    const block = item as { type?: unknown; text?: unknown };
    return block.type === "text" && typeof block.text === "string" && block.text.includes("[PLAN MODE ACTIVE]");
  });
}
