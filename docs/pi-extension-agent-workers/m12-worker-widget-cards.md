# M12 — Persistent worker widget cards

## Status

Done.

## SPEC

### Scope

Add a persistent pi widget that makes current and recent workers visible without requiring repeated `/worker-status` calls.

M12 should use pi's widget surface (`ctx.ui.setWidget`) for a card-like display. It should not start with a full custom overlay dashboard.

### Target behavior

- In interactive UI sessions, show an `agent-workers` widget while the extension is loaded.
- Non-UI modes are no-ops and remain compatible with `pi -p` smoke tests.
- The widget displays up to 6 worker cards.
- Cards are updated when worker state changes and when relevant commands/tools run.
- Each card includes compact fields such as:
  - slot/run number
  - status icon/text
  - adapter/profile
  - cwd basename
  - elapsed time
  - timeout/deadline hint when present
  - task preview
  - last activity or final/error summary
- Empty state is concise, for example `No worker runs yet.` or hidden if that is less noisy.
- Widget content never includes raw logs, full prompts, credentials, or raw event payloads.

Example card style:

```text
┌─ #1 running planner · claude-code · 03:12 ─┐
│ cwd: pi-extension-agent-workers            │
│ task: refine v0.2.0 milestone plan...      │
│ activity: reading docs | producing plan     │
└────────────────────────────────────────────┘
```

### Design notes

- Prefer `ctx.ui.setWidget("agent-workers", ...)` first; defer `ctx.ui.custom()` overlay dashboards until a later version proves the need.
- The widget can render current in-memory runs plus recent indexed runs from M10.
- Before M13 multi-worker dispatch, the widget can still show up to 6 recent/current cards.
- Keep line widths safe; card rendering must truncate to the available width when implemented as a component.
- `session_shutdown` should clear the widget if necessary.

### Expected files

Likely files:

- new widget rendering helper under `packages/pi-extension-agent-workers/src/`
- `packages/pi-extension-agent-workers/src/index.ts`
- `packages/pi-extension-agent-workers/src/commands.ts`
- `packages/pi-extension-agent-workers/src/tools.ts`
- `packages/pi-extension-agent-workers/src/service.ts` or manager event hooks
- related package tests
- package README/docs updates
- this milestone plan

### Non-goals

- No interactive card controls yet.
- No overlay/full-screen dashboard yet.
- No real-time terminal log streaming in the widget.
- No raw log or full prompt display.
- No multi-worker scheduling changes in this milestone.

## AC

Implementation is complete when:

1. Interactive pi sessions show a persistent agent-workers widget after extension load or first worker interaction.
2. The widget displays up to 6 card-like worker summaries.
3. Cards update when runs start and reach terminal states.
4. Widget rendering is compact, width-safe, and redacted.
5. Non-interactive mode remains compatible and does not throw when UI methods are unavailable.
6. Session shutdown/reload does not leave stale widget state behind.
7. Tests cover card formatting and no-UI behavior where practical.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual interactive smoke:

```text
pi -e ./packages/pi-extension-agent-workers
/agent-workers
/worker-run --adapter demo widget smoke
/worker-status
```

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M12 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M12 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M12 persistent worker widget cards.

Implemented:

- Added an interactive `agent-workers` widget using `ctx.ui.setWidget`.
- Rendered up to 6 compact current/recent worker cards.
- Included status icon/text, profile/mode, adapter, cwd basename, elapsed time, task preview, and activity/final/status summary.
- Kept rendering width-safe and truncated by design.
- Kept non-UI mode as a no-op.
- Updated widget on session start, run start, and terminal run updates.
- Cleared widget on session shutdown.
- Updated README and changelog guidance for M12.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual interactive smoke completed:

```text
/agent-workers
/worker-status
/worker-run --adapter demo --duration-ms 5000 widget smoke
```

Observed expected behavior:

- `/agent-workers` loaded normally.
- Empty state displayed `No worker runs yet.`.
- Starting a demo worker updated the widget with a compact card for the run.
- Truncation behavior was accepted as expected for M12.
