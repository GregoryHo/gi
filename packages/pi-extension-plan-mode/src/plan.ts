export interface CapturedPlanStep {
  step: number;
  text: string;
}

export interface CapturedPlan {
  steps: CapturedPlanStep[];
}

export function extractCapturedPlan(text: string): CapturedPlan | undefined {
  const header = text.match(/^\s*\*{0,2}Plan:\*{0,2}\s*$/im);
  if (!header || header.index === undefined) return undefined;

  const planText = text.slice(header.index + header[0].length);
  const steps: CapturedPlanStep[] = [];

  for (const line of planText.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/);
    if (!match) {
      if (steps.length > 0 && line.trim() === "") break;
      continue;
    }

    const text = cleanPlanStepText(match[2]);
    if (text.length === 0) continue;
    steps.push({ step: Number(match[1]), text });
  }

  return steps.length > 0 ? { steps } : undefined;
}

export function formatCapturedPlan(plan: CapturedPlan): string {
  return plan.steps.map((step) => `${step.step}. ${step.text}`).join("\n");
}

function cleanPlanStepText(text: string): string {
  return text
    .replace(/^\*+|\*+$/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
