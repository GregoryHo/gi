import type { GoalReport } from "./state.ts";

export function hasVerificationEvidence(verification: readonly string[]): boolean {
  return verification.some((item) => item.trim().length > 0);
}

export function isGoalReportAcceptableForDone(report: GoalReport): boolean {
  return report.status === "done" && hasVerificationEvidence(report.verification);
}

export function buildMissingVerificationBlocker(): string {
  return "Missing verification evidence; cannot mark goal done without tests, checks, inspection evidence, or an explicit blocker.";
}
