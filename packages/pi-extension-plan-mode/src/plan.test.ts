import assert from "node:assert/strict";
import test from "node:test";

import { extractCapturedPlan, formatCapturedPlan } from "./plan.ts";

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
