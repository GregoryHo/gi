# Goal mode roadmap

## Goal

Build a conservative loop-engineering extension for pi that lets the main agent iterate toward a user-defined objective while the extension enforces limits, verification requirements, and safety gates.

## Product principles

- Bounded autonomy first: no unbounded full-auto behavior.
- Harness owns the loop: the model reports progress, but the extension decides whether to continue, block, or stop.
- Verification is first-class: tests, typecheck, lint, explicit acceptance evidence, or a clear blocker.
- Approval at risk boundaries: writes, destructive shell commands, external side effects, and worker delegation need explicit user intent or confirmation.
- Compact context: goal state injected into the prompt must stay short.
- Layered integration: plan artifacts and workers are later milestones, not M1 dependencies.

## Research summary

Recent loop-engineering research and official agent docs support a `plan -> act -> observe -> verify -> repeat` loop with explicit stop conditions. Useful controls include max iterations, max elapsed time, repeated-failure stops, human approval breakpoints, and independent verification. Human-in-the-loop systems should pause at risky actions or exception states, not every turn. Agent harnesses should record state and resume/stop deterministically.

## Milestone sequence

### M1 — Bounded main-session goal loop

Smallest useful runtime slice:

- `/goal <objective>` starts a tracked goal in the main pi session.
- `/goal-status`, `/goal-stop`, and `/goal-step` expose control surfaces.
- `goal_report` lets the model submit structured progress and verification status.
- Hidden context tells the model the active objective, limits, and reporting contract.
- `agent_end` continues only when state, limits, and `goal_report` allow it.
- Safety gates require approval for writes/destructive commands.
- State restores from session entries.

Plan: `m1-bounded-main-session-goal-loop.md`.

### M2 — Goal Control Plane

After M1 acceptance, clarify loop-control semantics before adding integrations:

- Add explicit pause/resume/cancel semantics.
- Distinguish goal lifecycle from agent turn lifecycle.
- Validate queued follow-ups with `goalId`, `runId`, and `iterationId` tokens.
- Ensure paused, blocked, done, and cancelled goals never auto-continue.
- Improve `/goal-status` guidance for active, resumable, terminal, and no-goal states.

Plan: `m2-goal-control-plane.md`.

### M3 — Tool-based Plan → Goal Integration

After control-plane semantics are stable:

- Expose current Plan Mode artifacts through read-only tools.
- Start Goal Mode loops through explicit goal tools, not command coupling.
- Let the model compose `plan_get_current -> goal_start` only when user intent asks for Goal Mode execution.
- Preserve plan step text and numbering as source context.
- Treat plan completion markers as advisory, not verification proof.
- Track goal-specific acceptance and verification state separately.

Plan: `m3-tool-based-plan-goal-integration.md`.

### M4 — Worker-assisted goal loops

Implemented after main-session loops and plan-artifact consumption stabilized:

- Use `agent_worker_start` with `planner`, `reviewer`, or `verifier` only after explicit user intent.
- Use `implementer` only with explicit workspace/scope and confirmation.
- Consume worker output as compact evidence, not raw logs.
- Do not bypass `agent-workers` confirmation or workspace collision rules.
- Preserve package independence: Goal Mode stores policy/guidance, while Agent Workers owns execution and safety checks.

Plan: `m4-worker-assisted-goal-loops.md`.

### M5 — Pi-native child-agent backend exploration

Future optional work:

- Evaluate pi SDK child sessions as an adapter or helper.
- Keep child-agent permissions scoped and bounded.
- Do not add nested autonomous behavior until M1-M3 safety is proven.

## Deferred

- Full-auto/yolo write behavior.
- Cloud task runners.
- Worker delegation in M1.
- Plan-mode artifact import in M1.
- Persistent artifact lifecycle beyond session state.
