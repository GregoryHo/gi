# v0.3.0 M2 — Workspace-scoped history

## Status

Done.

## SPEC

Scope run identity and recent history by workspace so users see relevant worker runs for the current repository/worktree by default.

Scope:

- Define a workspace scope model using git root when available, otherwise normalized cwd.
- Persist scope metadata in the compact run index.
- Update run history listing surfaces to default to current workspace scope.
- Preserve an all-workspaces view for global inspection.
- Keep historical runs informational after restart; do not attempt process reattachment.

Likely persisted fields:

- `scopeKey`
- `scopeLabel`
- `gitRoot`
- `originalCwd` or equivalent effective run cwd metadata

Surfaces to evaluate/update:

- `RunArtifactIndex`
- `workerRunToHistoryEntry`
- `/worker-history`
- `agent_worker_list_runs`
- `AgentWorkerService.listRunHistory`
- widget history feed, if it consumes history directly

Non-goals:

- No raw log parsing to reconstruct missing scope metadata.
- No process reattachment for historical runs.
- No custom UI redesign; this milestone only provides data/scope foundations.

## AC

- New runs persist workspace scope metadata.
- Existing pre-v0.3.0 history entries still load safely with missing scope metadata.
- `/worker-history` defaults to current workspace scope.
- `/worker-history --all` or equivalent shows all recent runs.
- `agent_worker_list_runs` can request current-scope history and all-scope history.
- Tests cover git-root scope, non-git cwd scope, and backward-compatible old index entries.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

## Status tracking

At start:

- Mark `v0.3.0 M2` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M2` as `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.3.0/log.md`.

## Completion notes

Implemented workspace scope metadata and scoped history behavior:

- Added `resolveWorkspaceScope()` using git root when available and normalized cwd otherwise.
- Added `scopeKey`, `scopeLabel`, and `gitRoot` metadata to worker runs, compact results, and run history entries.
- Persisted scope metadata in `runs-index.json` while preserving old entries without scope metadata.
- Added scoped run-history listing with all-workspaces fallback.
- Updated `/worker-history` to default to current workspace and support `--all`.
- Updated `agent_worker_list_runs` to default to current workspace and support `scope: "all"`.
- Updated the interactive widget data source to request current-workspace scoped history.
- Included scope metadata in text status/history summaries when available.
