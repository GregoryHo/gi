# M4 — Goal/worker integration boundary

## SPEC

### Scope

Define the integration boundary between `pi-extension-plan-mode`, a future `pi-extension-goal-mode`, and the existing `pi-extension-agent-workers` package.

M4 is a contract/design milestone. It should document the plan artifact shape, ownership boundaries, and safety rules that future goal/worker integrations must follow. Runtime integration code is optional and should be limited to non-invasive exports or documentation updates if needed.

### User-facing behavior

No new user-facing runtime behavior is required in M4.

The outcome should make future behavior clear:

- Plan mode owns safe planning, captured plan state, explicit execution handoff, and marker-based progress for the main pi session.
- Goal mode will own bounded objective loops, iteration limits, verification policy, and stop/block decisions.
- Agent workers own delegated subprocess/worker execution, worker profiles, workspace preflight, wait/status/cancel, and compact worker summaries.

### Integration contract

Plan mode may expose or document a stable lightweight plan artifact:

```ts
interface CapturedPlanArtifact {
  source: "pi-extension-plan-mode";
  version: 1;
  steps: Array<{
    step: number;
    text: string;
    completed?: boolean;
  }>;
  status: "planning" | "approved" | "executing" | "complete";
}
```

Future goal mode may consume this artifact by:

- reading it from explicit command/user handoff, not silently from private closure state;
- preserving step numbers and text;
- treating `completed` as advisory marker state, not proof of acceptance;
- adding its own acceptance criteria and verification state separately.

Future goal mode may call `agent_worker_*` tools only when:

- the user has chosen or approved delegation;
- the target workspace is explicit;
- write-capable worker profiles remain subject to `agent-workers` confirmation and workspace-collision rules;
- worker output is consumed as compact evidence, not raw logs.

### Ownership boundaries

#### Plan mode owns

- `/plan`
- `/plan-current`
- `/plan-execute`
- read-only planning safety gates
- captured `Plan:` steps
- explicit execute handoff in the main session
- `[DONE:n]` marker progress display

#### Goal mode should own

- `/goal` and goal lifecycle commands
- iteration limits and stop conditions
- acceptance criteria and verification state
- deciding when to ask the user vs continue
- deciding whether to use plan mode artifacts as an initial plan

#### Agent workers own

- `agent_worker_start`, `agent_worker_wait`, `agent_worker_status`, `agent_worker_cancel`, and related worker tools
- worker profiles such as planner, reviewer, implementer, and verifier
- external Claude Code/Codex CLI adapter behavior
- workspace preflight, confirmation, concurrency, and local run artifacts

### Non-goals

- Do not implement `pi-extension-goal-mode` in M4.
- Do not add direct runtime dependency from plan mode to `pi-extension-agent-workers`.
- Do not auto-call worker tools from plan mode.
- Do not add autonomous retry/verification loops to plan mode.
- Do not change worker safety rules from this package.
- Do not claim `[DONE:n]` markers are verification proof.

### Expected files

Likely M4 changes:

- `docs/pi-extension-plan-mode/m4-goal-worker-integration-boundary.md` — this spec.
- `docs/agent-modes-research-and-roadmap.md` — link/update the cross-package route if needed.
- `packages/pi-extension-plan-mode/README.md` — document boundary/non-goals if needed.
- Optionally `packages/pi-extension-plan-mode/src/plan.ts` exports remain sufficient; no new runtime behavior unless a clear contract gap is found.

### Design notes

- Prefer documentation over code unless implementation is needed to stabilize an export.
- Keep plan mode independent and usable without goal mode or worker packages installed.
- Keep cross-package data shapes simple and versioned.
- Future goal mode should import or consume explicit artifacts rather than reaching into session-private custom entries without user intent.
- Agent-worker integration belongs in goal mode or orchestration recipes, not plan mode.

## AC

### Acceptance criteria

- M4 defines a clear plan artifact contract with versioning.
- M4 documents what plan mode owns vs what future goal mode owns vs what agent workers own.
- M4 states that plan mode must not directly depend on or auto-call `agent-workers`.
- M4 states that worker delegation requires explicit user approval/intent and explicit workspace context.
- M4 states that `[DONE:n]` marker completion is not proof of acceptance/verification.
- Cross-package roadmap docs point to the boundary decision.
- Package README documents that goal/worker integration is intentionally out of plan-mode runtime scope.
- No new runtime behavior is introduced unless required for stable exports.

### Verification commands

If M4 is documentation-only:

```bash
git diff --check
npm run typecheck --workspace @gregho/pi-extension-plan-mode
```

If any package code changes are made, run full package verification:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```

## Status tracking

When M4 starts:

- Update `milestones.md` M4 status to `In progress`.
- Append a start note to `log.md`.

When M4 completes:

- Update `milestones.md` M4 status to `Complete`.
- Append verification evidence to `log.md`.
- Update roadmap/index/archive docs as appropriate.
