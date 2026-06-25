# M2 — Swimlane timeline view

## Status

Proposed. Implementation must wait until M1 defines the topology/lane model.

## Motivation

The observable log is powerful but linear. As traces include more tools, provider requests, compactions, and possible worker/teammate activity, users need a time-based view that separates activity into lanes without requiring raw content.

M2 adds a static swimlane timeline to per-trace reports using the M1 model.

## SPEC

### Scope

Add a static/local swimlane timeline section to `/agent-lens report`:

- render lanes based on M1 lane assignment rules;
- expected lanes may include:
  - main agent;
  - worker/teammate agent when safely observable;
  - tools;
  - provider requests;
  - memory/compaction;
  - unknown/unavailable lane when metadata is insufficient;
- render event cards with metadata-only summaries;
- link swimlane cards to observable-log records;
- link related memory-flow/topology records where available;
- preserve existing section navigation, density controls, observable-log filters, and memory-flow links;
- show clear unavailable/missing state when worker/agent metadata is not present.

### Non-goals

- No graph/tree topology explorer; M3 owns that.
- No raw prompt/provider/tool/session content rendering.
- No new metadata capture unless approved by M1.
- No local server, WebSocket, frontend framework, or build step.
- No race-condition diagnosis or correctness scoring.

### Design notes

- The swimlane should be a report-reading aid, not a new source of truth.
- Use M1 confidence labels and lane hints directly.
- Keep cards compact and link-heavy rather than duplicating observable-log detail JSON.
- The view should remain useful in static HTML with minimal local-only JavaScript.
- If JavaScript is used for lane filtering/collapse, the default no-JS view should still show all lane content.

### Expected files

Likely touchpoints, subject to M1 output:

- `packages/pi-extension-agent-lens/src/report.ts`.
- `packages/pi-extension-agent-lens/src/report-topology.ts` or M1 helper module.
- `packages/pi-extension-agent-lens/src/report.test.ts`.
- `packages/pi-extension-agent-lens/src/report-topology.test.ts` if helper behavior changes.
- `packages/pi-extension-agent-lens/README.md`.
- `docs/pi-extension-agent-lens/versions/0.5.0/*` status/log updates.

## AC

Acceptance criteria:

- `/agent-lens report` includes a swimlane timeline section.
- Lane assignment is derived from M1 model output, not ad hoc report logic.
- Swimlane cards link to observable-log records and keep existing anchors stable.
- Worker/teammate lanes appear only when safely observable; otherwise the report shows unavailable/missing metadata rather than guessing.
- Existing memory-flow, report navigation, density controls, and observable-log behavior still work.
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

1. Run `/agent-lens report` on traces with provider/tool/compaction activity.
2. Confirm lanes, cards, links, missing metadata wording, and section navigation work.
3. Confirm no raw private content appears.

## Status tracking

At milestone start:

1. Confirm M1 is `Done` and any metadata-capture decision is resolved.
2. Update `versions/0.5.0/milestones.md` M2 to `In progress`.
3. Append a short start entry to `versions/0.5.0/log.md`.

At milestone completion:

1. Run verification listed above.
2. Update M2 to `Done`.
3. Add completion notes here.
4. Append verification/manual-smoke evidence to `versions/0.5.0/log.md`.
