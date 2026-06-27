# M2 — Plan capture and approval UX

## SPEC

### Scope

Add plan capture and user approval UX on top of the M1 read-only plan mode.

M2 turns the assistant's plan-mode output into a session-local captured plan that the user can review, refine, or approve before leaving plan mode. Approval only exits plan mode; it does not start execution.

### User-facing behavior

- While plan mode is active, after an assistant response ends, the extension attempts to extract a numbered plan from the latest assistant text.
- A captured plan is recognized from a `Plan:` heading followed by numbered steps.
- When a plan is captured in UI mode, the extension shows a compact plan summary and asks the user what to do next:
  - stay in plan mode;
  - refine the plan;
  - approve the plan and exit plan mode.
- Refining the plan lets the user provide additional instructions that are sent as a follow-up while staying in plan mode.
- Approving the plan disables plan mode and restores the pre-plan tool set, but does not automatically execute the plan.
- A command such as `/plan-current` shows the latest captured plan summary.
- Captured plan state survives session reload/resume through session custom entries.

### Non-goals

- No automatic plan execution.
- No `[DONE:n]` progress tracking.
- No goal/loop mode integration.
- No worker/sub-agent delegation.
- No file artifact output for captured plans unless explicitly added in a later milestone.
- No complex custom TUI component; use existing `ctx.ui.select`, `ctx.ui.editor`, `ctx.ui.notify`, status, and widgets if sufficient.

### Expected files

Likely implementation files:

- `packages/pi-extension-plan-mode/src/plan.ts` — pure plan extraction and formatting helpers.
- `packages/pi-extension-plan-mode/src/state.ts` — extend persisted state to include captured plan data.
- `packages/pi-extension-plan-mode/src/index.ts` — wire `agent_end`, `/plan-current`, and approval/refinement UX.
- colocated `*.test.ts` files for parser/state helpers and command/event behavior.

Keep layout flat unless files grow beyond the small-package threshold.

### Design notes

- Plan extraction should be conservative and deterministic.
- The captured plan should store only step text and lightweight metadata, not raw full assistant output.
- If no valid plan is found, do nothing beyond staying in plan mode.
- In non-UI modes, capture and persist plan state, but skip interactive select/editor prompts.
- Approval must be explicit. Do not infer approval from the presence of a plan.
- Approving a plan only exits plan mode; execution remains a future milestone.

## AC

### Functional acceptance criteria

- Extracts numbered steps from a `Plan:` section in assistant text.
- Ignores text without a valid `Plan:` section.
- Captured plan state stores step numbers and concise step text.
- In UI mode, after capturing a plan, the user is offered stay/refine/approve options.
- Choosing stay leaves plan mode enabled and preserves the captured plan.
- Choosing refine keeps plan mode enabled and sends the user's refinement as a follow-up.
- Choosing approve disables plan mode and restores the pre-plan active tools.
- `/plan-current` shows the latest captured plan or a clear no-plan message.
- Captured plan state is restored from the latest session custom entry.
- M1 safety behavior remains unchanged: `edit`/`write` disabled in plan mode and unsafe bash blocked.

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
2. Confirm the plan summary appears.
3. Choose each option in separate runs: stay, refine, approve.
4. Confirm approve exits plan mode but does not execute the plan.
5. Confirm `/plan-current` reports the latest captured plan.

## Status tracking

When implementation begins:

- Update `milestones.md` M2 status to `In progress`.
- Append a start note to `log.md`.

When implementation completes:

- Update `milestones.md` M2 status to `Complete`.
- Append verification evidence to `log.md`.
- Update package `README.md` and `CHANGELOG.md`.
