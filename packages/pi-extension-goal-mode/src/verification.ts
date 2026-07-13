import type { GoalReport, VerificationEvidence, VerificationPolicy } from "./state.ts";

export function hasVerificationEvidence(verification: readonly string[]): boolean {
  return verification.some((item) => item.trim().length > 0);
}

export function hasTraceableVerificationEvidence(evidence: readonly VerificationEvidence[] | undefined): boolean {
	return evidence?.some((item) => item.status === "passed" && item.reference.trim().length > 0 && item.summary.trim().length > 0) ?? false;
}

export function hasIndependentVerifierEvidence(evidence: readonly VerificationEvidence[] | undefined): boolean {
	return evidence?.some((item) => item.kind === "worker" && item.independent === true && item.status === "passed") ?? false;
}

export function isGoalReportAcceptableForDone(report: GoalReport, policy?: VerificationPolicy): boolean {
	if (report.status !== "done" || !hasVerificationEvidence(report.verification) || !hasTraceableVerificationEvidence(report.verificationEvidence)) {
		return false;
	}
	return !policy?.requireIndependentVerifier || hasIndependentVerifierEvidence(report.verificationEvidence);
}

export function buildMissingVerificationBlocker(policy?: VerificationPolicy): string {
	if (policy?.requireIndependentVerifier) {
		return "Missing traceable verification evidence or an independent passed verifier-worker result; cannot mark goal done.";
	}
	return "Missing traceable verification evidence; cannot mark goal done without a passed command, artifact, inspection, or verifier-worker reference.";
}
