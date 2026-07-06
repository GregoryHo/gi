# Goal mode pi extension

Pi extension package for bounded autonomous goal loops.

## Status

M4 Worker-assisted goal loops are implemented in the working tree.

## Product intent

Goal mode lets a user give pi an objective and have the main agent iterate toward completion with explicit loop limits, verification requirements, and safety gates.

The loop follows:

```text
plan -> act -> observe -> verify -> continue/block/done
```

M2 separates the Goal Mode control plane from the agent turn lifecycle. Goal state, queued follow-ups, and current agent execution are controlled independently so pause/resume/cancel behavior is deterministic.

M3 adds tool-based orchestration: Plan Mode can expose the current plan with `plan_get_current`, and Goal Mode can start bounded loops with `goal_start`. The model composes these tools only when the user's natural-language intent asks for Goal Mode execution.

M4 adds worker-assisted loop guidance: `goal_start` can carry an explicit `workerDelegation` policy so Goal Mode injects compact worker-use context only when the user asks for or approves worker assistance. Agent Workers still owns worker execution, confirmation, workspace checks, concurrency, wait/status/cancel, and summaries.

## Commands

- `/goal <objective>` — start a bounded goal loop for an objective.
- `/goal-status` — show current goal state and next recommended command.
- `/goal-pause` — pause a runnable goal loop without cancelling it or aborting the current turn by default.
- `/goal-resume` — resume a paused or blocked goal with a fresh run token and one bounded iteration.
- `/goal-stop` — cancel the current/resumable goal, abort the current agent operation when busy, and invalidate queued Goal Mode follow-ups.
- `/goal-step` — queue one bounded iteration when the goal is in `planning`.

## Lifecycle semantics

Goal phases:

- Active/runnable: `planning`, `running_iteration`, `verifying`
- Resumable: `paused`, `blocked`
- Terminal: `done`, `cancelled`

Legacy persisted `stopped` states from M1 restore as `cancelled`.

Each Goal Mode internal follow-up carries token metadata:

- `goalId`
- `runId`
- `iterationId`

The extension accepts queued follow-ups only when the token matches the current runnable goal. Stale follow-ups are discarded before reaching the LLM.

## Tools

- `goal_start` — LLM-callable bounded loop starter. Use only when the user explicitly asks for Goal Mode, bounded autonomous completion, or to use goal to complete work. Accepts optional `sourcePlan` and optional explicit `workerDelegation` policy.
- `goal_status` — LLM-callable current-goal inspection tool. Includes compact `workerDelegation` details when present.
- `goal_report` — LLM-callable structured progress report. Every goal iteration should end with this tool.

When the user asks to use Goal Mode for the current plan, expected tool route is:

```text
plan_get_current -> goal_start -> goal_report loop
```

`goal_start` accepts optional `sourcePlan` context. Source plan step numbers/text are preserved, and `completed` markers are advisory only.

`goal_start` also accepts optional `workerDelegation` only when the user explicitly asks for or approves worker assistance:

```ts
{
  enabled: true,
  workspace?: string,
  allowedProfiles?: Array<"planner" | "reviewer" | "verifier" | "implementer">,
  purpose?: string,
}
```

When enabled, active goal context includes a compact `[WORKER DELEGATION]` block. Planner, reviewer, and verifier are preferred for read-only assistance. The `implementer` profile requires explicit workspace/scope and the normal Agent Workers confirmation path. Worker summaries should be recorded as compact `goal_report.verification` evidence; they are not automatic proof of completion.

Expected worker-assisted route:

```text
goal_start(workerDelegation) -> agent_worker_start -> agent_worker_wait/status -> goal_report
```

`goal_report` records:

- `status`: `continue`, `blocked`, or `done`
- `summary`
- `verification`
- `completedCriteria`
- `remainingCriteria`
- optional `nextAction`
- optional `blocker`

A `done` report without verification evidence is blocked rather than accepted as complete.

For paused goals, `goal_report` may record latest progress but does not resume or continue the loop. For terminal `done` or `cancelled` goals, `goal_report` is rejected.

## Safety boundaries

- Goal loops have max-iteration, max-failure, and max-elapsed-time limits.
- `edit` and `write` require explicit approval while a runnable goal is active.
- Destructive or ambiguous `bash` requires explicit approval while a runnable goal is active.
- Read-only inspection and common verification commands such as `npm test` and `npm run typecheck` are allowed.
- Non-UI modes fail closed for write/destructive approval.
- Paused, cancelled, done, or absent goals do not trigger Goal Mode-specific safety gates.
- Goal state is session-local, restored from pi custom entries, and displayed in compact footer status.
- Worker delegation is never enabled by default; it requires explicit user intent or approval.
- Write-capable implementer workers require explicit workspace/scope and the Agent Workers confirmation/safety path.
- Worker output is compact evidence for `goal_report`, not automatic acceptance proof.

## Boundary

Goal mode owns bounded objective loops, iteration limits, verification policy, and stop/block decisions.

It does not replace plan mode. Goal Mode consumes explicit plan data passed to `goal_start`; it must not reach into Plan Mode private closure state. `plan_get_current` alone does not execute a plan or start Goal Mode.

It does not replace agent-workers. Goal Mode may guide the model to delegate bounded subtasks to `agent_worker_*` tools only when `workerDelegation` is explicitly enabled, but it does not import Agent Workers internals or bypass Agent Workers confirmation, workspace preflight, concurrency, or result-summary behavior.

## Load while developing

```bash
pi -e ./packages/pi-extension-goal-mode
```

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-goal-mode
npm run typecheck --workspace @gregho/pi-extension-goal-mode
npm run pack:dry-run --workspace @gregho/pi-extension-goal-mode
npm run typecheck
```
