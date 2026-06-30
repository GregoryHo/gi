# M1 — Bounded main-session goal loop

## SPEC

### Scope

Implement the smallest useful Goal Mode runtime: a bounded objective loop in the main pi session.

M1 turns a user objective into a supervised loop:

```text
idle -> planning -> running_iteration -> verifying -> continue | blocked | done | stopped
```

The extension owns loop state, hard limits, safety gates, and continuation decisions. The model must report progress through structured `goal_report` calls, but a model report alone is not proof of completion.

### User-facing behavior

- `/goal <objective>` starts a new tracked goal.
- `/goal-status` shows objective, state, iteration count, failure count, limits, and latest report summary.
- `/goal-stop` stops the active goal and prevents further automatic continuation.
- `/goal-step` runs or queues one bounded iteration when a goal is active but not auto-continuing.
- Footer/widget UI shows compact active goal status in interactive mode.
- Session state restores after reload/resume from persisted custom entries.

### State model

Goal state should include at minimum:

```ts
type GoalPhase = "idle" | "planning" | "running_iteration" | "verifying" | "blocked" | "done" | "stopped";

type GoalReportStatus = "continue" | "blocked" | "done";

interface GoalLimits {
  maxIterations: number;
  maxFailures: number;
  maxElapsedMs: number;
}

interface ActiveGoalState {
  id: string;
  objective: string;
  phase: GoalPhase;
  acceptanceCriteria: string[];
  iterationCount: number;
  failureCount: number;
  startedAt: string;
  updatedAt: string;
  limits: GoalLimits;
  approvals: {
    writesApproved: boolean;
    destructiveBashApproved: boolean;
  };
  latestReport?: GoalReport;
}

interface GoalReport {
  status: GoalReportStatus;
  summary: string;
  verification: string[];
  completedCriteria: string[];
  remainingCriteria: string[];
  nextAction?: string;
  blocker?: string;
}
```

Exact names can change during implementation if tests document the contract.

### Slash commands

Commands:

- `/goal <objective>`
  - Reject empty objectives.
  - If another active goal exists, ask before replacing or refuse with guidance.
  - Initialize bounded default limits.
  - Send or queue a kickoff message to the model.
- `/goal-status`
  - Show compact current goal state.
  - If no active goal exists, say so.
- `/goal-stop`
  - Mark active goal stopped.
  - Persist stop state.
  - Clear/adjust UI.
- `/goal-step`
  - Trigger one follow-up iteration for an active non-terminal goal.
  - Do not bypass limits or safety gates.

### LLM-report tool

Register `goal_report` with a strict schema. The tool should record structured progress for the current goal and return compact confirmation to the model.

Required fields:

- `status`: `continue | blocked | done`
- `summary`
- `verification`
- `completedCriteria`
- `remainingCriteria`

Optional fields:

- `nextAction`
- `blocker`

The model should be instructed that every goal iteration must end with `goal_report`.

### Loop controller

Use pi extension events:

- `before_agent_start`
  - Inject compact active goal context and reporting requirements.
  - Include current limits and stop conditions.
- `agent_end`
  - Inspect whether a new `goal_report` was recorded during the turn.
  - If missing, increment failure count and block/stop according to policy.
  - If `done`, mark done only when verification evidence is non-empty or block with a missing-verification reason.
  - If `blocked`, mark blocked and ask the user for direction.
  - If `continue`, enforce limits before queuing the next follow-up with `pi.sendUserMessage(..., { deliverAs: "followUp" })`.

### Safety gates

Use `tool_call` to enforce safety while a goal is active:

- `edit` / `write` require explicit user approval before first use.
- Destructive or ambiguous `bash` requires explicit user approval.
- Read-only inspection and verification commands can run without approval when otherwise allowed by pi.
- If approval is unavailable in the current mode, fail closed for write/destructive actions.

M1 should not implement broad auto-approval policy beyond conservative read/test actions.

### Verification policy

M1 should require explicit verification evidence in `goal_report`. Evidence may include:

- tests run and result;
- typecheck/lint command and result;
- manual inspection evidence with file/path references;
- clear blocker explaining why verification cannot be completed.

