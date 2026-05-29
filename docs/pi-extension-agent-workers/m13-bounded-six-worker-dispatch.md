# M13 — Bounded six-worker dispatch

## Status

Done.

## SPEC

### Scope

Allow bounded multi-worker delegation with a hard maximum of 6 worker slots while preserving safe workspace behavior.

M13 should replace the current one-running-worker limit with explicit slot and workspace-collision rules.

### Target behavior

- The manager supports up to 6 active worker slots.
- Starting a 7th active worker fails with a clear slot-limit message.
- Read-only workers may run concurrently, including in the same workspace.
- Write-capable workers require explicit confirmation and are guarded by workspace collision rules.
- If a write-capable worker is already active for a cwd/git root, another write-capable worker for that same workspace is blocked by default.
- Separate worktrees/cwds may run separate write-capable workers when explicitly assigned.
- The widget from M12 shows the 6 slots clearly.
- Status/list outputs identify active slot or ordering so users can reason about parallel workers.

### Safety model

Classify a run conservatively:

- `demo` is safe to run concurrently.
- Profiles with `readOnly: true` and `canModifyWorkspace: false` are read-only.
- Profiles with `canModifyWorkspace: true`, including `implementer`, are write-capable.
- Explicit real-adapter runs without a read-only profile should be treated as potentially write-capable.
- Unknown or custom profile metadata should choose the safer interpretation.

Workspace collision should use git root when available, falling back to normalized cwd.

### Design notes

- Keep the maximum at 6 as a simple hard cap, not a configurable scheduler.
- Do not queue automatically in v0.2.0 unless implementation needs an internal short-lived state; fail clearly instead.
- Keep confirmation requirements for real workers.
- This milestone does not need automatic worktree creation; users can pass `cwd` or use `/worker-run --pick-cwd`.

### Expected files

Likely files:

- `packages/pi-extension-agent-workers/src/worker-manager.ts`
- `packages/pi-extension-agent-workers/src/worker-types.ts`
- `packages/pi-extension-agent-workers/src/service.ts`
- `packages/pi-extension-agent-workers/src/profiles.ts`
- `packages/pi-extension-agent-workers/src/workspaces.ts`
- `packages/pi-extension-agent-workers/src/tools.ts`
- `packages/pi-extension-agent-workers/src/commands.ts`
- widget updates from M12 if needed
- related package tests
- package README/docs updates
- this milestone plan

### Non-goals

- No automatic git worktree creation.
- No cloud worker orchestration.
- No queueing/scheduling policy beyond the 6-slot cap and safety blocks.
- No bypass permission/sandbox flags.
- No domain-specific dispatch logic.

## AC

Implementation is complete when:

1. Up to 6 active workers can run concurrently when safety rules allow it.
2. Starting a 7th active worker returns a clear error.
3. Concurrent demo workers are supported by tests.
4. Concurrent read-only profile workers are allowed.
5. Concurrent write-capable workers in the same git root/cwd are blocked by default.
6. Concurrent write-capable workers in distinct worktrees/cwds are allowed after explicit confirmation.
7. Explicit real-adapter runs without read-only profile metadata are treated conservatively as write-capable.
8. `/worker-status`, `agent_worker_status`, and the widget make multiple active workers understandable.
9. Shutdown cancels all active workers safely.
10. Tests cover slot cap, read-only concurrency, write collision blocking, distinct workspace allowance, and cancel-all behavior.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual safe smoke:

```text
/worker-run --adapter demo --duration-ms 10000 worker one
/worker-run --adapter demo --duration-ms 10000 worker two
/worker-status
/worker-kill <runId>
```

Run real-worker multi-worker smoke only with explicit user approval and separate safe workspaces.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M13 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M13 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M13 bounded six-worker dispatch.

Implemented:

- Replaced the one-running-worker limit with a hard cap of 6 active workers.
- Added active worker `slot` metadata.
- Added `readOnly`, `canModifyWorkspace`, and `workspaceKey` safety metadata to summaries/history/status output.
- Allowed concurrent safe/demo workers.
- Allowed concurrent read-only workers in the same workspace.
- Blocked same-workspace write-capable worker collisions by default.
- Allowed write-capable workers in distinct workspaces.
- Treated direct real-adapter runs without read-only profile metadata conservatively as write-capable.
- Updated widget/status summaries to make multiple workers understandable.
- Kept `cancelAll()` safe for multiple active workers.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual safe smoke completed:

```text
/worker-run --adapter demo --duration-ms 10000 worker one
/worker-run --adapter demo --duration-ms 10000 worker two
/agent-workers
/worker-status
```

Observed expected behavior:

- Before reloading the updated extension, an old interactive runtime still returned the prior one-worker-limit message: `A worker is already running. M1 supports one worker at a time.`
- After reloading the updated extension, two demo workers started concurrently.
- First run showed `slot: 1`, `readOnly: true`, `canModifyWorkspace: false`, and the expected `workspaceKey`.
- Second run showed `slot: 2`, `readOnly: true`, `canModifyWorkspace: false`, and the expected `workspaceKey`.
- `/agent-workers` listed both running workers.
- `/worker-status` later showed both runs completed with `statusReason: exit_zero` and `exitCode: 0`.
