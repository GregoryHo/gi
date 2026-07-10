# v0.4.0 M1 — Pi SDK-backed worker adapter MVP

## Status

Done.

## SPEC

Add a `pi-sdk` worker adapter to `packages/pi-extension-agent-workers` so delegated worker behavior can run through local pi SDK child sessions instead of only external CLI processes.

Scope:

- Extend the worker adapter/runtime contract to support both subprocess-backed adapters and in-memory async adapters.
- Keep existing `demo`, `claude-code`, and `codex-cli` behavior stable.
- Implement a `pi-sdk` adapter using `createAgentSession()` with an isolated in-memory `SessionManager`.
- Use worker profile prompts as child instructions.
- Support conservative profile tool scopes:
  - read-only profiles: `read`, `grep`, `find`, `ls`
  - write-capable profiles: `read`, `grep`, `find`, `ls`, `bash`, `edit`, `write` only after existing confirmation/workspace safety applies
- Enforce timeout/abort behavior and compact final result shaping.
- Return compact final summary, usage/status metadata when available, and local artifact/log references.
- Wire `pi-sdk` through commands, LLM tools, config validation, profile resolution, README, and orchestration docs.

Non-goals:

- No nested sub-agents.
- No long-lived child sessions.
- No cloud execution.
- No automatic write authority beyond existing worker safety rules.
- No project-local child extension discovery unless explicitly designed in a later milestone.
- No removal or replacement of existing external CLI adapters.

## Design notes

- The current `WorkerAdapter` contract is process-centric (`createSpawnSpec`). M1 should introduce the smallest adapter execution abstraction needed for async in-memory workers without overhauling command/tool APIs.
- Child sessions should avoid accidental recursion through loaded `agent-workers` tools. Prefer a minimal resource loader or otherwise controlled child-session resource configuration.
- `pi-sdk` should be classified as a real adapter for confirmation purposes because child sessions can use tools that read or modify the workspace.
- Missing SDK usage data must remain `usage.source = "unknown"`, not zero.

## Expected files

Likely production files:

- `src/core/worker-types.ts`
- `src/core/worker-manager.ts`
- `src/core/service.ts`
- `src/core/request-types.ts`
- `src/adapters/pi-sdk.ts`
- `src/config/profiles.ts`
- `src/config/index.ts`
- `src/commands/args.ts`
- `src/commands/format.ts`
- `src/commands/index.ts`
- `src/tools/index.ts`
- `src/index.ts`

Likely docs:

- `README.md`
- `CHANGELOG.md`
- `../../docs/pi-extension-agent-workers/orchestration-recipes.md`
- `../../docs/pi-extension-agent-workers/index.md`
- `../../docs/pi-extension-agent-workers/log.md`
- `versions/0.4.0/*`

## AC

- `adapter: "pi-sdk"` can be used through `/worker-run`, `agent_worker_start`, and workspace config defaults.
- Existing adapters continue to pass tests and typecheck.
- `pi-sdk` runs a bounded child `AgentSession` and records a normal `WorkerRun` lifecycle.
- Timeout/cancel paths terminate/abort the child session and produce terminal worker statuses.
- Read-only profiles do not expose write tools to child sessions.
- Write-capable profiles require confirmation and respect existing workspace collision rules.
- Compact worker summaries include status, elapsed time, usage source, activity/final text preview, cwd, and artifact/log pointers.
- Docs describe behavior, non-goals, safety boundaries, and usage examples.
- Full verification passes or any blocker is recorded with evidence.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual smoke when credentials/model are available:

```bash
pi -e ./packages/pi-extension-agent-workers
/worker-run --adapter pi-sdk --yes Reply with OK only.
```

## Status tracking

At start:

- Create `versions/0.4.0/` docs and mark M1 `In progress`.
- Append a start entry to `versions/0.4.0/log.md` and root `log.md`.
- Commit the status/log update before implementation work.

At completion:

- Mark M1 `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.4.0/log.md` and root `log.md`.
- Update package README, changelog, and release docs as appropriate.

## Completion notes

Implementation progress as of 2026-07-07:

- Added async/in-memory adapter support alongside subprocess adapters.
- Added `src/adapters/pi-sdk.ts` using `createAgentSession()` with isolated in-memory sessions and a minimal child resource loader.
- Wired `pi-sdk` through command parsing/help, LLM tool schema, workspace config defaults, custom profile validation, request/service types, and default `WorkerManager` registration.
- Preserved safety defaults: `pi-sdk` is treated as a real adapter requiring confirmation by default; read-only runs expose only `read`, `grep`, `find`, and `ls`; write-capable runs expose `bash`, `edit`, and `write` only after existing confirmation/workspace safety applies.
- Added tests for async adapter success/failure/cancel/timeout paths, pi-sdk tool-scope selection, child final/usage shaping, and public adapter surface wiring.
- Updated README, CHANGELOG, orchestration recipes, and v0.4.0 docs with behavior, non-goals, safety boundaries, and usage notes.
- Final verification passed:
  - `npm test --workspace @gregho/pi-extension-agent-workers` — 127 tests passed.
  - `npm run typecheck --workspace @gregho/pi-extension-agent-workers` — passed.
  - `npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers` — passed and included `src/adapters/pi-sdk.ts` in `gregho-pi-extension-agent-workers-0.3.1.tgz` dry-run contents.
  - `npm run typecheck` — passed across workspaces.
  - `pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"` — exited successfully.
- Manual interactive `pi-sdk` smoke passed after the automated verification slice: `/worker-run --adapter pi-sdk --yes Reply with OK only.` started `run_1783409485446_445c9626` in `/Users/gregho/GitHub/AI/gi`; the local run index records `status: completed`, `statusReason: exit_zero`, `exitCode: 0`, `finalText: OK`, `usage.source: reported`, elapsed `2350ms`, and log `/Users/gregho/.pi/agent/agent-workers/runs/run_1783409485446_445c9626/output.log` contains `[stdout] pi-sdk child session completed`.
