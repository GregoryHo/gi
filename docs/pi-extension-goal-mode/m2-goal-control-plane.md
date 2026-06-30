# M2 — Goal Control Plane

## SPEC

### Scope

M2 clarifies Goal Mode control-plane semantics before adding plan-mode or worker integrations. The goal is to make pause, resume, cancel, queued follow-up validation, and status reporting deterministic.

M2 extends the M1 bounded loop with explicit lifecycle categories:

```text
planning -> running_iteration -> verifying -> done
        \-> paused -> planning
        \-> blocked -> planning
        \-> cancelled
```

The extension must distinguish goal lifecycle from agent turn lifecycle. Stopping or pausing the goal loop must not rely on model cooperation.

### Lifecycle semantics

- `planning`, `running_iteration`, `verifying` are active/runnable phases.
- `paused` is resumable and must not auto-continue.
- `blocked` is resumable after user direction.
- `done` is terminal and not resumable.
- `cancelled` is terminal and not resumable.
- Legacy persisted `stopped` states from M1 must restore as `cancelled`.

### Commands

- `/goal <objective>` starts a new goal only when no active/resumable goal is present, or after terminal `done|cancelled`.
- `/goal-pause` pauses an active goal and prevents automatic continuation. It should not abort the current agent turn by default.
- `/goal-resume` resumes only `paused|blocked` goals, creates a new run token, and queues one bounded iteration.
- `/goal-stop` means cancel: set `cancelled`, abort the current agent operation when busy, and invalidate queued Goal Mode follow-ups.
- `/goal-status` shows active, resumable, or terminal state plus the next relevant command.
- `/goal-step` remains a manual one-iteration command for runnable planning state and must not bypass pause/cancel semantics.

### Run-token validation

Every Goal Mode internal follow-up must carry enough metadata to prove it belongs to the current runnable goal:

- `goalId`
- `runId`
- `iterationId`

The `input` handler must accept an internal follow-up only when all of these match the current state and the phase is runnable. Otherwise it must discard the message as stale.

### `goal_report`

- For active runnable goals, `goal_report` continues to record structured progress.
- If a goal is `paused`, `goal_report` may record latest progress but must not move the goal back to `verifying` or auto-continue.
- If a goal is `done` or `cancelled`, `goal_report` must reject the report.
- `done` still requires explicit verification evidence.

### Loop controller

Before queuing any continuation, `agent_end` must re-check:

- current phase is runnable;
- token/run state is current;
- limits allow continuation;
- latest report allows continuation.

`paused|blocked|done|cancelled` must never queue automatic follow-ups.

### Safety gates

Goal Mode safety gates apply only to active runnable goals. Paused, cancelled, done, or absent goals must not trigger Goal Mode-specific write/bash approval.

### Non-goals

- No plan-mode artifact consumption in M2.
- No `agent_worker_*` integration in M2.
- No multi-goal queue or background scheduler.
- No automatic retry strategy beyond existing bounded loop behavior.

## AC

### Acceptance criteria

- State model includes `paused` and `cancelled`; legacy `stopped` restores as `cancelled`.
- `/goal-pause` prevents automatic continuation.
- `/goal-resume` resumes `paused|blocked` only and creates a new run token.
- `/goal-stop` cancels, aborts busy turns, and invalidates queued follow-ups.
- Stale internal follow-ups with old goal/run/iteration tokens are discarded.
- Internal follow-ups for paused, blocked, done, or cancelled goals are discarded.
- `/goal-status` clearly distinguishes active, resumable, terminal, and no-goal states.
- `goal_report` records paused progress without resuming; rejects done/cancelled reports.
- `agent_end` does not continue paused, blocked, done, or cancelled goals.
- Safety gates apply only to runnable active goals.

### Test expectations

Use TDD. Add or update failing tests before implementation for:

- state transition matrix;
- legacy stopped normalization;
- run token creation and validation;
- stale follow-up discard;
- pause/resume/stop command semantics;
- status guidance text;
- `goal_report` paused and terminal behavior;
- `agent_end` no-continue phases;
- safety gates for paused/cancelled goals.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-goal-mode
npm run typecheck --workspace @gregho/pi-extension-goal-mode
npm run pack:dry-run --workspace @gregho/pi-extension-goal-mode
npm run typecheck
```

### Manual smoke checks

1. Start a long goal, run `/goal-pause`, and confirm no automatic next iteration is queued.
2. Run `/goal-resume` and confirm exactly one bounded iteration is queued.
3. Start or resume a goal, run `/goal-stop` while busy, and confirm the current turn is aborted and stale follow-ups are discarded.
4. Confirm `/goal-status` gives useful guidance for active, paused, blocked, done, cancelled, and no-goal states.

## Status tracking

When M2 starts:

- Update `milestones.md` M2 status to `In progress`.
- Append a start note to `log.md`.

When M2 completes:

- Update `milestones.md` M2 status to `Done`.
- Append verification evidence to `log.md`.
- Update README/CHANGELOG with the new control-plane semantics.
