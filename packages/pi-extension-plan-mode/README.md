# Plan mode pi extension

Scaffolded pi package for safe read-only planning before execution.

## Status

M1 read-only plan mode is implemented. It provides `/plan`, `--plan`, write-tool disabling, conservative bash safety gates, hidden planning instructions, UI status, and session state restore.

## Features

- `/plan` toggles read-only plan mode.
- `--plan` starts with plan mode active.
- Built-in `edit` and `write` tools are disabled while planning.
- `bash` is restricted to conservative read-only inspection commands while planning.
- Hidden plan-mode instructions are injected before agent turns.
- The TUI footer shows a compact plan-mode status.
- Session custom entries restore mode state after reload/resume.

## Non-goals in M1

- No plan extraction.
- No approval dialog.
- No execution handoff.
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
