# M3 — Execution progress handoff

## SPEC

### Scope

Add an explicit execution handoff for a captured plan, with lightweight progress tracking.

M3 lets the user intentionally move from read-only planning into normal tool access for executing the captured plan. The extension tracks plan-step completion markers in assistant messages and keeps progress visible, but it does not implement autonomous goal/loop behavior.

### User-facing behavior

- A captured plan can be handed off for execution only through explicit user action.
- The plan capture UX adds an option such as `Execute the plan` distinct from `Approve plan and exit plan mode`.
- A command such as `/plan-execute` starts execution for the latest captured plan.
- Starting execution:
  - disables plan mode;
  - restores the pre-plan active tool set;
  - marks the captured plan as `executing`;
  - injects execution context telling the agent to follow the plan and include `[DONE:n]` after completing step `n`;
  - sends a follow-up user message to start the first remaining step.
- While executing:
  - the UI shows compact progress, such as completed/total;
  - `/plan-current` shows the captured plan with completed markers;
  - assistant messages are scanned for `[DONE:n]` markers;
  - completed steps persist in session custom state.
- When all steps are completed:
  - execution state ends;
  - progress UI is cleared or replaced with a completion notice;
  - the extension does not claim success beyond marker-based completion.

### Non-goals

- No autonomous retry loop.
- No verifier loop.
- No worker/sub-agent delegation.
- No automatic test selection or acceptance validation.
- No file artifact output.
- No attempt to infer completion without explicit `[DONE:n]` markers.
- No destructive-action bypass; normal pi/user/tool safety remains in force after execution handoff.

### Expected files

Likely implementation files:

- `packages/pi-extension-plan-mode/src/plan.ts` — extend plan model with completion helpers and formatting.
- `packages/pi-extension-plan-mode/src/state.ts` — persist execution state and completed steps.
- `packages/pi-extension-plan-mode/src/index.ts` — wire `/plan-execute`, execution context injection, progress status/widget, and `[DONE:n]` tracking.
- colocated `*.test.ts` files for completion marker parsing, state restore, and command/event behavior.

Keep layout flat unless files become hard to read.

### Design notes

- Execution handoff is a convenience workflow, not a loop controller.
- `Approve plan and exit plan mode` from M2 should remain non-executing.
- `Execute the plan` should be explicit and visually distinct from simple approval.
- Completion is marker-based only; if the assistant forgets `[DONE:n]`, progress remains incomplete.
- The extension may prompt/remind the agent through hidden execution context, but should not fabricate progress.
- Store only plan steps and completion booleans, not raw assistant text.
- If no captured plan exists, `/plan-execute` should show a clear no-plan message and do nothing.

## AC

### Functional acceptance criteria

- The plan capture UI offers an explicit execute option separate from approve-and-exit.
- `/plan-execute` starts execution for the latest captured plan.
- `/plan-execute` with no captured plan reports a clear no-plan message and does not change active tools.
- Starting execution disables plan mode and restores the pre-plan active tools.
- Starting execution sends a follow-up user message that includes the captured plan and first remaining step.
- During execution, `before_agent_start` injects hidden execution instructions including the remaining steps and `[DONE:n]` convention.
- Assistant messages containing `[DONE:n]` mark matching steps complete.
- Duplicate or unknown `[DONE:n]` markers do not corrupt state.
- `/plan-current` shows completed and incomplete steps distinctly.
- Progress status/widget updates while executing.
- When all steps are complete, execution state ends and completion is persisted.
- M1/M2 behavior remains unchanged: plan mode safety gates remain active while planning; approve-and-exit still does not execute.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```

Manual smoke test after implementation:

```bash
pi -e ./packages/pi-extension-plan-mode --plan
```

Then verify:

1. Ask the agent to produce a numbered `Plan:`.
2. Choose `Execute the plan` or run `/plan-execute`.
3. Confirm plan mode exits and normal tools are restored.
4. Confirm the follow-up prompt starts execution.
5. Confirm `[DONE:1]` updates progress.
6. Confirm `/plan-current` shows progress.
7. Confirm completing all steps ends execution state.

## Status tracking

When implementation begins:

- Update `milestones.md` M3 status to `In progress`.
- Append a start note to `log.md`.

When implementation completes:

- Update `milestones.md` M3 status to `Complete`.
- Append verification evidence to `log.md`.
- Update package `README.md` and `CHANGELOG.md`.
