# Agent Lens 0.5.0 milestones

## Theme

0.5.0 follows **Multi-agent swimlane + topology foundation**.

This version should connect time-based reading and relationship-based reading without claiming full private session reconstruction. It should remain static/local-first and metadata-only by default.

## Candidate tracker

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-safe-topology-model.md` | Safe topology model, evidence inventory, gap analysis, and metadata-capture decision. |
| M2 | Done | `m2-swimlane-timeline.md` | Static report swimlane timeline view using the M1 topology/lane model. |
| M3 | Done | `m3-partial-topology-explorer.md` | Partial topology explorer linking agent/session/tool/provider/memory relationships where safely observable. |

## Sequencing rationale

1. **M1 model first** because swimlane and topology UI need stable entity/relationship/lane contracts.
2. **M2 swimlane second** because users need time-based legibility before graph/tree-style relationship exploration.
3. **M3 topology third** because relationship exploration depends on M1 confidence labels and M2 anchors.

## Release criteria

0.5.0 can be sealed when accepted milestones satisfy these criteria:

- accepted milestones are `Done`;
- any new metadata capture is explicitly approved in M1 and remains redacted/minimal;
- generated HTML remains static/file-based unless explicitly re-scoped;
- inline JavaScript, if used, is local-only and dependency-free;
- all dynamic HTML is escaped;
- no raw capture is introduced;
- no new package dependencies or frontend build step are added unless explicitly approved;
- package changelog includes 0.5.0 entries;
- automated verification passes;
- manual smoke covers `/agent-lens report`, swimlane controls/links, topology controls/links, `/agent-lens index`, and `/agent-lens compare`.

## Deferred beyond 0.5.0 candidates

These require separate product decisions and are not automatically part of 0.5.0:

- Raw capture opt-in implementation.
- Behavior evaluation views and user-authored review labels.
- Automated evaluator/model-judge integration.
- Full replay/eval harness.
- Full session branch tree reconstruction.
- Local server/WebSocket report mode.
- Cross-trace topology comparison.
