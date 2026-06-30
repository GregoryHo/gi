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

test("isGoalReportAcceptableForDone only accepts done reports with evidence", () => {
  assert.equal(isGoalReportAcceptableForDone({
    status: "done",
    summary: "Done",
    verification: ["npm test passed"],
    completedCriteria: [],
    remainingCriteria: [],
  }), true);

  assert.equal(isGoalReportAcceptableForDone({
    status: "done",
    summary: "Done",
    verification: [],
    completedCriteria: [],
    remainingCriteria: [],
  }), false);

  assert.equal(isGoalReportAcceptableForDone({
    status: "continue",
    summary: "Continue",
    verification: ["npm test passed"],
    completedCriteria: [],
    remainingCriteria: [],
  }), false);
});

test("buildMissingVerificationBlocker returns model-facing blocker text", () => {
  assert.match(buildMissingVerificationBlocker(), /verification evidence/i);
  assert.match(buildMissingVerificationBlocker(), /cannot mark/i);
});
