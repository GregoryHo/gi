import type { PlanArtifactV1, PlanIndexEntry } from "./artifact-types.ts";

export interface ActivePlanRoutingOptions {
  maxSteps?: number;
}

export function formatActivePlanRoutingContext(
  plan: PlanArtifactV1,
  options: ActivePlanRoutingOptions = {},
): string {
  const maxSteps = options.maxSteps ?? 5;
  const completed = plan.steps.filter((step) => step.completed === true).length;
  const shownSteps = plan.steps.slice(0, maxSteps);
  const remaining = plan.steps.length - shownSteps.length;
  const stepLines = shownSteps.map((step) => `${step.step}. ${step.completed ? "☑" : "☐"} ${step.text}`);
  if (remaining > 0) stepLines.push(`... ${remaining} more step(s)`);

  return `[ACTIVE PLAN]
id: ${plan.id}
title: ${plan.title}
status: ${plan.status}
progress: ${completed}/${plan.steps.length}
steps:
${stepLines.join("\n")}

${buildPlanRoutingPolicy()}`;
}

export function buildPlanRoutingPolicy(): string {
  return `Routing rules:
- If the user refines this objective, update/refine the active plan and preserve the same active plan id.
- If the user asks for a distinct new objective, ask whether to start a new plan with /plan-new before changing state.
- If the user references a previous objective, suggest /plan-history or /plan-switch <id> instead of guessing.
- If the user intent is ambiguous, ask a clarifying question.
- Do not silently overwrite the active plan.
- Do not silently switch plans.
- Do not silently complete the active plan.
- Do not silently abandon the active plan.
- Do not call worker tools or start goal loops from plan routing.`;
}

export function formatRecentPlansRoutingHint(plans: readonly PlanIndexEntry[], maxPlans = 5): string {
  const lines = plans
    .slice(0, maxPlans)
    .map((plan) => `${plan.id} | ${plan.title} | ${plan.status} | session plan ${plan.sessionPlanNumber}`);
  return `[RECENT PLANS]\n${lines.join("\n")}`;
}
