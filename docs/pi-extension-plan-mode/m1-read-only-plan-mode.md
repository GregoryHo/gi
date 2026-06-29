# M1 — Read-only plan mode

## SPEC

### Scope

Implement the smallest safe plan-mode vertical slice for `packages/pi-extension-plan-mode`.

M1 enables an explicit planning state where the agent can inspect the workspace and produce a plan, but cannot use built-in file write tools or unsafe shell commands.

### User-facing behavior

- `/plan` toggles plan mode on/off.
- A `--plan` boolean flag starts pi with plan mode active when the package is loaded.
- When plan mode is active:
  - built-in `edit` and `write` tools are inactive;
  - `bash` tool calls are allowed only for conservative read-only inspection commands;
  - the agent receives concise hidden context explaining that it must produce a plan and not make changes;
  - the UI shows a compact plan-mode status.
- When plan mode is disabled:
  - the tool set active before entering plan mode is restored where possible;
  - stale hidden plan-mode context is not retained in future model context.
- Mode state survives session reload/resume through session custom entries.

### Non-goals

- No plan extraction from assistant output.
- No plan approval dialog.
- No execution handoff.
- No goal/loop mode.
- No worker/sub-agent integration.
- No custom TUI component beyond simple status/widget APIs if needed.

### Expected files

Likely implementation files:

- `packages/pi-extension-plan-mode/src/index.ts` — extension shell.
- `packages/pi-extension-plan-mode/src/commands.ts` — command/flag/shortcut registration if `index.ts` grows.
- `packages/pi-extension-plan-mode/src/safety.ts` — bash allowlist/blocklist helpers.
- `packages/pi-extension-plan-mode/src/state.ts` — state persistence helpers.
- colocated `*.test.ts` files for pure helpers.

Use the smallest layout that keeps `index.ts` readable; do not introduce folders unless needed.

### Design notes

- Preserve the exact active tool list before enabling plan mode and restore it on exit.
- Do not assume only built-in tools exist; remove only the managed write tools and keep unrelated extension tools active unless explicitly unsafe.
- Bash safety should be conservative. If a command is ambiguous, block it with an actionable reason.
- Hidden injected context should be short and mode-specific.
- State entries should not include private prompts, file contents, or raw tool payloads.

## AC

### Functional acceptance criteria

- `/plan` enables plan mode and shows a status indicator.
- `/plan` again disables plan mode and restores the prior active tool set.
- Starting with `--plan` enables plan mode on session start.
- While active, `edit` and `write` are not active tools.
- While active, unsafe `bash` commands such as `rm`, `git commit`, `npm install`, and shell redirection are blocked.
- While active, read-only commands such as `pwd`, `ls`, `rg`, `git status`, and `git diff` are allowed.
- While active, the next agent run receives hidden plan-mode instructions.
- After disabling plan mode, stale plan-mode hidden context is filtered from future context.
- Session resume/reload reconstructs active mode state from the last plan-mode custom entry.

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

1. `/plan` toggles status.
2. Ask for code analysis; agent should plan without edits.
3. Try an unsafe command through the agent; it should be blocked.
4. Disable `/plan`; normal tools should be restored.

## Status tracking

When implementation begins:

- Update `milestones.md` M1 status to `In progress`.
- Append a start note to `log.md`.

When implementation completes:

- Update `milestones.md` M1 status to `Complete`.
- Append verification evidence to `log.md`.
- Update package `README.md` status and `CHANGELOG.md` Unreleased section.
