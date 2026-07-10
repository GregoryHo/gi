# Agent workers v0.5.0 milestones

| Milestone | Status | Goal | Notes |
| --- | --- | --- | --- |
| M1 Pi SDK hardening and boundary tests | Proposed | Harden the v0.4.0 `pi-sdk` adapter without expanding into a broad sub-agent platform | Plan: `m1-pi-sdk-hardening.md` |

## Completion criteria

- `pi-sdk` child sessions have an explicit turn/budget limit or a documented SDK limitation with a safe fallback.
- Child resource boundaries are testable and documented; nested `agent_worker_*` access remains unavailable by default.
- Setup/prompt/final/usage/cancel/timeout outcomes have compact observable summaries and tests.
- Any model/profile option pass-through remains conservative and covered by tests.
- Plan/Goal/Workers/`pi-sdk` orchestration guidance is documented.
- Deferred advanced features remain explicitly out of scope.
- Package tests, package typecheck, pack dry-run, repo typecheck, and load smoke pass before any v0.5.0 release prep.
