# API behavior audit v0.2.0 milestone tracker

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M1 Programmatic capture lifecycle | Done | Agents can start, inspect, and stop/finalize live capture recorders without opening browsers or waiting for HITL done | Added capture session registry, `api_audit_start_capture`, `api_audit_stop_capture`, `api_audit_list_active_captures`, shutdown cleanup, tests, README notes, and package file inclusion. Plan: `m1-programmatic-capture-lifecycle.md` |
| M2 Headless automation runner | Done | Agents can run bounded headless/script automation after recorders start, then auto-stop/finalize | Added `api_audit_run_automated_capture`, automation metadata handoff, `headless`/`openBrowser` options, max-duration timeout cleanup, script failure cleanup, review helper tool, tests, README notes, and package file inclusion. `stopOnNetworkIdleMs` is passed through metadata but internal recorder-idle detection remains deferred. Plan: `m2-headless-automation-runner.md` |
| M3 v0.2.0 release prep | Done | Package and seal v0.2.0 docs/changelog/version after lifecycle and automation milestones pass | Bumped package/lockfile to 0.2.0, updated changelog/README/release policy, sealed docs, archived v0.2.0, and passed release verification. No publish/tag. Plan: `m3-release-prep.md` |

## Verification baseline

Each runtime milestone should normally pass:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

M1 must add focused tests for lifecycle state, stop/finalize idempotency, manifest finalization, and no-browser behavior.

M2 must add focused tests for automation script invocation, timeout cleanup, headless/openBrowser option handling, and guaranteed stop in failure paths.
