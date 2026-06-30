# Goal mode milestones

## Active / proposed

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 — Bounded main-session goal loop | Done | `m1-bounded-main-session-goal-loop.md` | Start, supervise, and stop a bounded main-session goal loop with structured reports, limits, verification policy, safety gates, UI status, and session restore. |
| M2 — Goal Control Plane | Done | `m2-goal-control-plane.md` | Add pause/resume/cancel semantics, queued follow-up token validation, and clearer status guidance before integrations. |
| M3 — Plan artifact consumption | Deferred | TBD | Explicitly start goals from plan-mode artifacts without coupling to plan-mode internals. |
| M4 — Worker-assisted goal loops | Deferred | TBD | Delegate planning/review/verification/implementation to `agent-workers` with explicit user approval and workspace context. |
| M5 — Pi-native child-agent backend exploration | Deferred | TBD | Explore pi SDK-backed child sessions only after main-session and worker-assisted loops are proven. |

## Review gate

Implementation must not start until the active milestone SPEC and AC are accepted.
