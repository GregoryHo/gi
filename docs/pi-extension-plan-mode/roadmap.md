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
- Restore pre-plan tools only after explicit user execution handoff.
- Track `[DONE:n]` markers without inferring unmarked completion.
- Keep execution progress visible without claiming completion prematurely.
- Do not add autonomous retry, verifier, or worker loops.

Plan: `m3-execution-progress-handoff.md`.

### M4 — Goal/worker integration boundary

Define the boundary before building goal/loop mode:

- Define how future goal mode may consume plan-mode artifacts.
- Define when future goal mode may call `agent_worker_*` tools.
- Keep plan mode independent from worker runtime internals.
- Document that plan mode must not auto-call workers or claim marker completion as verification.

Plan: `m4-goal-worker-integration-boundary.md`.

### M5 — Plan artifact lifecycle and session indexing

Make plans durable and discoverable without creating artifact sprawl:

- Stable plan ids.
- `current.json` active pointer.
- `index.json` searchable metadata.
- One long-lived session can contain many plans.
- Session sequence and previous/next plan links.
- Complete/abandon/archive lifecycle.
- Deterministic recap.

Plan: `m5-plan-artifact-lifecycle-session-indexing.md`.

### M6 — Natural-language plan routing

Help the LLM distinguish refine-current vs new-objective vs resume/switch:

- Compact active-plan summary in hidden context.
- Routing policy for natural-language plan discussions.
- Confirmation gate before replacing/switching/completing active plans.
- Optional proposal-oriented LLM tools.

Plan: `m6-natural-language-plan-routing.md`.

## Deferred

- Autonomous loop execution.
- Write-capable workers.
- Cloud task runners.
- Public package release.
- LLM-generated recap.
