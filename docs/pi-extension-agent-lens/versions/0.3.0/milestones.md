# Agent Lens 0.3.0 milestones

## Candidate tracker

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-report-navigation.md` | Observable log UI: typed chips/tags, filters, grouping, expandable records. |
| M2 | Done | `m2-trace-summary-cards.md` | Add high-signal summary cards for model/context/tools/compaction. |
| M3 | Done | `m3-session-compaction-explorer.md` | Session/compaction explorer foundation from existing redacted metadata. |

## Sequencing rationale

1. **M1 observable log UI first** because it improves the core daily artifact users already open and creates the visual language: event classes, chips, tags, filters, and expandable details.
2. **M2 summary cards second** because better event classification creates stable data for high-signal summaries.
3. **M3 session/compaction explorer third** because it can reuse M1's visual primitives and M2's summary extraction while moving toward the C direction.

## Release criteria

0.3.0 was sealed after these criteria were satisfied:

- accepted milestones are `Done`;
- generated HTML remains static/file-based unless explicitly re-scoped;
- inline JavaScript, if used, is local-only and dependency-free;
- all dynamic HTML is escaped;
- no raw capture is introduced;
- package changelog includes 0.3.0 entries;
- automated verification passes;
- manual smoke covers `/agent-lens report`, event filters/chips, expandable details, `/agent-lens index`, and any new session/compaction view.

## Deferred beyond 0.3.0 candidates

- Raw capture opt-in implementation.
- Local server/WebSocket report mode.
- Metadata-only trace comparison.
- Full behavior eval/replay views.
- Multi-agent swimlane/race views.
