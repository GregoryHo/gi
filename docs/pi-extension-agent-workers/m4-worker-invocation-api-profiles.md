# M4 — Worker invocation API and profiles

## Status

Done.

## SPEC

### Scope

Turn `pi-extension-agent-workers` into a reusable worker runtime that other extensions can wrap or invoke without depending on a domain-specific command.

M4 should introduce stable invocation concepts:

- `WorkerRequest` — a normalized request shape for running a worker.
- `WorkerProfile` — reusable configuration presets for adapter, mode, prompt defaults, model, and confirmation policy.
- `WorkerResult` — a normalized output contract for callers, hiding raw CLI event details behind compact status/result fields and artifact paths.
- A small internal service API that slash commands and future integrations can share.
- Command support for invoking profiles, for example `/worker-run --profile planner <task>`.

Proposed request shape:

```ts
type WorkerMode = "plan" | "review" | "implement" | "custom";

type WorkerAdapterName = "demo" | "claude-code" | "codex-cli";

interface WorkerRequest {
  adapter?: WorkerAdapterName;
  profile?: string;
  mode?: WorkerMode;
  task: string;
  systemPrompt?: string;
  cwd?: string;
  model?: string;
  timeoutMs?: number;
  requireConfirmation?: boolean;
  metadata?: Record<string, unknown>;
}
```

Proposed profile shape:

```ts
interface WorkerProfile {
  name: string;
  adapter: WorkerAdapterName;
  mode: WorkerMode;
  systemPrompt?: string;
  model?: string;
  requireConfirmation: boolean;
}
```

Proposed result shape:

```ts
interface WorkerResult {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  finalText?: string;
  usage: WorkerUsage;
  activity: string[];
  logPath: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

### Non-goals

- No Jira-specific commands.
- No domain-specific command surfaces in the core package.
- No multi-worker orchestration.
- No worktree automation unless separately planned.
- No cloud worker orchestration.
- No new real CLI adapters beyond M3 adapters unless explicitly scoped.
- No raw event exposure in the public result contract by default.

### Design notes

The core package should own generic worker execution:

- lifecycle
- adapter invocation
- parser normalization
- status/log/usage
- confirmation policy
- final result contract

Other packages should own domain-specific prompt construction and call into this package through the stable API or generic commands.

Start with the smallest useful public surface:

1. Internal `AgentWorkerService` used by commands.
2. Exported TypeScript factory or helper for future integrations.
3. Profile-aware slash command invocation.

Defer event bus and tool integration unless needed by a concrete integration:

- possible future event: `agent-workers:run`
- possible future tool: `agent_worker_run`

Profiles can be hardcoded defaults in M4 if persistent config would make the milestone too large. If persistence is added, use a local ignored config path and do not commit user prompts or secrets.

### Expected files

Likely package files:

- `src/service.ts`
- `src/profiles.ts`
- `src/request-types.ts` or extensions to `worker-types.ts`
- updates to `src/commands.ts`
- tests for request normalization, profile resolution, result shaping, and command parsing

Docs updates at completion:

- `README.md`
- `CHANGELOG.md`
- `docs/pi-extension-agent-workers/milestones.md`
- `docs/pi-extension-agent-workers/log.md`

## AC

Implementation is complete when:

1. A generic `WorkerRequest` can be resolved into adapter invocation inputs without domain assumptions.
2. Built-in profiles exist for at least planning and review use cases.
3. `/worker-run --profile <name> <task>` works through the same worker manager path as direct adapter runs.
4. Result shaping returns a compact `WorkerResult` with run id, status, final text, usage, activity, log path, and error when present.
5. Raw event payloads are not part of the public result contract by default.
6. Real worker confirmation policy still applies unless a profile explicitly overrides it safely.
7. Tests cover request normalization, profile resolution, command parsing, and result shaping.
8. Existing M1/M2/M3 behavior remains compatible.

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

Then verify at least one profile-backed demo or real worker run. Avoid committing raw worker logs.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M4 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M4 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M4 as the generic invocation layer for `agent-workers`, without adding domain-specific commands.

Implemented:

- `WorkerRequest`, `ResolvedWorkerRequest`, `WorkerProfile`, `WorkerResult`, `WorkerMode`, and `WorkerAdapterName` types.
- `AgentWorkerService` for resolving profile/direct requests and starting workers through the existing manager.
- `workerResultFromRun` for compact public result shaping without raw event payloads.
- Built-in `planner` and `reviewer` profiles.
- Profile-backed slash commands via `/worker-run --profile planner <task>` and `/worker-run --profile reviewer <task>`.
- Exported service/profile/request APIs from package entrypoint.

Manual smoke evidence from pi interactive testing:

- Reloaded the extension after implementation so profile commands were active.
- `/worker-run --profile planner Reply with OK only.` started `adapter: claude-code` with profile system prompt content in the task preview.
- The run completed with `exitCode: 0`, `usage.source: reported`, activity summary, and `final: OK`.
- Raw logs remained under `~/.pi/agent/agent-workers/runs/<id>/` and were not committed.

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
