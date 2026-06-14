# M2 — Report navigation and density refinements

## Status

Done.

## Motivation

0.3.0 and 0.4.0 made per-trace reports much richer. Long traces now contain summary cards, memory-flow cards, and detailed observable-log rows. Users need better navigation and reading-density controls without turning the report into a complex app.

M2 adds small static-report UX refinements that make long per-trace reports easier to scan.

## SPEC

### Scope

Improve per-trace report reading with minimal local-only UI primitives:

- clearer section navigation between summary, memory flow, and observable log;
- compact jump links for important records or sections;
- optional collapse/expand affordances for bulky sections where the default remains readable;
- density refinements for long observable-log rows and memory-flow cards;
- visible counts that help users understand filtered/visible records;
- keyboard- and no-JavaScript-friendly markup where practical.

### Non-goals

- No frontend framework or build step.
- No browser persistence by default.
- No raw prompt/provider/tool content rendering.
- No new event capture solely for UI polish.
- No index sorting/filtering work; M1 owns that.
- No trace comparison; M3 owns that if accepted.

### Design notes

- Keep controls close to the existing static report visual language.
- Prefer progressive enhancement: report content should remain visible and navigable if JavaScript is disabled.
- Use deterministic anchors introduced by 0.4.0 where possible.
- Avoid adding controls that compete with existing observable-log filters/search.
- Density changes should reduce scrolling without hiding safety context or confidence labels.

### Expected files

Likely touchpoints, subject to implementation discovery:

- `packages/pi-extension-agent-lens/src/report.ts` or current per-trace report renderer module.
- `packages/pi-extension-agent-lens/src/report.test.ts` or current report tests.
- `packages/pi-extension-agent-lens/README.md`.
- `docs/pi-extension-agent-lens/versions/0.4.1/*` status/log updates.

## AC

Acceptance criteria:

- `/agent-lens report` generates a per-trace report with clearer section navigation.
- Long memory-flow and observable-log areas are easier to scan without losing safety wording or confidence labels.
- Existing filters/search/expand behavior still works.
- Static anchors and links remain stable.
- Report works as a local file with no network calls and no external assets.
- All dynamic HTML remains escaped.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke:

1. Run `/agent-lens report` on a trace with compaction/memory-flow records and a long observable log.
2. Confirm section navigation, links, filters/search, expandable details, and density refinements work.
3. Confirm safety wording and confidence labels remain visible.
4. Confirm no raw private content appears.

## Completion notes

- Added top-level per-trace report section navigation for event counts, trace summary, memory flow, observable log, and detail sections.
- Added stable section IDs for direct navigation.
- Added observable-log visible count metadata that updates with existing filters/search.
- Added local density controls for comfortable/compact report reading.
- Preserved existing observable-log filters/search, expandable details, memory-flow links/backlinks, safety wording, confidence labels, and static-file behavior.

Automated verification completed on 2026-06-14:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Final manual smoke completed by user on 2026-06-14.

## Status tracking

At milestone start:

1. Update `versions/0.4.1/milestones.md` M2 to `In progress`.
2. Append a short start entry to `versions/0.4.1/log.md`.

At milestone completion:

1. Run verification listed above.
2. Update M2 to `Done`.
3. Add completion notes here.
4. Append verification/manual-smoke evidence to `versions/0.4.1/log.md`.
