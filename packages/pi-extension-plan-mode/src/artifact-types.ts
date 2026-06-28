import type { CapturedPlanStep } from "./plan.ts";

export const PLAN_ARTIFACT_SOURCE = "pi-extension-plan-mode";
export const PLAN_ARTIFACT_VERSION = 1;

export type PlanStatus = "draft" | "approved" | "executing" | "completed" | "abandoned" | "archived";

export interface PlanArtifactV1 {
  source: typeof PLAN_ARTIFACT_SOURCE;
  version: typeof PLAN_ARTIFACT_VERSION;
  id: string;
  title: string;
  status: PlanStatus;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  session: {
    primarySessionFile?: string;
    createdAtEntryId?: string;
    lastUpdatedEntryId?: string;
    completedAtEntryId?: string;
  };
  sequence: {
    sessionPlanNumber: number;
    previousPlanId?: string;
    nextPlanId?: string;
  };
  steps: CapturedPlanStep[];
  recap?: PlanRecap;
}

export interface PlanRecap {
  summary: string;
  completedSteps: number;
  totalSteps: number;
  verification?: string[];
  sessionRange?: {
    fromEntryId?: string;
    toEntryId?: string;
  };
}

export interface CreatePlanArtifactOptions {
  now: Date;
  cwd: string;
  title: string;
  steps: CapturedPlanStep[];
  sessionFile?: string;
  sessionPlanNumber: number;
  previousPlanId?: string;
}

export interface CurrentPlanPointer {
  activePlanId?: string;
}

export interface PlanIndexEntry {
  id: string;
  title: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  sessionFile?: string;
  sessionPlanNumber: number;
  artifactPath: string;
  summary: string;
}

export interface PlanIndex {
  plans: PlanIndexEntry[];
}

export function createPlanId(now: Date, title: string): string {
  return `plan_${formatTimestamp(now)}_${slugify(title) || "untitled"}`;
}

export function createPlanArtifact(options: CreatePlanArtifactOptions): PlanArtifactV1 {
  const timestamp = options.now.toISOString();
  return {
    source: PLAN_ARTIFACT_SOURCE,
    version: PLAN_ARTIFACT_VERSION,
    id: createPlanId(options.now, options.title),
    title: options.title,
    status: "draft",
    cwd: options.cwd,
    createdAt: timestamp,
    updatedAt: timestamp,
    session: {
      primarySessionFile: options.sessionFile,
    },
    sequence: {
      sessionPlanNumber: options.sessionPlanNumber,
      previousPlanId: options.previousPlanId,
    },
    steps: options.steps.map((step) => ({ ...step })),
  };
}

export function createDeterministicRecap(plan: PlanArtifactV1, verification?: string[]): PlanRecap {
  const completedSteps = plan.steps.filter((step) => step.completed === true).length;
  const totalSteps = plan.steps.length;
  return {
    summary: `Plan "${plan.title}" completed ${completedSteps}/${totalSteps} step(s).`,
    completedSteps,
    totalSteps,
    ...(verification && verification.length > 0 ? { verification } : {}),
  };
}

export function isActivePlanStatus(status: PlanStatus): boolean {
  return status === "draft" || status === "approved" || status === "executing";
}

export function planSummaryFromSteps(steps: readonly CapturedPlanStep[]): string {
  return steps[0]?.text ?? "No plan steps";
}

function formatTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "_");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
