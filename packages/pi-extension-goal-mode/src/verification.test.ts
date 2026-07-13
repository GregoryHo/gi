import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMissingVerificationBlocker,
  hasVerificationEvidence,
  isGoalReportAcceptableForDone,
} from "./verification.ts";

test("hasVerificationEvidence requires at least one non-empty evidence item", () => {
  assert.equal(hasVerificationEvidence([]), false);
  assert.equal(hasVerificationEvidence(["", "   "]), false);
  assert.equal(hasVerificationEvidence(["npm test passed"]), true);
});

test("isGoalReportAcceptableForDone requires traceable structured evidence", () => {
  assert.equal(isGoalReportAcceptableForDone({
    status: "done",
    summary: "Done",
    verification: ["npm test passed"],
		verificationEvidence: [{ kind: "command", reference: "npm test", summary: "Tests passed", status: "passed" }],
    completedCriteria: [],
    remainingCriteria: [],
  }), true);

  assert.equal(isGoalReportAcceptableForDone({
    status: "done",
    summary: "Done",
		verification: ["npm test passed"],
		verificationEvidence: [],
    completedCriteria: [],
    remainingCriteria: [],
  }), false);

  assert.equal(isGoalReportAcceptableForDone({
    status: "continue",
    summary: "Continue",
    verification: ["npm test passed"],
		verificationEvidence: [{ kind: "command", reference: "npm test", summary: "Tests passed", status: "passed" }],
    completedCriteria: [],
    remainingCriteria: [],
  }), false);
});

test("isGoalReportAcceptableForDone enforces an optional independent verifier gate", () => {
	const report = {
		status: "done" as const,
		summary: "Done",
		verification: ["npm test passed"],
		verificationEvidence: [{ kind: "command" as const, reference: "npm test", summary: "Tests passed", status: "passed" as const }],
		completedCriteria: [],
		remainingCriteria: [],
	};

	assert.equal(isGoalReportAcceptableForDone(report, { requireIndependentVerifier: true }), false);
	assert.equal(isGoalReportAcceptableForDone({
		...report,
		verificationEvidence: [...report.verificationEvidence, {
			kind: "worker",
			reference: "run_verifier_1",
			summary: "Independent verifier passed",
			status: "passed",
			independent: true,
		}],
	}, { requireIndependentVerifier: true }), true);
});

test("buildMissingVerificationBlocker returns model-facing blocker text", () => {
  assert.match(buildMissingVerificationBlocker(), /verification evidence/i);
  assert.match(buildMissingVerificationBlocker(), /cannot mark/i);
});
