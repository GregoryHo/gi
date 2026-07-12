# Changelog

## Unreleased

### Changed

- Unified command/tool cancellation around matching Goal iteration tokens so cancellation aborts active Goal work without interrupting unrelated busy turns.
- Expanded bounded goal status text with acceptance criteria, elapsed limit, and latest report summary.
- Added autocomplete-backed `/goal` lifecycle subcommands while retaining `/goal-status`, `/goal-pause`, `/goal-resume`, `/goal-stop`, and `/goal-step` compatibility aliases.

- Hardened blocked lifecycle handling: paused/blocked goals reject `goal_report` until resumed, and both tool and slash-command resume paths reject exhausted objective limits.
- Centralized objective-limit checks, exposed cancel-only next actions for limit-exhausted goals, and kept max elapsed time anchored to the original objective start.
- Improved TUI feedback with compact blocked reasons and a single explicit notification when a goal reaches done.
- Implemented M4 Worker-assisted goal loops with explicit `goal_start.workerDelegation`, worker delegation state persistence/status exposure, compact `[WORKER DELEGATION]` active context, profile validation, and guidance for safe `agent_worker_*` composition without importing Agent Workers internals.
- Implemented M3 Tool-based Plan → Goal Integration with `goal_start`, optional `sourcePlan` context, compact source-plan prompt injection, and coordination with Plan Mode `plan_get_current`.
- Implemented M2 Goal Control Plane with `/goal-pause`, `/goal-resume`, cancel semantics for `/goal-stop`, run-token validation for queued follow-ups, clearer status guidance, paused/terminal `goal_report` handling, and runnable-only safety gates.
- Implemented M1 bounded main-session goal loop with `/goal`, `/goal-status`, `/goal-stop`, `/goal-step`, `goal_report`, loop continuation, safety gates, verification policy, UI status, and session restore.
- Scaffolded `@gregho/pi-extension-goal-mode` package with docs-backed M1 planning.
