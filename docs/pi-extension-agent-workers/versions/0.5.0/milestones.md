# Agent workers v0.5.0 milestones

| Milestone | Status | Goal | Notes |
| --- | --- | --- | --- |
| M1 Pi SDK hardening and boundary tests | In progress | Harden complete results, child options/budgets, observability, and resource boundaries | Plan: `m1-pi-sdk-hardening.md` |
| M2 Versioned worker runtime protocol | Proposed | Expose one shared worker runtime to separate coordination packages through versioned `pi.events` requests | Plan: `m2-runtime-protocol.md` |

## Completion criteria

- `pi-sdk` child sessions return bounded complete results with private artifact fallback.
- `pi-sdk` child sessions have an explicit turn/budget limit or a documented SDK limitation with a safe fallback.
- Child resource boundaries are testable and documented; nested `agent_worker_*` access remains unavailable by default.
- Setup/prompt/final/usage/cancel/timeout outcomes have compact observable summaries and tests.
- Any model/profile option pass-through remains conservative and covered by tests.
- A correlated, reload-safe, versioned runtime protocol exposes start/status/wait/cancel/profile operations through one shared worker manager.
- Plan/Goal/Workers/`pi-sdk` orchestration guidance and the separate Subagents/Agent Teams ownership boundary are documented.
- Direct sub-agent UX and Agent Teams semantics remain outside this package.
- Package tests, package typecheck, pack dry-run, repo typecheck, and load smoke pass before any v0.5.0 release prep.
