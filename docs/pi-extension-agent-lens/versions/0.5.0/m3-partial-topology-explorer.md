# M3 — Partial topology explorer

## Status

Proposed. Implementation must wait until M1 is complete and should reuse M2 anchors where possible.

## Motivation

Swimlanes help users read time. Topology helps users read relationships.

M3 adds a partial topology explorer that links agent/session/tool/provider/memory relationships where they are safely observable, while making missing and inferred relationships explicit.

## SPEC

### Scope

Add a static/local topology explorer section to `/agent-lens report`:

- render topology nodes from the M1 model;
- render relationship edges/groups with confidence labels;
- link topology nodes/edges to swimlane cards and observable-log records where available;
- include safety wording that this is a partial metadata-only topology, not full session reconstruction;
- expose missing/unavailable relationship information clearly;
- preserve existing memory-flow explorer and avoid duplicating it unless the topology model links to it.

Candidate topology areas:

- trace → runs/turns;
- run/turn → provider requests;
- run/turn → tool activity;
- compaction preparation/result → context before/after/provider after;
- observed parent/child agent or worker relationships if M1 finds safe metadata;
- session/branch markers where safely observable.

### Non-goals

- No full session branch tree reconstruction.
- No raw content rendering.
- No semantic diff/eval/replay.
- No cross-trace topology comparison.
- No local server/WebSocket mode.
- No behavior correctness or race-condition diagnosis.

### Design notes

- Topology should prefer conservative language: observed, inferred, unavailable.
- Do not imply causality from event order alone without an inferred label.
- Use text/table/card topology if that is simpler than a diagram; avoid framework/build-step scope creep.
- If a visual graph is added, it must be static/local and dependency-free unless explicitly re-scoped.
- Existing memory-flow relationships should either be reused or cross-linked rather than reimplemented inconsistently.

### Expected files

Likely touchpoints, subject to M1/M2 output:

- `packages/pi-extension-agent-lens/src/report.ts`.
- `packages/pi-extension-agent-lens/src/report-topology.ts` or M1 helper module.
- `packages/pi-extension-agent-lens/src/report.test.ts`.
- `packages/pi-extension-agent-lens/src/report-topology.test.ts` if helper behavior changes.
- `packages/pi-extension-agent-lens/README.md`.
- `docs/pi-extension-agent-lens/versions/0.5.0/*` status/log updates.

## AC

Acceptance criteria:

- `/agent-lens report` includes a partial topology explorer.
- Topology nodes/relationships are generated from the M1 model.
- Confidence labels are visible for observed/inferred/missing relationships.
- Nodes/relationships link to observable-log records and swimlane cards where available.
- Safety wording prevents full-reconstruction claims.
- Existing memory-flow explorer, swimlane timeline, observable log, index report, and compare report remain functional.
- All dynamic HTML is escaped.
- No raw capture, network calls, server mode, or new dependencies are introduced.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke:

1. Run `/agent-lens report` on traces with context/provider/tool/compaction activity.
2. Confirm topology explorer labels observed/inferred/missing relationships clearly.
3. Confirm topology links to swimlane and observable-log records.
4. Confirm no raw private content appears and no full session reconstruction is implied.

## Status tracking

At milestone start:

1. Confirm M1 is `Done` and M2 anchors are available or explicitly not needed.
2. Update `versions/0.5.0/milestones.md` M3 to `In progress`.
3. Append a short start entry to `versions/0.5.0/log.md`.

At milestone completion:

1. Run verification listed above.
2. Update M3 to `Done`.
3. Add completion notes here.
4. Append verification/manual-smoke evidence to `versions/0.5.0/log.md`.
