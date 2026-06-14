# Agent Lens 0.4.1 plan and spec

## Status

0.4.1 milestone implementation complete. M1/M2/M3 are done after automated verification and user manual smoke; release sealing is still pending.

## Assumptions

- 0.4.1 is based on the sealed `0.4.0` memory-flow release.
- The release remains static-file-first and local-only.
- Existing redacted JSONL trace metadata is the primary data source.
- No raw prompt, provider payload, tool result, or compaction summary content is captured or rendered.
- No local server, WebSocket mode, frontend framework, or new package dependency is introduced unless explicitly re-scoped.

## Product spec

0.4.1 improves report-reading ergonomics for users who have multiple local Agent Lens traces and richer per-trace reports.

The user should be able to:

1. find relevant traces quickly from the multi-trace index;
2. open and scan long per-trace reports with less friction;
3. optionally compare traces at a metadata-only level if M3 is accepted.

## Proposed implementation plan

### Phase 0 — Planning gate

- Confirm whether 0.4.1 includes only M1/M2 or includes optional M3.
- Keep all milestones `Proposed` until work begins.
- Before coding a milestone, update `milestones.md` and `log.md` according to that milestone's status-tracking section.

### Phase 1 — M1 index sorting/filtering/search

Implement first because the index is the entry point for many traces.

Success criteria:

- `/agent-lens index` has local static controls for sorting/filtering/searching trace metadata.
- The active trace is easy to find.
- Missing metadata degrades gracefully.
- Dynamic HTML remains escaped.

Plan doc: `m1-index-sorting-filtering.md`.

### Phase 2 — M2 per-trace navigation/density

Implement after M1 because users should first be able to find the right trace.

Success criteria:

- `/agent-lens report` has clearer section navigation for summary, memory flow, and observable log.
- Long reports are easier to scan without hiding safety wording or confidence labels.
- Existing filters, anchors, backlinks, and expandable details continue to work.

Plan doc: `m2-report-navigation-density.md`.

### Phase 3 — M3 metadata-only trace comparison

Accepted for 0.4.1 by user request to complete all milestones.

Success criteria:

- Users can compare local traces using only metadata.
- The UI links back to source reports where available.
- The comparison avoids correctness/evaluation claims.

Plan doc: `m3-metadata-trace-comparison.md`.

## Verification baseline

Run after any implementation milestone:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should cover the commands changed by the milestone:

- `/agent-lens index` for M1 index-entry flows;
- `/agent-lens report` for M2;
- `/agent-lens compare` for M3;
- no raw private content appears in generated reports.

## Final AC and stop condition

Automated implementation is complete when:

- M1/M2/M3 code and tests are implemented;
- README, changelog, package metadata, and version docs reflect the commands and report UX;
- full verification baseline passes;
- no package version bump, release sealing, or tag is created.

Stop condition for this work session:

- Stop after automated implementation and verification.
- Do not mark 0.4.1 sealed.
- Do not update stable version from `0.4.0`.
- User-run final manual smoke is complete. Next step, if requested, is release/sealing updates.

## Release/sealing checklist

Before declaring 0.4.1 sealed:

1. Accepted milestones are `Done`.
2. `packages/pi-extension-agent-lens/CHANGELOG.md` includes 0.4.1 notes.
3. Package version metadata is updated only if release work is explicitly requested.
4. Full verification baseline passes.
5. Manual smoke evidence is recorded in `versions/0.4.1/log.md`.
6. Root `index.md`, `roadmap.md`, `archive.md`, and `log.md` are updated for the sealed release.
