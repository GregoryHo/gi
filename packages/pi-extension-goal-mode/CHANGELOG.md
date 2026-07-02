# Changelog

## Unreleased

- Implemented M3 Tool-based Plan → Goal Integration with `goal_start`, optional `sourcePlan` context, compact source-plan prompt injection, and coordination with Plan Mode `plan_get_current`.
- Implemented M2 Goal Control Plane with `/goal-pause`, `/goal-resume`, cancel semantics for `/goal-stop`, run-token validation for queued follow-ups, clearer status guidance, paused/terminal `goal_report` handling, and runnable-only safety gates.
- Implemented M1 bounded main-session goal loop with `/goal`, `/goal-status`, `/goal-stop`, `/goal-step`, `goal_report`, loop continuation, safety gates, verification policy, UI status, and session restore.
- Scaffolded `@gregho/pi-extension-goal-mode` package with docs-backed M1 planning.
