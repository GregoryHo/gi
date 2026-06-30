import assert from "node:assert/strict";
import { test } from "node:test";

import { createGoalCommandRuntime } from "./commands.ts";
import { registerGoalSafety, isReadOnlyOrVerificationBashCommand } from "./safety.ts";
import { createGoalState } from "./state.ts";

const NOW = new Date("2026-06-30T02:40:33.000Z");

function createHarness() {
  const handlers = new Map<string, Function>();
  const runtime = createGoalCommandRuntime({ now: () => NOW });
  const pi = {
    on(event: string, handler: Function) {
      handlers.set(event, handler);
    },
  };
  registerGoalSafety(pi, runtime);
  return { handlers, runtime };
}

test("isReadOnlyOrVerificationBashCommand allows read-only and test commands", () => {
  assert.equal(isReadOnlyOrVerificationBashCommand("ls -la"), true);
  assert.equal(isReadOnlyOrVerificationBashCommand("npm test --workspace @gregho/pi-extension-goal-mode"), true);
  assert.equal(isReadOnlyOrVerificationBashCommand("npm run typecheck --workspace @gregho/pi-extension-goal-mode"), true);
  assert.equal(isReadOnlyOrVerificationBashCommand("rm -rf dist"), false);
  assert.equal(isReadOnlyOrVerificationBashCommand("npm install"), false);
});

test("registerGoalSafety allows tools when no goal is active", async () => {
  const { handlers } = createHarness();

  const result = await handlers.get("tool_call")!({ toolName: "edit", input: {} }, { hasUI: false });

  assert.equal(result, undefined);
});

test("registerGoalSafety does not apply Goal Mode gates for paused or cancelled goals", async () => {
  const { handlers, runtime } = createHarness();
  runtime.activeGoal = createGoalState({ objective: "Ship goal mode M2", now: NOW });
  runtime.activeGoal = { ...runtime.activeGoal, phase: "paused" };

  const paused = await handlers.get("tool_call")!({ toolName: "edit", input: {} }, { hasUI: false });
  runtime.activeGoal = { ...runtime.activeGoal, phase: "cancelled" };
  const cancelled = await handlers.get("tool_call")!({ toolName: "bash", input: { command: "rm -rf dist" } }, { hasUI: false });

  assert.equal(paused, undefined);
  assert.equal(cancelled, undefined);
});

test("registerGoalSafety blocks edit/write in non-UI mode while a goal is active", async () => {
  const { handlers, runtime } = createHarness();
  runtime.activeGoal = createGoalState({ objective: "Ship goal mode M1", now: NOW });

  const result = await handlers.get("tool_call")!({ toolName: "edit", input: {} }, { hasUI: false });

  assert.equal(result.block, true);
  assert.match(result.reason, /approval/i);
});

test("registerGoalSafety prompts once for write approval and remembers approval", async () => {
  const { handlers, runtime } = createHarness();
  let confirmCount = 0;
  runtime.activeGoal = createGoalState({ objective: "Ship goal mode M1", now: NOW });
  const ctx = {
    hasUI: true,
    ui: {
      async confirm() {
        confirmCount += 1;
        return true;
      },
    },
  };

  const first = await handlers.get("tool_call")!({ toolName: "write", input: {} }, ctx);
  const second = await handlers.get("tool_call")!({ toolName: "edit", input: {} }, ctx);

  assert.equal(first, undefined);
  assert.equal(second, undefined);
  assert.equal(confirmCount, 1);
  assert.equal(runtime.activeGoal.approvals.writesApproved, true);
});

test("registerGoalSafety gates destructive bash while allowing read-only verification bash", async () => {
  const { handlers, runtime } = createHarness();
  runtime.activeGoal = createGoalState({ objective: "Ship goal mode M1", now: NOW });

  const safe = await handlers.get("tool_call")!({ toolName: "bash", input: { command: "npm test --workspace @gregho/pi-extension-goal-mode" } }, { hasUI: false });
  const unsafe = await handlers.get("tool_call")!({ toolName: "bash", input: { command: "rm -rf dist" } }, { hasUI: false });

  assert.equal(safe, undefined);
  assert.equal(unsafe.block, true);
  assert.match(unsafe.reason, /destructive/i);
});
