import assert from "node:assert/strict";
import test from "node:test";

import { filterPlanModeContextMessages, getLastPlanModeState } from "./state.ts";

test("getLastPlanModeState returns the latest custom plan-mode entry", () => {
  const entries = [
    { type: "custom", customType: "plan-mode", data: { enabled: true, toolsBeforePlanMode: ["read"] } },
    { type: "custom", customType: "other", data: { enabled: false } },
    {
      type: "custom",
      customType: "plan-mode",
      data: {
        enabled: false,
        toolsBeforePlanMode: ["read", "edit"],
        capturedPlan: { steps: [{ step: 1, text: "Inspect code", completed: true }] },
        executing: true,
      },
    },
  ];

  assert.deepEqual(getLastPlanModeState(entries), {
    enabled: false,
    toolsBeforePlanMode: ["read", "edit"],
    capturedPlan: { steps: [{ step: 1, text: "Inspect code", completed: true }] },
    executing: true,
  });
});

test("getLastPlanModeState ignores malformed state", () => {
  const entries = [{ type: "custom", customType: "plan-mode", data: { enabled: "yes" } }];

  assert.equal(getLastPlanModeState(entries), undefined);
});

test("filterPlanModeContextMessages removes hidden plan-mode context", () => {
  const keep = { role: "user", content: [{ type: "text", text: "hello" }] };
  const messages = [
    keep,
    { customType: "plan-mode-context", content: "[PLAN MODE ACTIVE]", display: false },
    { role: "user", content: [{ type: "text", text: "[PLAN MODE ACTIVE] stale" }] },
  ];

  assert.deepEqual(filterPlanModeContextMessages(messages), [keep]);
});
