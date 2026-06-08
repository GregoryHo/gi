# Changelog

## 0.3.0 - 2026-06-07

- Add observable log rendering to single-trace HTML reports.
- Add report event classification with categories, labels, chips, summaries, and search text.
- Add local inline-JavaScript report controls for category filters, metadata search, and expand/collapse all.
- Preserve static file-based reports and redacted-only capture behavior.
- Add trace summary cards for records/runs/turns, provider requests/models, context size, tool names, compactions/tokens, and time range.
- Add session/compaction explorer section with preparation/result metadata and nearby before/after context snapshots.
- Redact raw-like `text` and `content` fields from report-rendered detail JSON as a defensive safety measure.
- Reduce observable-log chip noise by moving run/turn identifiers into row metadata and keeping chips for high-signal attributes only.

## 0.2.0 - 2026-06-07

- Add project-local config loading from `.pi-agent-lens/config.json`.
- Add configurable artifact root and live report refresh interval.
- Add retention config groundwork for future cleanup commands.
- Add config source, capture profile, and config warning visibility to `/agent-lens` status.
- Preserve safe redacted-only capture; unsupported capture profiles fall back to `redacted` with a warning.
- Add trace size and modified-time metadata to `/agent-lens traces`.
- Add explicit retention cleanup commands: `/agent-lens clean --dry-run` and `/agent-lens clean --confirm`.
- Protect the active trace and active report from cleanup deletion.
- Add `/agent-lens index` command and `.pi-agent-lens/index.html` multi-trace index report.

## 0.1.0 - 2026-06-07

- Initial package scaffold and planning docs.
- Add read-only JSONL lifecycle tracing for agent runs, turns, context snapshots, provider payload shape, and compaction events.
- Add redacted summarizers and `/agent-lens` status command.
- Add provider payload shape summaries for Responses API `instructions` and `input` fields.
- Add local live-updating HTML report rendering and `/agent-lens report` command.
- Add report source metadata and `.pi-agent-lens/latest.html` alias for the most recently generated live report.
- Add `/agent-lens traces` command for listing local trace files with counts and last event metadata, marking the current active trace.
- Report command notifications now include both the timestamped report path and `.pi-agent-lens/latest.html`; live report rewrite errors are captured as status errors instead of surfacing as unhandled rejections.
- Include provider `model` metadata in redacted provider payload summaries.
- `/agent-lens` status now shows whether live report updates are enabled and where `latest.html` is located.
