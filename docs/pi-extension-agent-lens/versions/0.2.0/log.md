# Agent Lens 0.2.0 log

## 2026-06-07

- Opened 0.2.0 planning after 0.1.0 release cleanup and user approval.
- Approved theme: operationalization for longer-running local use.
- Approved candidate milestones: config profiles, retention/cleanup, and multi-trace index report.
- Implementation not started; all milestones remain Proposed until explicitly started.
- Started M1 config profiles and status visibility implementation.
- Completed M1 implementation: added `.pi-agent-lens/config.json` loading, configurable artifact root, configurable live report refresh interval, retention config groundwork, redacted-only capture profile validation, and `/agent-lens` status visibility for config source/profile/warnings. Verification passed with package tests, package typecheck, pack dry-run, and root typecheck.
- Started M2 retention metadata and explicit cleanup commands implementation.
- Completed M2 implementation: trace summaries now include size/modified metadata, cleanup dry-run and confirm commands use configured retention, adjacent trace reports are selected with deleted traces, and active trace/report files are protected. Verification passed with package tests, package typecheck, pack dry-run, and root typecheck.
- Started M3 multi-trace index report implementation.
- Completed M3 implementation: added `/agent-lens index`, `.pi-agent-lens/index.html`, escaped multi-trace index rendering, active trace marker, and links to per-trace reports when present. Verification passed with package tests, package typecheck, pack dry-run, and root typecheck.
- User completed manual acceptance for 0.2.0.
- Sealed 0.2.0 release docs and bumped package version to `0.2.0`.
