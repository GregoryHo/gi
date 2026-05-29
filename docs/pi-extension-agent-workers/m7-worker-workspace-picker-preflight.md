# M7 — Worker workspace picker and preflight

## Status

Done.

## SPEC

### Scope

Add a native pi UI workflow for selecting the worker workspace (`cwd`) before delegating to real workers, and add lightweight preflight checks so workers do not silently run in the wrong repository.

This milestone is motivated by manual testing where a Jira planning worker ran in `gi-agent-workers` instead of the Wingo/PPS product repository. The generated plan was useful, but the worker could not inspect the target product codebase.

M7 should make workspace selection feel like a shell-like workflow:

- show current worker workspace
- pick from discovered workspace candidates
- manually enter a path
- set a session default workspace for subsequent worker runs
- confirm/preflight before starting real workers

Use native pi UI methods only:

- `ctx.ui.select()` for picklists
- `ctx.ui.input()` for manual path entry
- `ctx.ui.confirm()` for real-worker/preflight confirmation
- `ctx.ui.notify()` for concise feedback

Do **not** build a custom TUI component for M7.

### Target behavior

Commands:

- `/worker-workspace` — show the current/default worker workspace and candidate discovery hints.
- `/worker-workspace-pick` — open a native select dialog of workspace candidates plus a manual-entry option.
- `/worker-run --cwd <path> ...` — run this worker in an explicit cwd.
- `/worker-run ...` without `--cwd` should use the selected worker workspace when present, else the current pi `ctx.cwd`.

Tools:

- `agent_worker_start` already accepts `cwd`; M7 should validate/preflight that cwd and use the shared workspace default when appropriate.
- Tool output should include the effective cwd in compact details if not already visible.

Workspace candidate discovery should be small and deterministic:

1. current pi `ctx.cwd`
2. git top-level for `ctx.cwd` if available
3. sibling directories near the current repo root that look like git repositories
4. recent/selected workspace for this session if present
5. manual path entry option

Keep candidate count bounded and sorted. Do not scan the whole home directory.

### Preflight checks

Before starting a worker, resolve an effective workspace and check:

- path exists
- path is a directory
- git repository top-level can be detected, or warn that it is not a git repo
- real workers show the effective cwd in the confirmation prompt

Optional but useful:

- If the task references a Jira issue or product words, and the selected workspace appears to be `gi-agent-workers`, warn that the workspace may be an extension repo rather than the product repo.
- This heuristic must be a warning only, not a hard block.

### Non-goals

- No worktree creation.
- No persistent global workspace registry unless trivial and local-only.
- No custom TUI component.
- No Jira-specific workspace mapping.
- No automatic product repo discovery across the entire filesystem.
- No parallel workers.
- No model calls required for validation unless explicitly approved.

### Expected files

Likely package files:

- `src/workspaces.ts`
- updates to `src/commands.ts`
- updates to `src/tools.ts`
- updates to `src/service.ts` if effective cwd/result details need shaping
- tests for workspace resolution, bounded candidate discovery, command parsing, and preflight warnings

Docs updates at completion:

- `README.md`
- `CHANGELOG.md`
- `docs/pi-extension-agent-workers/milestones.md`
- `docs/pi-extension-agent-workers/log.md`
- `docs/pi-extension-agent-workers/orchestration-recipes.md` if recipe wording changes

## AC

Implementation is complete when:

1. `/worker-workspace` shows the current effective workspace.
2. `/worker-workspace-pick` uses native `ctx.ui.select()` and `ctx.ui.input()` to set a session workspace.
3. `/worker-run --cwd <path>` runs in that explicit cwd after validation.
4. `/worker-run` without `--cwd` uses the selected workspace when present.
5. `agent_worker_start` respects explicit `cwd` and includes effective cwd in its compact output.
6. Real-worker confirmation displays the effective cwd.
7. Invalid cwd paths fail clearly before spawning.
8. Preflight warns, without hard-blocking, when the workspace is probably not the intended product repo.
9. Tests cover command parsing, workspace candidate discovery, validation, effective cwd resolution, and confirmation/preflight text.
10. Existing M1-M6 behavior remains compatible.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual smoke checks:

```text
/worker-workspace
/worker-workspace-pick
/worker-run --adapter demo hello from selected workspace
/worker-status
```

Do not run real Claude/Codex workers for M7 validation unless explicitly approved.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M7 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M7 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M7 with native pi UI and lightweight preflight only. No custom TUI, worktree automation, Jira-specific mapping, or real model calls were added.

Implemented:

- `src/workspaces.ts` with selected workspace state, bounded candidate discovery, cwd validation, git-root detection, and advisory mismatch warnings.
- `/worker-workspace` to show current/selected/effective workspace.
- `/worker-workspace-pick` using native `ctx.ui.select()` and `ctx.ui.input()` to set or clear a session selected workspace.
- `/worker-run --cwd <path> ...` for one-run explicit workspace selection.
- Selected workspace fallback for `/worker-run` when `--cwd` is omitted.
- `agent_worker_start` effective cwd resolution, validation, and compact `cwd` output.
- Real-worker confirmation messages now include effective `Workspace:` and advisory warnings.
- Tests for command parsing, native picker command behavior, workspace resolution/discovery/validation, preflight warnings, and tool confirmation/output cwd.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
pi -e ./packages/pi-extension-agent-workers --no-session -p "/worker-workspace"
pi -e ./packages/pi-extension-agent-workers --no-session -p "/worker-run --cwd $(pwd) --adapter demo hello from cwd preflight"
```
