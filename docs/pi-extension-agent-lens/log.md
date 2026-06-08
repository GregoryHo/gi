# Agent Lens log

## 2026-06-07

- Selected product name `Agent Lens` and package name `pi-extension-agent-lens`.
- Product direction: broader agent observability, not only context tracing.
- Safety default: read-only behavior, local artifacts, redacted/truncated capture by default, raw payload capture opt-in only.
- Created initial scaffold and M1 planning docs.
- Started M1 implementation for read-only JSONL event tracing.
- Completed M1 implementation: added read-only event observers, safe JSONL trace recorder, redacted summarizers, and `/agent-lens` status command. Verification: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck` passed.
- Improved M1 provider payload summaries after manual trace review: Responses API-style payloads now report `instructionsLength`, `inputCount`, `inputRoles`, and `inputJsonChars` without storing raw input/instructions.
- Started M2 implementation for local HTML report rendering over Agent Lens JSONL traces.
- Completed M2 implementation: added local HTML report rendering, `/agent-lens report`, dynamic HTML escaping, and report generation tests. Verification: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck` passed.
- Updated M2 report behavior based on manual UX feedback: `/agent-lens report` now creates a live-updating file-based report that is rewritten after later trace events and auto-refreshes in the browser.
- Added report source trace metadata and `.pi-agent-lens/latest.html` alias so users can identify the active report without relying on timestamped filenames.
- Added `/agent-lens traces` command for listing local trace files with record counts and last event metadata, marking the current active trace.
- Improved `/agent-lens report` notification by showing both timestamped and latest report paths; live report rewrite errors are now captured in status instead of becoming unhandled rejections.
- Added provider `model` metadata to redacted provider payload summaries.
- Updated `/agent-lens` status to report live-report state and latest report path.
- Sealed v0.1.0 MVP docs after user manual smoke testing. Current stable version is `0.1.0`; no active planning version remains.
- Opened active 0.2.0 planning under `versions/0.2.0/` after user approval. Theme: operationalization via config profiles, retention/cleanup, and multi-trace index report.
- Sealed v0.2.0 after M1/M2/M3 completion, automated verification, and user manual acceptance. Current stable version is `0.2.0`; no active planning version remains.
- Opened active 0.3.0 planning under `versions/0.3.0/`. Candidate theme: report legibility and trace analysis.
- Sealed v0.3.0 after M1/M2/M3 completion, automated verification, and user manual acceptance. Current stable version is `0.3.0`; no active planning version remains.
