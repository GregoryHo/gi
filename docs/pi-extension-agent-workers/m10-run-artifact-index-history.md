# M10 — Run artifact index and recent history

## Status

Done.

## SPEC

### Scope

Persist compact run metadata locally so users can inspect recent worker history after pi restarts and so future UI surfaces have a reliable data source.

M10 should preserve summaries, not raw worker output.

### Target behavior

- Maintain a compact local run index under `~/.pi/agent/agent-workers/`.
- Record one latest summary per run with:
  - run id
  - status
  - adapter/profile/mode when known
  - task preview
  - cwd
  - timestamps and elapsed time
  - timeout/deadline fields when known
  - exit code/status reason when known
  - usage summary
  - recent activity labels
  - final text preview when known
  - log path
- Update the index when a run starts and when terminal state is reached.
- Add recent-history surfaces:
  - `agent_worker_list_runs({ limit? })`
  - `/worker-history [--limit <n>]`
- After pi restart, historical runs are visible as informational summaries.
- Historical runs cannot be cancelled or waited on unless they are also known to the current in-memory manager.

### Design notes

- Keep the artifact index compact and redacted by design.
- Raw logs remain in per-run log files; the index stores only previews and metadata.
- Prefer a bounded index, for example latest 100 runs, to avoid unbounded growth.
- If writing a single JSON index, use safe write/replace behavior to reduce corruption risk.
- If using JSONL snapshots, list commands should collapse to the latest summary per run.

### Expected files

Likely files:

- new artifact-index helper under `packages/pi-extension-agent-workers/src/`
- `packages/pi-extension-agent-workers/src/worker-manager.ts`
- `packages/pi-extension-agent-workers/src/service.ts`
- `packages/pi-extension-agent-workers/src/tools.ts`
- `packages/pi-extension-agent-workers/src/commands.ts`
- related package tests
- package README/docs updates
- this milestone plan

### Non-goals

- No raw prompt/stdout/stderr persistence in committed fixtures.
- No process reattachment after pi restart.
- No attempt to cancel historical runs from a previous runtime.
- No external database or cloud storage.
- No multi-worker dispatch yet.

## AC

Implementation is complete when:

1. Starting a run creates or updates compact local index metadata under `~/.pi/agent/agent-workers/` or the configured artifact root.
2. Completing, failing, cancelling, or timing out a run updates its indexed terminal summary.
3. `agent_worker_list_runs` returns recent in-memory and historical summaries compactly.
4. `/worker-history [--limit <n>]` shows recent run summaries and log paths.
5. Restarting pi still allows recent historical runs to be listed.
6. Historical-only runs are clearly marked as informational and not controllable.
7. Index entries do not include raw logs, raw event payloads, full prompts, credentials, or secrets.
8. Tests cover index write/update/list behavior and historical-only summary behavior.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Optional manual smoke:

```text
/worker-run --adapter demo history smoke
/worker-history
# restart pi
/worker-history
```

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M10 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M10 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M10 run artifact index and recent history.

Implemented:

- Added a compact local `runs-index.json` artifact under the configured artifact root, defaulting to `~/.pi/agent/agent-workers/`.
- Added safe upsert behavior that records one latest summary per run and bounds the index to recent entries.
- Indexed run metadata on start and terminal completion/failure/cancellation/timeout updates.
- Added `agent_worker_list_runs({ limit? })` for recent in-memory plus historical run summaries.
- Added `/worker-history [--limit <n>]` for command-based recent history.
- Marked historical-only runs with `historical: true` and `controllable: false` so post-restart summaries are informational, not cancellable/waitable process handles.
- Kept index entries compact: task preview, timestamps, cwd, status, usage, activity labels, final preview, and log path; no raw event payloads or full task/log content.
- Updated README and changelog guidance for M10.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual smoke completed:

```text
/worker-run --adapter demo --duration-ms 3000 history smoke
/worker-history
# restart pi
/worker-history
```

Observed expected behavior:

- The new run appeared in history as `completed` with `statusReason: exit_zero`, `exitCode: 0`, `controllable: true`, and a local log path while the run was still known in the current runtime.
- After restart, the same run remained visible as `completed — historical` with `controllable: false`.
