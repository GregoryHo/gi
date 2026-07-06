# M4 — Worker-assisted goal loops

## SPEC

### Scope

M4 lets Goal Mode coordinate bounded worker-assisted iterations by composing with the existing `pi-extension-agent-workers` tools when, and only when, the user has explicitly asked for or approved worker delegation.

The integration should remain tool-based and package-independent:

- Goal Mode must not import `pi-extension-agent-workers` internals.
- Goal Mode may add compact goal context that tells the model how to use `agent_worker_*` tools safely when they are available.
- Agent Workers remains responsible for worker process execution, confirmation, workspace preflight, concurrency, wait/status/cancel, and compact worker summaries.

### User-facing behavior

Users can start or continue a Goal Mode loop and explicitly ask for worker assistance, for example:

```text
Use goal mode to implement this plan. Use workers only for independent verification.
```

or:

```text
Use goal mode with a reviewer worker before reporting done.
```

Expected high-level routes:

```text
# Read-only planning or verification worker
plan_get_current? -> goal_start(workerDelegation enabled) -> agent_worker_start(profile: planner|reviewer|verifier) -> agent_worker_wait/status -> goal_report

# Write-capable implementation worker, only with explicit workspace/scope and confirmation
plan_get_current? -> goal_start(workerDelegation enabled) -> agent_worker_start(profile: implementer, cwd: explicit) -> agent_worker_wait/status -> goal_report
```

If the user does not ask for workers, Goal Mode should continue to use the main-session loop and must not encourage opportunistic worker delegation.

### Worker delegation policy

Add an optional worker delegation policy to Goal Mode state, initialized by `goal_start` when explicit user intent is present:

```ts
interface WorkerDelegationPolicy {
  enabled: boolean;
  workspace?: string;
  allowedProfiles?: Array<"planner" | "reviewer" | "verifier" | "implementer">;
  purpose?: string;
}
```

Semantics:

- `enabled: true` means the user has asked for or approved worker assistance for this goal.
- `workspace` is advisory context for the model and should be passed as `cwd` to worker tools when present.
- `allowedProfiles` constrains which worker profiles the model may use for this goal.
- `implementer` is write-capable and must require explicit workspace/scope plus the normal Agent Workers confirmation path.
- Planner, reviewer, and verifier profiles are preferred for M4 because they can be read-only.
- Worker output is evidence input for `goal_report`; it is not automatic proof of completion.

### Goal context behavior

When `workerDelegation.enabled` is true, active goal context should include a compact `[WORKER DELEGATION]` block:

- allowed profiles;
- explicit workspace/cwd if known;
- instruction to use `agent_worker_start` only for bounded subtasks;
- instruction to wait/status workers before using their results;
- reminder that worker summaries are evidence, not final acceptance proof;
- reminder not to bypass Agent Workers confirmation or workspace-collision rules.

When worker delegation is not enabled, active goal context should either omit the block or state that worker delegation requires explicit user intent.

### Tool behavior

Extend `goal_start` to accept optional `workerDelegation`.

Extend `goal_status` details to include `workerDelegation` when present.

`goal_report` does not need a schema change for M4. Worker evidence should be recorded in existing fields:

- `verification`: include compact worker run ids, statuses, and evidence summaries;
- `completedCriteria`: criteria supported by worker evidence;
- `remainingCriteria`: criteria not yet independently verified;
- `blocker`: worker failure, timeout, missing confirmation, ambiguous workspace, or insufficient evidence.

### Safety rules

- No worker delegation without explicit user intent or approval.
- No direct runtime dependency from Goal Mode to Agent Workers internals.
- No automatic implementer worker selection.
- Write-capable workers require explicit workspace/scope and must rely on Agent Workers confirmation and collision checks.
- Worker raw logs must not be injected into goal context or reports; use compact summaries only.
- Worker failures/timeouts must block or continue with a clear next action; they must not be ignored.
- Goal Mode limits still apply. Worker-assisted loops must not become an unbounded delegation loop.

### Non-goals

- No pi-native child-agent adapter.
- No nested workers.
- No direct subprocess execution in Goal Mode.
- No replacement of Agent Workers confirmation, workspace, or concurrency rules.
- No automatic `agent_worker_*` calls from Plan Mode.
- No broad `goal_report` schema redesign unless existing fields prove insufficient.
- No claim that a worker verifier alone proves final acceptance without main-session verification judgment.

### Expected files

Likely implementation files:

