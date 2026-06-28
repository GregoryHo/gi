# Plan mode pi extension

Scaffolded pi package for safe read-only planning before execution.

## Status

M3 execution progress handoff is implemented. The package provides read-only plan mode, captured `Plan:` steps, `/plan-current`, refinement follow-ups, explicit approval to exit without execution, and explicit `/plan-execute` handoff with marker-based progress.

## Features

- `/plan` toggles read-only plan mode.
- `--plan` starts with plan mode active.
- Built-in `edit` and `write` tools are disabled while planning.
- `bash` is restricted to conservative read-only inspection commands while planning.
- Hidden plan-mode instructions are injected before agent turns.
- The TUI footer shows a compact plan-mode status.
- Session custom entries restore mode state after reload/resume.
- Numbered `Plan:` sections are captured after assistant turns while plan mode is active.
- `/plan-current` shows the latest captured plan.
- Captured plans can be refined or explicitly approved to exit plan mode.
- `/plan-execute` starts explicit execution handoff for the latest captured plan.
- The capture prompt includes an `Execute the plan` option.
- Execution progress is tracked with `[DONE:n]` markers and shown in status/widget UI.

## Boundary

Plan mode owns safe planning, captured plans, explicit main-session execution handoff, and marker-based progress display.

It does not own goal/loop orchestration or worker delegation. Future goal mode may consume explicit plan artifacts and may delegate to `pi-extension-agent-workers`, but plan mode does not directly depend on or auto-call worker tools.

## Non-goals

- No autonomous retry loop.
- No verifier loop.
- No worker/sub-agent integration.
- No inferred completion without explicit `[DONE:n]` markers.

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
