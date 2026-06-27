# Plan mode pi extension

Scaffolded pi package for safe read-only planning before execution.

## Status

M2 plan capture and approval UX is implemented. The package provides read-only plan mode, captured `Plan:` steps, `/plan-current`, refinement follow-ups, and explicit approval to exit plan mode without starting execution.

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

## Non-goals in M2

- No execution handoff.
- No `[DONE:n]` progress tracking.
- No goal/loop or worker integration.

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
