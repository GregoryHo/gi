# M5 — Plan artifact lifecycle and session indexing

## SPEC

### Scope

Add durable local plan artifacts and indexing so captured plans remain discoverable across long-lived sessions, multiple plans per session, reloads, and future goal-mode handoffs.

M5 turns the current session-local captured plan into a managed lifecycle model. It should separate active state from archived snapshots and make plans searchable by workspace, session, status, and title/summary.

### User-facing behavior

- The extension assigns every persisted plan a stable `planId`.
- A long-lived pi session may contain many plans.
- At most one plan is the active executing plan for a workspace/session at a time.
- `/plan-new` starts a new active plan flow without silently overwriting the previous active plan.
- `/plan-history` lists recent plans for the current workspace.
- `/plan-history --session` lists plans associated with the current session.
- `/plan-switch <id>` switches the active plan pointer to an existing plan.
- `/plan-complete` marks the active plan completed and writes a deterministic recap.
- `/plan-abandon` marks the active plan abandoned and archives its final state.
- `/plan-current` shows active plan id, status, session sequence, and progress.

### Storage model

Runtime artifacts should live outside git-tracked paths, under a local pi-owned directory such as:

```text
~/.pi/agent/plan-mode/<project-key>/
  current.json
  index.json
  sessions/
    <session-id>.json
  plans/
    YYYY-MM/
      <planId>.json
```

`current.json` should be a pointer, not the full plan body:

```json
{
  "activePlanId": "plan_20260628_143012_auth_refactor"
}
```

`index.json` should hold compact searchable metadata:

```json
{
  "plans": [
    {
      "id": "plan_20260628_143012_auth_refactor",
      "title": "Auth refactor",
      "status": "completed",
      "createdAt": "2026-06-28T14:30:12.000Z",
      "updatedAt": "2026-06-28T15:05:00.000Z",
      "cwd": "/repo",
      "sessionFile": "...jsonl",
      "sessionPlanNumber": 7,
      "artifactPath": "plans/2026-06/plan_20260628_143012_auth_refactor.json",
      "summary": "Refactor auth module with tests."
    }
  ]
}
```

Each plan artifact should contain the durable plan body:

```ts
interface PlanArtifactV1 {
  source: "pi-extension-plan-mode";
  version: 1;
  id: string;
  title: string;
  status: "draft" | "approved" | "executing" | "completed" | "abandoned" | "archived";
  cwd: string;
  session: {
    primarySessionFile?: string;
    createdAtEntryId?: string;
    lastUpdatedEntryId?: string;
    completedAtEntryId?: string;
  };
  sequence: {
    sessionPlanNumber: number;
    previousPlanId?: string;
    nextPlanId?: string;
  };
  steps: Array<{
    step: number;
    text: string;
    completed?: boolean;
  }>;
  recap?: {
    summary: string;
    completedSteps: number;
    totalSteps: number;
    verification?: string[];
    sessionRange?: {
      fromEntryId?: string;
      toEntryId?: string;
    };
  };
}
```

### Lifecycle rules

- Capture/update writes active state and updates the current plan artifact.
- Archive snapshots are created on explicit save, execute, complete, abandon, or `/plan-archive` if added.
- Existing archived artifacts are immutable except for index repair/migration tools in a future milestone.
- A new plan must not silently overwrite the previous active plan.
- If an active plan exists, `/plan-new` must ask for a disposition: complete, abandon, archive/keep inactive, or cancel.
- Deterministic recap is generated on complete/abandon using current plan state, not an LLM call.

### Non-goals

- No natural-language routing or LLM intent detection; that is M6.
- No LLM-generated recap.
- No goal-mode implementation.
- No worker/sub-agent delegation.
- No cloud sync.
- No migration of Claude Code or Codex CLI plan files.

### Expected files

Likely implementation files:

- `packages/pi-extension-plan-mode/src/artifacts.ts` — artifact paths, project keying, read/write helpers.
- `packages/pi-extension-plan-mode/src/artifact-types.ts` or extensions to `plan.ts` — versioned artifact types.
- `packages/pi-extension-plan-mode/src/index.ts` — wire lifecycle commands.
- tests for path selection, index updates, status transitions, and recap generation.

## AC

### Functional acceptance criteria

- New captured plans receive stable unique ids.
- `current.json` stores only the active plan pointer.
- Plan artifacts are written outside git-tracked paths.
- `index.json` can list plans by workspace and current session.
- One long-lived session can create multiple plans with increasing `sessionPlanNumber`.
- `/plan-new` does not silently replace an active plan; it requires disposition or cancellation.
- `/plan-history` lists recent workspace plans with id, title, status, and timestamp.
- `/plan-history --session` filters to current session plans.
- `/plan-switch <id>` updates the active pointer and restores plan state.
- `/plan-complete` writes a deterministic recap and marks the plan completed.
- `/plan-abandon` marks the plan abandoned and keeps it findable in history.
- `/plan-current` displays plan id/title/status/session sequence.
- Existing M1-M3 behavior remains intact.

### Verification commands

From repo root:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```

Manual smoke test after implementation:

1. Create plan A and execute/complete or abandon it.
2. Run `/plan-new` and create plan B in the same pi session.
3. Confirm `/plan-history --session` shows both plans.
4. Confirm `/plan-switch <planA>` restores plan A as active.
5. Confirm artifacts exist under `~/.pi/agent/plan-mode/...`, not repo paths.

## Status tracking

When implementation begins:

- Update `milestones.md` M5 status to `In progress`.
- Append a start note to `log.md`.

When implementation completes:

- Update `milestones.md` M5 status to `Complete`.
- Append verification evidence to `log.md`.
- Update package README and CHANGELOG.
