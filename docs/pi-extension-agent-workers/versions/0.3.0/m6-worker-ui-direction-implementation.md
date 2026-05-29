# v0.3.0 M6 — Worker UI direction implementation

## Status

Done.

## SPEC

Implement the worker UI direction selected by the M5 Widget/TUI capability PoC.

Scope depends on M5's decision note. Candidate directions:

- Native widget v2: compact scoped active/recent worker display using improved layout.
- Overlay cockpit: command-invoked inspect/control UI for worker runs.
- Widget + footer hybrid: persistent compact awareness plus richer explicit command/UI for details.
- Minimal scoped summary improvements: if pi APIs are too limited, focus on current workspace filtering and preview quality.

Baseline requirements regardless of direction:

- Default display should be scoped to the current workspace unless the user requests all scopes.
- Original user task preview from M3 should be used, not injected system prompts.
- Completed/recent workers should be more compact than active workers.
- Raw logs should not be displayed by default; show log paths/pointers unless the user explicitly asks for logs.
- Non-UI modes must no-op safely or expose command/tool text summaries.

Non-goals:

- No private pi API reliance.
- No full TUI layout replacement unless M5 proves it is supported and low risk.
- No process reattachment.

## AC

- Implements the UI direction explicitly selected by the M5 decision note.
- Improves the v0.2.0 widget problem shown in screenshots: oversized completed cards and injected system prompt previews.
- Supports current-workspace default and all-scope visibility where appropriate.
- Includes tests for pure rendering/formatting logic where feasible.
- Includes manual interactive smoke evidence for TUI behavior.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual UI smoke must cover at least:

- no runs
- active run
- completed run
- multiple recent runs
- narrow-ish terminal width
- non-UI load smoke

## Status tracking

At start:

- Mark `v0.3.0 M6` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M6` as `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.3.0/log.md`.

## Current implementation notes

Implemented the M5-selected persistent widget direction in the default `agent-workers` widget:

- Keeps original-style bordered worker cards.
- Uses compact fields: `slot`, `run id`, `adapter`, `profile`/mode, `duration`, `started`, `task`, and `reason`.
- Truncates long fields to card width.
- Uses narrower cards with two-card rows on wide terminal widths and no middle divider.
- Refreshes every 5 seconds during interactive sessions so running duration/status does not depend only on worker lifecycle events.
- Keeps current-workspace history scoping and existing `widgetLimit` / `widgetPlacement` config behavior.

Manual interactive smoke passed: user confirmed the default widget behavior is okay after restoring slot display and adding concrete started time. M6 complete.
