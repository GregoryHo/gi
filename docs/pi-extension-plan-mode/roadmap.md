# Plan mode roadmap

## Goal

Build a safe top-level planning mode for pi that lets the agent inspect and reason before making changes.

## Product principles

- Safe by default: read-only first.
- Explicit transitions: planning and execution are separate states.
- Minimal LLM context overhead: injected instructions must stay compact.
- Preserve user intent: restore the user's active tool set after leaving plan mode.
- No autonomous write behavior until a later explicit milestone.

## Proposed milestone sequence

### M1 — Read-only plan mode

Smallest useful vertical slice:

- Loadable package scaffold.
- `/plan` command and optional startup flag.
- Disable built-in `edit`/`write` while active.
- Restrict `bash` to read-only inspection commands while active.
- Inject concise plan-mode instructions before agent start.
- Show mode status in the UI.
- Persist/restore mode state.

Plan: `m1-read-only-plan-mode.md`.

### M2 — Plan capture and approval UX

After M1 is stable:

- Extract numbered `Plan:` sections from assistant messages.
- Display captured plan steps in a widget or compact message.
- Ask whether to stay in plan mode, refine, or approve and exit plan mode.
- Persist the captured plan as session-local extension state.
- Do not automatically execute the plan in M2.

Plan: `m2-plan-capture-approval-ux.md`.

### M3 — Execution progress handoff

After plan capture is reliable:

- Convert captured plan into tracked execution steps.
- Restore pre-plan tools only after explicit user approval.
- Track `[DONE:n]` markers or a more robust step-completion signal.
- Keep execution progress visible without claiming completion prematurely.

### M4 — Goal/worker integration boundary

After a separate goal/loop mode exists:

- Define how goal mode consumes plan-mode artifacts.
- Define when goal mode may call `agent_worker_*` tools.
- Keep plan mode independent from worker runtime internals.

## Deferred

- Autonomous loop execution.
- Write-capable workers.
- Cloud task runners.
- Public package release.
