# Agent Lens milestones

## 0.1.0 MVP — sealed

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-read-only-event-trace.md` | Package scaffold plus read-only JSONL lifecycle trace with safe redaction defaults. |
| M2 | Done | `m2-html-report.md` | Local live-updating HTML report renderer over M1 trace artifacts. |

## Status notes

- 2026-06-07: Product name selected as Agent Lens and initial scaffold/planning started.
- 2026-06-07: M1 completed with read-only JSONL trace capture, redacted summaries, and `/agent-lens` status command.
- 2026-06-07: M2 completed with local live-updating HTML report rendering via `/agent-lens report`.
- 2026-06-07: v0.1.0 MVP sealed in docs after automated verification and user manual smoke testing.

## Deferred candidates

Deferred work should be discussed and planned under a future `versions/<semver>/` directory before implementation.

Initial candidates:

- Config profiles for redaction, retention, and explicit raw capture.
- Multi-trace dashboard or comparison views.
- Richer visual charts and timeline filtering.
- Session tree / branch memory explorer.
