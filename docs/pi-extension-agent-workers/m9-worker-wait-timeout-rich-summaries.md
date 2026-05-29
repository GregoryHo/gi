# M9 — Worker wait/timeout and rich run summaries

## Status

Done.

## SPEC

### Scope

Make delegated-worker loops easier to drive from both LLM tools and slash commands by enforcing run timeouts, adding a wait surface, and returning more complete compact run summaries.

M9 should turn the existing `timeoutMs` request field from a hint into runtime behavior.

### Target behavior

- `WorkerRequest.timeoutMs` is enforced as a worker run deadline.
- Timed-out runs are reported distinctly from manual cancellations and normal failures.
- Add a compact wait surface:
  - `agent_worker_wait({ runId, waitMs? })`
  - `/worker-wait <id> [--wait-ms <ms>]`
- Waiting for an already finished run returns immediately.
- Waiting for a still-running run returns the final run summary when it finishes before the wait limit.
- Waiting past `waitMs` returns the current compact summary and clearly says the worker is still running.
- Status and wait summaries include enough context for orchestration without raw logs:
  - `runId`
  - `status`
  - `statusReason` when useful, especially `timed_out`
  - `adapter`
  - `profile` when present
  - `mode` when present
  - `taskPreview`
  - `cwd`
  - `pid`
  - `startedAt`
  - `endedAt` when present
  - `elapsedMs`
  - `lastActivityAt`
  - `timeoutMs` when present
  - `exitCode` when present
  - `usage`
  - `activity`
  - `finalText` when present
  - `logPath`

### Design notes

- Prefer a distinct terminal status such as `timed_out` over overloading `cancelled` or `failed`.
- Timeout enforcement should terminate the child process through the same safe process-control path as cancellation, with a clear status reason.
- `timeoutMs` means the maximum run lifetime. The wait surface should use `waitMs` to avoid confusing run timeout with caller wait timeout.
- Tool output remains compact and should not expose raw stdout/stderr or event payloads.

### Expected files

Likely files:

- `packages/pi-extension-agent-workers/src/worker-types.ts`
- `packages/pi-extension-agent-workers/src/worker-manager.ts`
- `packages/pi-extension-agent-workers/src/service.ts`
- `packages/pi-extension-agent-workers/src/tools.ts`
- `packages/pi-extension-agent-workers/src/commands.ts`
- related package tests
- package README/docs updates
- this milestone plan

### Non-goals

- No multi-worker dispatch yet.
- No persistent historical index yet.
- No widget/card UI yet.
- No raw log exposure through LLM tools.
- No dangerous permission or sandbox bypass flags.

## AC

Implementation is complete when:

1. `timeoutMs` is enforced for demo and real adapters through the shared manager path.
2. Timed-out runs have a distinct, clearly reported terminal outcome.
3. `agent_worker_wait` exists and supports `runId` plus optional `waitMs`.
4. `/worker-wait <id> [--wait-ms <ms>]` exists.
5. Waiting for completed, failed, cancelled, and timed-out runs returns immediately with a compact summary.
6. Waiting for a still-running run returns completion if it finishes before `waitMs`.
7. Waiting past `waitMs` does not cancel the worker unless the run's own `timeoutMs` expires.
8. `agent_worker_status` and `/worker-status` include richer compact summary fields without raw logs.
9. Tests cover timeout, wait success, wait caller-timeout, and summary shaping.

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
/worker-run --adapter demo --duration-ms 5000 --yes wait smoke
/worker-status
/worker-wait <runId> --wait-ms 10000
```

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M9 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M9 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M9 worker wait/timeout and rich run summaries.

Implemented:

- Enforced `timeoutMs` through the shared `WorkerManager` path.
- Added distinct `timed_out` worker status and `statusReason` values.
- Added `/worker-run --timeout-ms <ms>` command parsing.
- Added `agent_worker_wait({ runId, waitMs? })`.
- Added `/worker-wait <id> [--wait-ms <ms>]`.
- Added caller wait-limit behavior that returns the current run without cancelling it.
- Expanded compact public summaries with adapter/profile/mode, task preview, cwd, pid, timestamps, elapsed time, timeout, status reason, exit code, usage, activity, final text, and log path.
- Kept raw worker output and raw event payloads out of tool/status summaries.
- Updated README and changelog guidance for M9.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Note: `npm install` was run locally to restore missing `node_modules` needed for tests; the resulting `package-lock.json` diff was reverted and is not part of M9.
