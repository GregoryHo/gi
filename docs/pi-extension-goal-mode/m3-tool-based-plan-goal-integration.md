# M3 — Tool-based Plan → Goal Integration

## SPEC

### Scope

M3 adds tool-discoverable orchestration between Plan Mode and Goal Mode. The integration must let the main agent use tools to compose an explicit user intent such as:

```text
Use goal to complete the current plan.
```

M3 must not add automatic command coupling. Plan Mode exposes current plan data through a read-only tool. Goal Mode exposes a tool to start a bounded goal from ordinary objective text and optional source plan data. The model chooses this tool route only when the user's prompt asks for goal-style bounded execution.

### User-facing behavior

- Asking to view or inspect the current plan should only use Plan Mode read-only tools.
- Asking to use Goal Mode for the current plan should follow this route:

```text
plan_get_current -> goal_start -> goal_report loop
```

- `/plan-execute` must not automatically trigger Goal Mode.
- Plan Mode must not call Goal Mode directly.
- Goal Mode must not silently inspect Plan Mode private closure state.
- Worker integration remains out of scope.

### Plan Mode tool

Add `plan_get_current` as a read-only tool.

Output should be a compact stable shape:

```ts
interface PlanGetCurrentResult {
  found: boolean;
  planId?: string;
  title?: string;
  status?: string;
  cwd?: string;
  steps?: Array<{
    step: number;
    text: string;
    completed?: boolean;
  }>;
}
```

The tool should prefer the current pointer/artifact store and should not expose raw artifact paths or private session internals. It may fall back to runtime state only if needed to report the current plan, but the output shape must remain stable.

### Goal Mode tool

Add `goal_start` as a tool equivalent to `/goal <objective>`.

Input:

```ts
interface GoalStartParams {
  objective: string;
  acceptanceCriteria?: string[];
  sourcePlan?: {
    planId: string;
    title: string;
    status?: string;
    steps: Array<{
      step: number;
      text: string;
      completed?: boolean;
    }>;
  };
}
```

Behavior:

- Reject empty objectives.
- Reject starting when an active or resumable goal exists.
- Allow starting after terminal `done` or `cancelled` goals.
- Create bounded goal state and queue the first internal Goal Mode follow-up.
- Preserve `sourcePlan` in Goal Mode state when supplied.

### Source plan semantics

Goal Mode should preserve source plan id, title, status, and step text/numbering. Plan step `completed` markers are advisory only. They are not verification proof and must not cause Goal Mode to mark work done without concrete verification evidence.

The active goal context should include compact source plan context when present:

- plan id;
- plan title;
- a bounded list of steps, preserving numbers and text;
- a reminder that plan markers are advisory and verification evidence is required before `done`.

### Non-goals

- No automatic `/plan-execute` -> `/goal` trigger.
- No direct Plan Mode dependency on Goal Mode internals.
- No direct Goal Mode dependency on Plan Mode private closure state.
- No worker integration.
- No broad `goal_report` schema expansion in M3.
- No claims that `[DONE:n]` or plan `completed` markers prove acceptance.

## AC

### Acceptance criteria

- Plan Mode registers `plan_get_current` as a read-only tool.
- `plan_get_current` returns `found: false` when no current plan exists.
- `plan_get_current` returns a compact current plan view when an artifact exists.
- `plan_get_current` does not mutate plan status or artifact content.
- Goal Mode registers `goal_start` as a tool.
- `goal_start` starts a bounded goal and queues the first iteration.
- `goal_start` accepts optional `sourcePlan` and persists it in goal state.
- `goal_start` rejects active/resumable goal replacement.
- Active goal context includes compact source plan context when present.
- Persistence restores `sourcePlan` with goal state.
- Tool guidelines document that `plan_get_current` alone does not execute and `goal_start` requires explicit goal/bounded-execution intent.

### Test expectations

Use TDD. Add failing tests before implementation for:

- Plan Mode `plan_get_current` no-plan result;
- Plan Mode `plan_get_current` current artifact result;
- Plan Mode `plan_get_current` no-mutation behavior;
- Goal Mode `goal_start` starts and queues;
- Goal Mode `goal_start` rejects active/resumable goals;
- Goal Mode `sourcePlan` state creation and restore;
- Goal Mode active context formatting with source plan;
- docs/tool guideline expectations where practical.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode

npm test --workspace @gregho/pi-extension-goal-mode
npm run typecheck --workspace @gregho/pi-extension-goal-mode
npm run pack:dry-run --workspace @gregho/pi-extension-goal-mode

npm run typecheck
```

### Manual smoke checks

1. Ask to show the current plan. The agent may call `plan_get_current`; it must not call `goal_start`.
2. Ask to use Goal Mode to complete the current plan. Expected route: `plan_get_current -> goal_start`.
3. Confirm Goal Mode status and context include source plan information.
4. Confirm Goal Mode still requires verification evidence before `done`.
5. Confirm write/destructive actions still go through Goal Mode safety gates.

## Status tracking

When M3 starts:

- Update `milestones.md` M3 status to `In progress`.
- Append a start note to `log.md`.

When M3 completes:

- Update `milestones.md` M3 status to `Done`.
- Append verification evidence to `log.md`.
- Update README/CHANGELOG with tool-based orchestration behavior.
