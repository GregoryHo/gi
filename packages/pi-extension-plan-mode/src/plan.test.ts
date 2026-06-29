import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCapturedPlan,
  extractDoneSteps,
  formatCapturedPlan,
  isPlanComplete,
  markCompletedSteps,
} from "./plan.ts";

test("extractCapturedPlan extracts numbered steps from a Plan section", () => {
  const plan = extractCapturedPlan(`Analysis first.

Plan:
1. Inspect the current implementation.
2. Add focused tests.
3. Implement the smallest change.

Extra notes.`);

  assert.deepEqual(plan?.steps, [
    { step: 1, text: "Inspect the current implementation." },
    { step: 2, text: "Add focused tests." },
    { step: 3, text: "Implement the smallest change." },
  ]);
});

test("extractCapturedPlan ignores text without a valid Plan section", () => {
  assert.equal(extractCapturedPlan("I can help, but there is no numbered plan."), undefined);
  assert.equal(extractCapturedPlan("Plan:\n- Check files\n- Change code"), undefined);
});

test("formatCapturedPlan renders a compact numbered summary", () => {
  assert.equal(
    formatCapturedPlan({
      steps: [
        { step: 1, text: "Inspect code" },
        { step: 2, text: "Write tests" },
      ],
    }),
    "1. Inspect code\n2. Write tests",
  );
});

test("formatCapturedPlan can render completion markers", () => {
  assert.equal(
    formatCapturedPlan(
      {
        steps: [
          { step: 1, text: "Inspect code", completed: true },
          { step: 2, text: "Write tests" },
        ],
      },
      { showCompletion: true },
    ),
    "1. ☑ Inspect code\n2. ☐ Write tests",
  );
});

test("extractDoneSteps extracts unique done markers", () => {
  assert.deepEqual(extractDoneSteps("Finished [DONE:2], [DONE:1], and [DONE:2]."), [2, 1]);
});

test("extractDoneSteps ignores markers inside markdown code spans and blocks", () => {
  assert.deepEqual(extractDoneSteps("I did not mark `[DONE:10]`."), []);
  assert.deepEqual(extractDoneSteps("Do not count:\n```text\n[DONE:9]\n```\nBut count [DONE:2]."), [2]);
});

test("markCompletedSteps marks matching steps only", () => {
  const plan = {
    steps: [
      { step: 1, text: "Inspect code" },
      { step: 2, text: "Write tests" },
    ],
  };

  assert.equal(markCompletedSteps(plan, [2, 99]), 1);
  assert.deepEqual(plan.steps, [
    { step: 1, text: "Inspect code" },
    { step: 2, text: "Write tests", completed: true },
  ]);
  assert.equal(isPlanComplete(plan), false);

  markCompletedSteps(plan, [1]);
  assert.equal(isPlanComplete(plan), true);
});
