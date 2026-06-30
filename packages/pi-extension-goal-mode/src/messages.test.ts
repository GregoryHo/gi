import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractGoalModeInternalMessage,
  GOAL_MODE_INTERNAL_MESSAGE_MARKER,
  markGoalModeInternalMessage,
} from "./messages.ts";

test("markGoalModeInternalMessage includes goal follow-up token metadata", () => {
  const marked = markGoalModeInternalMessage("Continue", {
    goalId: "goal_1",
    runId: "run_1",
    iterationId: 2,
  });

  assert.equal(marked.startsWith(GOAL_MODE_INTERNAL_MESSAGE_MARKER), true);
  const extracted = extractGoalModeInternalMessage(marked);
  assert.deepEqual(extracted, {
    metadata: {
      goalId: "goal_1",
      runId: "run_1",
      iterationId: 2,
    },
    text: "Continue",
  });
});

test("extractGoalModeInternalMessage returns undefined for ordinary text", () => {
  assert.equal(extractGoalModeInternalMessage("ordinary text"), undefined);
});
