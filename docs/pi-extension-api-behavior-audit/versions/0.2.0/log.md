# API behavior audit v0.2.0 log

Append-only version planning and implementation history.

## 2026-06-01

- Started v0.2.0 planning on branch `feature/api-behavior-audit-0.2.0-programmatic-capture`.
- Product direction: add programmatic capture lifecycle tools so a pi agent can start recorders, run or delegate automation, and stop/finalize artifacts without requiring a human done confirmation for safe read-only flows.
- Initial milestone split: M1 live capture session lifecycle; M2 bounded headless automation runner; M3 release prep.
- Started v0.2.0 M1 programmatic capture lifecycle. Scope is limited to start/list/stop live upstream recorder sessions without browsers or automation.
- Completed v0.2.0 M1. Added `CaptureSessionRegistry`, `api_audit_start_capture`, `api_audit_stop_capture`, `api_audit_list_active_captures`, package inclusion, README notes, and extension shutdown cleanup. Verification passed: package test, package typecheck, package pack dry run, and root typecheck. Additional local-upstream smoke recorded and validated one old and one new exchange for `capture-smoke`.
- Started v0.2.0 M2 headless automation runner. Scope is bounded script automation on top of M1 lifecycle with guaranteed stop/finalize cleanup.
- Completed v0.2.0 M2. Added `runAutomatedCapture` and `api_audit_run_automated_capture` with metadata handoff, `automationScript`, `headless`, `openBrowser: false`, `maxDurationMs` timeout cleanup, script failure cleanup, review helper tool, tests, README notes, and package inclusion. `api_audit_review_capture` can queue supported `/api-discovery-*` slash-command review steps and points users to `.pi-api-audit-runs/review.html` with a `python3` command using the package's absolute bundled viewer-builder path and workspace scenario dictionary SOT path. `stopOnNetworkIdleMs` is preserved as script metadata; internal recorder-idle detection is deferred. Verification passed: package test, package typecheck, package pack dry run, and root typecheck. Additional real-script smoke recorded and validated one old and one new exchange for `capture-auto-smoke`.
- Started v0.2.0 M3 release prep. Scope is package version/changelog, docs sealing, archive/index updates, and release verification; no publish or tag.
- Completed and sealed v0.2.0 local package release. Package version/lockfile/changelog updated to `0.2.0`, README and release policy updated, root/version docs archived and sealed, and verification passed: package version check, package test, package typecheck, package pack dry run, and root typecheck. No publish or tag was created.
