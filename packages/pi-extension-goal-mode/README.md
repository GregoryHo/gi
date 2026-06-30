# Goal mode pi extension

Pi extension package for bounded autonomous goal loops.

## Status

M2 Goal Control Plane is implemented in the working tree.

## Product intent

Goal mode lets a user give pi an objective and have the main agent iterate toward completion with explicit loop limits, verification requirements, and safety gates.

The loop follows:

```text
plan -> act -> observe -> verify -> continue/block/done
```

M2 separates the Goal Mode control plane from the agent turn lifecycle. Goal state, queued follow-ups, and current agent execution are controlled independently so pause/resume/cancel behavior is deterministic.

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

## Tool

- `goal_report` — LLM-callable structured progress report. Every goal iteration should end with this tool.

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

## Boundary

Goal mode owns bounded objective loops, iteration limits, verification policy, and stop/block decisions.

It does not replace plan mode. Later milestones may consume explicit plan-mode artifacts, but goal mode must not reach into plan-mode private closure state.

It does not replace agent-workers. Later milestones may delegate bounded subtasks to `agent_worker_*` tools only with explicit user intent and workspace context.

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
