# M1 — Worker runner console

## Status

Done.

## SPEC

### Scope

Create the smallest useful vertical slice for supervising one local worker process from pi.

M1 should support:

- A command to start one worker process with a user-provided task.
- A bounded worker adapter interface with a safe M1 demo adapter selected by command arguments.
- The M1 demo adapter should execute only fixed or allowlisted harmless local commands without shell interpolation; real Claude/Codex adapters are deferred to M2 unless explicitly re-scoped.
- Worker state tracking:
  - worker id
  - adapter name
  - task preview
  - cwd
  - PID when available
  - status: queued/running/completed/failed/cancelled
  - startedAt/endedAt/lastActivityAt
  - exit code
  - log path
- Local log capture for stdout/stderr under `~/.pi/agent/agent-workers/runs/<id>/` or another ignored local artifact directory.
- Commands to show status, show a log tail, and cancel a running worker.
- Compact pi feedback through commands and optional notifications; custom widgets/dashboards are deferred.

### Non-goals

- No Jira-specific delegation commands.
- No parallel worker execution.
- No token/cost parsing beyond `usage.source = "unknown"`.
- No default dangerous sandbox or permission bypass flags.
- No arbitrary shell command execution by default.
- No automatic write/destructive mode.
- No custom widget/dashboard UI.
- No long-lived daemon outside the pi extension process.

### Design notes

M1 adapter strategy:

- Implement the adapter boundary, but keep the shipped M1 adapter safe and deterministic.
- Prefer a demo/test adapter that runs a fixed short-lived command or an allowlisted executable with explicit argv.
- Do not pass user task text through a shell.
- Treat real Claude Code and Codex CLI invocation as M2 work unless the milestone is deliberately re-scoped.

Prefer a small internal model:

```ts
type WorkerStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

type UsageSource = "reported" | "estimated" | "unknown";

interface WorkerRun {
  id: string;
  adapter: string;
  taskPreview: string;
  cwd: string;
  pid?: number;
  status: WorkerStatus;
  startedAt: number;
  endedAt?: number;
  lastActivityAt?: number;
  exitCode?: number;
  logPath: string;
  usage: { source: UsageSource };
}
```

Use Node `child_process.spawn()` directly or a small wrapper. Keep process lifecycle behavior testable by injecting a spawn-like function where practical.

Suggested commands are provisional and can be adjusted during implementation:

- `/worker-run --adapter <name> <task>`
- `/worker-status [id]`
- `/worker-log <id>`
- `/worker-kill <id>`
- `/agent-workers` for help/status summary

M1 should be command-first. A widget or dashboard can be added later after lifecycle behavior is proven.

### Expected files

Likely package files:

- `src/index.ts`
- `src/commands.ts`
- `src/worker-manager.ts`
- `src/worker-types.ts`
- `src/logs.ts`
- `src/adapters/demo.ts` or equivalent safe M1 adapter
- tests for command parsing, state transitions, cancel behavior, and log path behavior

Docs updates at completion:

- `README.md`
- `CHANGELOG.md`
- `docs/pi-extension-agent-workers/milestones.md`
- `docs/pi-extension-agent-workers/log.md`

## AC

Implementation is complete when:

1. A user can start one worker process from pi with a bounded command.
2. A running worker exposes status with elapsed time and PID when available.
3. stdout/stderr are written to local non-git artifact paths.
4. A user can cancel a running worker and see cancelled status.
5. Completed/failed workers retain exit code and log path.
6. Token/cost usage is explicitly shown as unknown in M1.
7. Runtime commands do not enable dangerous worker permission flags by default.
8. Tests cover worker state transitions and command argument parsing.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

Manual smoke check:

```bash
pi -e ./packages/pi-extension-agent-workers
```

Then verify the M1 commands in an interactive session using a harmless short-lived worker command or safe adapter.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M1 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M1 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M1 with a safe `demo` adapter, command-first status/log/cancel UX, one-running-worker enforcement, local log capture under `~/.pi/agent/agent-workers/runs/<id>/`, and `usage.source = "unknown"` for all M1 runs.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

A non-interactive load smoke check also exited successfully:

```bash
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```
