export interface CapturedPlanStep {
  step: number;
  text: string;
  completed?: boolean;
}

export interface CapturedPlan {
  steps: CapturedPlanStep[];
}

export interface FormatCapturedPlanOptions {
  showCompletion?: boolean;
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

export function formatCapturedPlan(plan: CapturedPlan, options: FormatCapturedPlanOptions = {}): string {
  return plan.steps
    .map((step) => {
      const marker = options.showCompletion ? `${step.completed ? "☑" : "☐"} ` : "";
      return `${step.step}. ${marker}${step.text}`;
    })
    .join("\n");
}

export function extractDoneSteps(text: string): number[] {
  const steps: number[] = [];
  for (const match of text.matchAll(/\[DONE:(\d+)\]/gi)) {
    const step = Number(match[1]);
    if (Number.isFinite(step) && !steps.includes(step)) steps.push(step);
  }
  return steps;
}

export function markCompletedSteps(plan: CapturedPlan, doneSteps: readonly number[]): number {
  let changed = 0;
  for (const doneStep of doneSteps) {
    const step = plan.steps.find((candidate) => candidate.step === doneStep);
    if (!step || step.completed) continue;
    step.completed = true;
    changed += 1;
  }
  return changed;
}

export function isPlanComplete(plan: CapturedPlan): boolean {
  return plan.steps.length > 0 && plan.steps.every((step) => step.completed === true);
}

export function getPlanProgress(plan: CapturedPlan): { completed: number; total: number } {
  return {
    completed: plan.steps.filter((step) => step.completed === true).length,
    total: plan.steps.length,
  };
}

function cleanPlanStepText(text: string): string {
  return text
    .replace(/^\*+|\*+$/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
