# Plan mode pi extension

Scaffolded pi package for safe read-only planning before execution.

## Status

M7 natural Plan Mode tool flow plus M3 Goal Mode integration support are implemented. The package provides read-only plan mode, captured `Plan:` steps, explicit execution handoff, marker-based progress, durable local plan artifacts, history/switching, complete/abandon flows, compact active-plan routing context, `plan_record` for natural structured plan creation/refinement, and `plan_get_current` for read-only tool-based orchestration.

## Features

- `/plan` toggles read-only plan mode.
- `--plan` starts with plan mode active.
- Built-in `edit` and `write` tools are disabled while planning.
- `bash` is restricted to conservative read-only inspection commands while planning, including safe read-only `&&`/`;` command chains.
- Hidden plan-mode instructions are injected before agent turns.
- The TUI footer shows a compact plan-mode status.
- Session custom entries restore mode state after reload/resume.
- Numbered `Plan:` sections are captured after assistant turns while plan mode is active.
- `/plan-current` shows the latest captured plan.
- Captured plans can be refined or explicitly approved to exit plan mode.
- `/plan-execute` starts explicit execution handoff for the latest captured plan.
- The capture prompt includes an `Execute the plan` option.
- Execution progress is tracked with `[DONE:n]` markers and shown in status/widget UI.
- Plan artifacts are stored under `~/.pi/agent/plan-mode/<project-key>/` by default.
- `current.json` stores only the active plan pointer.
- `index.json` stores compact searchable plan metadata.
- `/plan-history` and `/plan-history --session` list recent plans.
- `/plan-switch <id>` restores an existing plan.
- `/plan-new` starts a new plan flow without silently replacing an active plan; unfinished work can be paused.
- `/plan-complete` and `/plan-abandon` persist deterministic recap/status.
- Hidden context includes a compact `[ACTIVE PLAN]` summary when a plan is active.
- Routing policy tells the LLM to distinguish refine-current, new objective, resume/switch, and ambiguous plan discussions.
- Natural new objectives use `plan_record` when safe; if an active plan exists, the agent asks a natural disposition question instead of telling users to run `/plan-new`.
- `plan_record` creates or refines structured plan artifacts while preserving active-plan replacement safety.
- `plan_get_current` exposes the current plan as compact read-only tool data for natural-language tool composition.

## Boundary

Plan mode owns safe planning, captured plans, explicit main-session execution handoff, and marker-based progress display.

It does not own goal/loop orchestration or worker delegation. Goal Mode may consume explicit plan data returned by `plan_get_current`, but Plan Mode does not directly depend on Goal Mode, does not auto-call `goal_start`, and does not auto-call worker tools.

Example natural planning route:

```text
User: /plan
User: Plan Phase 3 worker-assisted goal loops.
Agent: plan_record({ intent: "new", title, steps })
```

Example natural-language route when both extensions are loaded:

```text
User: Use goal to complete the current plan.
Agent: plan_get_current -> goal_start -> goal_report loop
```

Asking to show or inspect the current plan should use `plan_get_current` only and must not start Goal Mode.

## Non-goals

- No autonomous retry loop.
- No verifier loop.
- No worker/sub-agent integration.
- No inferred completion without explicit `[DONE:n]` markers.
- No unsafe LLM-callable mutation tools; `plan_record` fails closed before replacing active plans.
- No automatic plan switching based only on semantic similarity.

## Load while developing

```bash
pi -e ./packages/pi-extension-plan-mode
```

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```
