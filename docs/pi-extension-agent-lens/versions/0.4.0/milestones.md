# Agent Lens 0.4.0 milestones

## Chosen theme

0.4.0 follows **Track C — Memory-explorer UX bridge**.

The release should not become a full session tree, a generic report polish release, or a behavior evaluation product. It should make memory/session/compaction flow legible by adding the minimum report UX needed to read that flow well.

Generic report UX improvements not required for memory-flow reading are deferred to `../0.4.1/index.md`.

## Delivered tracker

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-session-memory-explorer.md` | Implemented safe memory-flow grouping through `buildCompactionExplorer`: context before, compaction preparation/result, context/provider after, observed vs inferred relationships. |
| M2 | Done | `m2-richer-report-ux.md` | Implemented targeted memory report UX: static memory-flow/record anchors, related-log links/backlinks, role highlights, provider-after card, and summary-card entry link. |
| M3 | Done | `m3-memory-explorer-integration.md` | Integrated M1/M2 into a cohesive memory-flow explorer, reconciled M1 status, and completed manual smoke approval. |

## Sequencing rationale

1. **M1 memory model first** because UX links and cards need stable relationships to point at.
2. **M2 targeted UX second** because only memory-relevant navigation should be implemented in 0.4.0.
3. **M3 integration third** because the final product value is the combined memory-flow reading experience.

## Release criteria

0.4.0 was sealed after these criteria were satisfied:

- accepted milestones are `Done`;
- memory-flow relationships distinguish observed facts from inferred relationships;
- report UX changes directly support memory/session/compaction reading;
- generated reports remain local/static unless explicitly re-scoped;
- no raw capture is introduced by default;
- no browser-side state was introduced;
- package changelog includes 0.4.0 entries;
- automated verification passes;
- manual smoke confirmed the memory flow is useful without exposing raw private content.

## Deferred to 0.4.1 candidates

See `../0.4.1/index.md`.

0.4.1 candidates include:

- Generic static report UX polish not required for 0.4.0 memory-flow reading.
- Index report sorting/filtering improvements.
- Additional density controls if 0.4.0's compact memory view proves useful.
- Section navigation refinements after real 0.4.0 report usage.
- Metadata-only trace comparison if it becomes the next most valuable report-reading workflow.

## Still deferred beyond automatic 0.4.1 scope

These require separate product decisions:

- Explicit raw capture opt-in implementation.
- Behavior evaluation views and user-authored review labels.
- Automated evaluator/model-judge integration.
- Full replay/eval harness.
- Session branch tree reconstruction if pi metadata is insufficient for a safe partial view.
- Local server/WebSocket report mode.