- `docs/pi-extension-goal-mode/m4-worker-assisted-goal-loops.md`
- `docs/pi-extension-goal-mode/milestones.md`
- `docs/pi-extension-goal-mode/index.md`
- `docs/pi-extension-goal-mode/log.md`
- `packages/pi-extension-goal-mode/src/state.ts`
- `packages/pi-extension-goal-mode/src/state.test.ts`
- `packages/pi-extension-goal-mode/src/tools.ts`
- `packages/pi-extension-goal-mode/src/tools.test.ts`
- `packages/pi-extension-goal-mode/src/loop.ts`
- `packages/pi-extension-goal-mode/src/loop.test.ts`
- `packages/pi-extension-goal-mode/src/persistence.ts`
- `packages/pi-extension-goal-mode/src/persistence.test.ts`
- `packages/pi-extension-goal-mode/README.md`
- `packages/pi-extension-goal-mode/CHANGELOG.md`

Agent Workers package changes should not be needed for M4 unless verification finds a missing compact-summary or guideline gap.

## AC

### Acceptance criteria

- `goal_start` accepts an optional `workerDelegation` object and preserves it in goal state.
- Invalid `workerDelegation` values are rejected with clear validation errors.
- Goal state persistence restores `workerDelegation`.
- `goal_status` returns compact worker delegation policy details when present.
- Active goal context includes a compact `[WORKER DELEGATION]` block only when delegation is enabled.
- The context prefers `planner`, `reviewer`, and `verifier` for read-only assistance.
- The context states that `implementer` requires explicit workspace/scope and Agent Workers confirmation.
- The context states that worker summaries are evidence, not automatic proof of completion.
- Existing Goal Mode behavior is unchanged when `workerDelegation` is omitted.
- Goal Mode has no direct import from `pi-extension-agent-workers` runtime internals.
- Documentation describes the safe expected routes with `agent_worker_start`, `agent_worker_wait`, `agent_worker_status`, and `goal_report`.
- Manual smoke demonstrates that explicit worker-enabled goal prompts can produce the intended tool route when both extensions are loaded.
- Manual smoke demonstrates that ordinary Goal Mode prompts do not opportunistically start workers.

### Stop conditions

Stop implementation and report a blocker if any of these occur:

- The design requires Goal Mode to import Agent Workers internals.
- The model starts write-capable workers without explicit workspace/scope or confirmation.
- Worker evidence cannot be represented compactly in existing `goal_report` fields.
- Worker tool routes become ambiguous enough that prompt guidance cannot reliably distinguish read-only verification from implementation.
- Existing Goal Mode safety gates or loop limits regress.
- Tests or typecheck fail after two focused fix attempts.

### Test expectations

Use TDD. Add failing tests before implementation for:

- `createGoalState` preserving `workerDelegation`;
- `goal_start` normalizing valid `workerDelegation`;
- `goal_start` rejecting invalid profiles or malformed policy;
- `goal_status` exposing worker policy;
- persistence restoring worker policy;
- active context rendering worker delegation guidance when enabled;
- active context omitting worker delegation guidance when disabled;
- no direct dependency on Agent Workers internals where practical via import/static check.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-goal-mode
npm run typecheck --workspace @gregho/pi-extension-goal-mode
npm run pack:dry-run --workspace @gregho/pi-extension-goal-mode
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

### Manual smoke checks

Use an isolated temp folder for any write-capable scenarios.

1. Load Goal Mode and Agent Workers together.
2. Ask for a normal goal without workers; verify no `agent_worker_*` tool call is made.
3. Ask for a goal with read-only verifier worker assistance; expected route includes `goal_start(workerDelegation) -> agent_worker_start(profile: verifier) -> agent_worker_wait/status -> goal_report`.
4. Ask for implementer worker assistance without explicit workspace; verify the agent asks for workspace/scope or blocks rather than starting the worker.
5. Ask for implementer worker assistance with explicit temp workspace; verify Agent Workers confirmation/safety path is preserved.
6. Verify worker result summaries appear as compact `goal_report.verification` evidence.
7. Verify Goal Mode still blocks `done` reports without verification evidence.

## Status tracking

When implementation starts:

- Update `milestones.md` M4 status to `In progress`.
- Append a start note to `log.md`.

When implementation completes:

- Run the verification commands and manual smoke checks above.
- Update `milestones.md` M4 status to `Done`.
- Append verification evidence to `log.md`.
- Update README/CHANGELOG with worker-assisted goal behavior.
