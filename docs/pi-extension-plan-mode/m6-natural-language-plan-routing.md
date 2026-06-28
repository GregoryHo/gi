# M6 — Natural-language plan routing

## SPEC

### Scope

Add prompt policy and guarded routing surfaces so the LLM can distinguish whether user language is refining the active plan, starting a new topic, or resuming/switching a prior plan.

M6 builds on M5 lifecycle/indexing. It should help the LLM reason about plan intent, but state mutation must remain explicit and confirmation-gated.

### User-facing behavior

When the user discusses a plan in natural language, the assistant should behave as follows:

- If the user clarifies or modifies the current objective, refine the active plan.
- If the user introduces a distinct new objective, say it appears to be a new plan and ask whether to start one.
- If the user references a previous objective, suggest searching or switching plan history.
- The assistant must not silently overwrite, replace, complete, abandon, or switch plans.

### Routing policy

Inject a compact active-plan summary into hidden context when a plan is active:

```text
[ACTIVE PLAN]
id: plan_...
title: Auth refactor
status: executing
progress: 2/5
steps:
1. ☑ Inspect auth module
2. ☑ Add tests
3. ☐ Refactor validation
...

Routing rules:
- If user refines this objective, update/refine the active plan.
- If user asks for a distinct objective, ask whether to start a new plan.
- Do not silently overwrite or switch plans.
```

The context must stay compact and should not include full artifact history.

### Intent classes

| Intent | Examples | Expected behavior |
| --- | --- | --- |
| Refine current | “把第 2 步改成...”, “這個 plan 加上測試” | refine active plan |
| New objective | “接下來幫我規劃 goal mode”, “先改做另一個 feature” | propose starting a new plan |
| Complete then next | “這個完成了，下一個...” | ask whether to complete/archive current then start new |
| Resume/switch | “回到剛剛 auth plan” | suggest `/plan-history` or `/plan-switch <id>` |
| Ambiguous | “那這個呢？” | ask a clarifying question |

### Tool/command surfaces

M6 may add LLM-callable tools, but only with confirmation or proposal semantics:

- `plan_propose_new` — records/announces a proposed new plan; does not overwrite active state.
- `plan_refine_current` — proposes a refined plan for the current active plan.
- `plan_list_recent` — returns compact recent plan metadata.

Alternatively, M6 may start with commands and prompt policy only if tool confirmation semantics are not yet clear:

- `/plan-new`
- `/plan-history`
- `/plan-switch <id>`
- `/plan-current`

### Safety rules

- New objective detection must never mutate plan state without explicit user confirmation.
- LLM tools, if added, must return compact state and avoid raw artifact dumps.
- Plan routing must not call `agent_worker_*` tools directly.
- Plan routing must not start autonomous goal loops.
- Active plan context must be short enough not to dominate the main task context.

### Non-goals

- No artifact storage redesign; M5 owns lifecycle/indexing.
- No LLM-generated recap.
- No goal-mode implementation.
- No worker/sub-agent delegation.
- No automatic plan switching based only on semantic similarity.

### Expected files

Likely implementation files:

- `packages/pi-extension-plan-mode/src/routing.ts` — routing prompt/context helpers.
- `packages/pi-extension-plan-mode/src/tools.ts` — optional LLM-callable routing tools if chosen.
- `packages/pi-extension-plan-mode/src/index.ts` — inject active plan routing context and wire tools/commands.
- tests for context formatting, intent-policy snippets, and guarded tool behavior.

## AC

### Functional acceptance criteria

- Hidden context includes compact active plan id/title/status/progress when a plan is active.
- Hidden context tells the LLM to distinguish refine-current vs new-objective vs resume/switch.
- Hidden context explicitly forbids silent overwrite, switch, complete, or abandon.
- Natural-language new objective path results in a confirmation prompt or clear user-facing question before state changes.
- Refine-current path preserves the same active plan id.
- Resume/switch path points to `/plan-history` or `/plan-switch <id>` unless the user explicitly selects a plan.
- If LLM-callable tools are added, they are proposal/metadata tools and do not silently mutate active plan state.
- Existing M1-M5 behavior remains intact.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```

Manual smoke test after implementation:

1. Create an active plan.
2. Say “把第 2 步改成加入測試” and confirm it treats this as refinement.
3. Say “接下來幫我規劃 goal mode” and confirm it asks whether to start a new plan.
4. Say “回到剛剛 auth plan” and confirm it suggests history/switch instead of guessing.
5. Confirm no active plan is overwritten without explicit confirmation.

## Status tracking

When implementation begins:

- Update `milestones.md` M6 status to `In progress`.
- Append a start note to `log.md`.

When implementation completes:

- Update `milestones.md` M6 status to `Complete`.
- Append verification evidence to `log.md`.
- Update package README and CHANGELOG.
