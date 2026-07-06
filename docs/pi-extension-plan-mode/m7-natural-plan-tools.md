# M7 — Natural Plan Mode tool flow

## SPEC

### Problem

When Plan Mode is enabled, users expect to describe a planning objective naturally and have the agent record a plan. The current natural-language routing guidance tells the agent to ask the user to run `/plan-new` for distinct new objectives. That makes Plan Mode feel like a footer-only state and forces users to know internal commands.

### Scope

M7 adds a structured, LLM-callable `plan_record` tool so the agent can create or refine Plan Mode artifacts directly from numbered plan steps while preserving safety around active plans.

The command `/plan-new` remains available as a manual fallback, but ordinary natural planning requests should not require it.

### Tool behavior

`plan_record` accepts:

```ts
interface PlanRecordParams {
  intent: "new" | "refine_current";
  title: string;
  steps: Array<{ step: number; text: string }>;
  activePlanDisposition?: "complete" | "abandon" | "pause";
}
```

Behavior:

- `intent: "new"` with no active non-terminal plan creates a new draft plan and marks it current.
- `intent: "refine_current"` updates the current plan while preserving the plan id.
- `intent: "new"` with an active non-terminal plan fails closed unless `activePlanDisposition` is supplied.
- When `activePlanDisposition` is supplied, the old active plan is completed, abandoned, or paused before the new draft plan is recorded.
- Recording a plan enables Plan Mode so the footer and read-only gates stay aligned with the new current plan.

### Routing behavior

Plan Mode guidance should say:

- Use `plan_record` for ordinary plan creation/refinement while Plan Mode is active.
- Ask a natural disposition question before replacing an active plan.
- Do not tell users to run `/plan-new` for ordinary new planning requests.
- Keep `/plan-history` and `/plan-switch <id>` guidance for previous-plan references.

### Non-goals

- No silent active-plan overwrite.
- No automatic plan execution.
- No Goal Mode or worker delegation.
- No removal of `/plan-new`.

## AC

- Plan Mode registers `plan_record`.
- `plan_record` creates a new current draft plan from structured steps.
- `plan_record` rejects distinct new objectives over active plans without disposition.
- `plan_record` can pause, complete, or abandon an active plan before recording a new one.
- `plan_record` refines the current plan while preserving its id.
- Routing policy mentions `plan_record` and natural disposition questions.
- Routing policy no longer tells the model to ask users to run `/plan-new` for ordinary new objectives.
- Existing `/plan-new` command behavior remains intact.

## Verification

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```

Manual smoke should use an isolated temp folder and confirm:

```text
/plan
User asks for a new planning objective
Agent uses plan_record
plan_get_current returns found:true
```

Then delete the temp folder.
