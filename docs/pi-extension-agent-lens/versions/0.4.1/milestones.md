# Agent Lens 0.4.1 milestones

## Theme

0.4.1 focuses on report UX polish and metadata-only report-reading workflows on top of the sealed 0.4.0 memory-flow release.

This version should improve how users find, scan, and compare existing local reports without adding raw capture, external services, or a local server.

## Candidate tracker

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-index-sorting-filtering.md` | Multi-trace index sorting/filtering/search. |
| M2 | Done | `m2-report-navigation-density.md` | Per-trace report navigation and density refinements. |
| M3 | Done | `m3-metadata-trace-comparison.md` | Metadata-only trace comparison, accepted via user request to complete all milestones. |

## Sequencing rationale

1. **M1 index first** because users need a better entry point before deeper report workflows matter.
2. **M2 per-trace polish second** because long reports benefit from navigation and density only after users can find the right trace.
3. **M3 comparison third** because comparison depends on stable trace metadata and should be kept optional to avoid bloating a patch release.

## Release criteria

0.4.1 can be sealed when accepted milestones satisfy these criteria:

- accepted milestones are `Done`;
- generated HTML remains static/file-based unless explicitly re-scoped;
- inline JavaScript, if used, is local-only and dependency-free;
- all dynamic HTML is escaped;
- no raw capture is introduced;
- no new package dependencies or frontend build step are added unless explicitly approved;
- package changelog includes 0.4.1 entries;
- automated verification passes;
- manual smoke covers `/agent-lens index`, `/agent-lens report`, and any new controls.

## Deferred beyond 0.4.1 candidates

These require separate product decisions and are not automatically part of 0.4.1:

- Raw capture opt-in implementation.
- Behavior evaluation views and user-authored review labels.
- Automated evaluator/model-judge integration.
- Full replay/eval harness.
- Full session branch tree reconstruction.
- Local server/WebSocket report mode.
- Multi-agent swimlane/race views.