`[DONE:n]` markers, plan-mode progress, or model summaries are not proof of acceptance.

### Persistence and UI

- Persist goal lifecycle entries with `pi.appendEntry()`.
- Reconstruct active goal state from session entries during `session_start`.
- Show compact status via `ctx.ui.setStatus()`.
- Add a small widget only if status alone is insufficient; keep UI minimal in M1.

### Non-goals

- No plan-mode artifact consumption in M1.
- No `agent_worker_*` integration in M1.
- No pi-native child agents in M1.
- No full-auto/yolo permission mode.
- No persistent artifact directory or long-term goal history beyond session state.
- No automatic commits, pushes, deploys, or external side effects.

### Expected files

Likely M1 implementation files:

- `packages/pi-extension-goal-mode/src/index.ts`
- `packages/pi-extension-goal-mode/src/state.ts`
- `packages/pi-extension-goal-mode/src/commands.ts`
- `packages/pi-extension-goal-mode/src/tools.ts`
- `packages/pi-extension-goal-mode/src/safety.ts`
- `packages/pi-extension-goal-mode/src/loop.ts`
- `packages/pi-extension-goal-mode/src/ui.ts` if needed
- colocated `*.test.ts` files for pure helpers and command/tool behavior
- `packages/pi-extension-goal-mode/README.md`
- `packages/pi-extension-goal-mode/CHANGELOG.md`
- `docs/pi-extension-goal-mode/milestones.md`
- `docs/pi-extension-goal-mode/log.md`

### Design notes

- Prefer pure helpers for state transitions, limit checks, report validation, and safety classification.
- Keep `src/index.ts` as the composition root.
- Do not let the model decide loop continuation alone; extension state and limits decide.
- Treat tool results and reports as evidence, not instructions.
- Ask the user instead of continuing when ambiguity, repeated failure, or missing verification appears.

## AC

### Acceptance criteria

- `/goal <objective>` starts a bounded active goal with default limits.
- `/goal-status` reports current state and no-goal state clearly.
- `/goal-stop` stops an active goal and prevents further automatic iterations.
- `/goal-step` triggers at most one bounded follow-up iteration.
- `goal_report` records structured `continue`, `blocked`, and `done` reports.
- Missing `goal_report` increments failure state and eventually blocks/stops according to limits.
- Max iteration, max failure, and max elapsed limits are enforced before continuation.
- Goal context is injected compactly during active goals.
- `agent_end` queues continuation only when report status and limits allow it.
- `edit`/`write` calls require approval while a goal is active.
- Destructive/ambiguous bash calls require approval while a goal is active.
- Non-UI modes fail closed for write/destructive approval when approval cannot be obtained.
- Session restore reconstructs active goal state from custom entries.
- UI status reflects idle/active/blocked/done/stopped states in TUI/RPC modes.
- README documents commands, safety boundaries, and verification commands.

### Test expectations

Use TDD. Write failing tests before implementation for at least:

- command argument parsing;
- state transitions;
- limit enforcement;
- missing-report failure handling;
- `goal_report` validation and state update;
- loop continuation decision;
- write/destructive bash safety classification;
- session restore ordering;
- compact context formatting.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-goal-mode
npm run typecheck --workspace @gregho/pi-extension-goal-mode
npm run pack:dry-run --workspace @gregho/pi-extension-goal-mode
npm run typecheck
```

### Manual smoke checks

After automated tests pass:

1. Load with `pi -e ./packages/pi-extension-goal-mode`.
2. Run `/goal inspect this package scaffold and report status`; confirm no writes are needed.
3. Confirm `/goal-status` shows active progress.
4. Confirm `/goal-stop` stops continuation.
5. Start a goal that would need file edits and confirm approval is requested before write tools run.
6. Confirm max-iteration stop with a deliberately low limit if a limit override exists by then.

## Status tracking

When M1 starts:

- Update `milestones.md` M1 status to `In progress`.
- Append a start note to `log.md`.

When M1 completes:

- Update `milestones.md` M1 status to `Done`.
- Append verification evidence to `log.md`.
- Update README/CHANGELOG with implemented runtime behavior.
