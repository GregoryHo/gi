# M3 — Metadata-only trace comparison

## Status

Done. M3 was accepted by the user request to complete all milestones.

## Motivation

After users can find traces in the index and read individual reports comfortably, the next report-reading workflow may be comparing two or more traces at a metadata level:

- Did context size change between runs?
- Which models or tool counts differ?
- Which traces include compaction or memory-flow groups?
- Which run produced more provider requests or tool activity?

M3 explores a small metadata-only comparison view without raw content, evaluator scoring, or replay.

## SPEC

### Scope

Add a static comparison workflow for selected traces, using metadata already available from trace files and report summary builders:

- compare high-level trace metadata such as record count, size, modified time, event categories, model names, provider request counts, tool names/counts, context message counts, and compaction counts;
- show differences as counts, presence/absence, and small tables rather than charts requiring dependencies;
- link comparison rows back to per-trace reports where available;
- clearly label missing or unavailable metadata;
- preserve redaction and metadata-only safety wording.

### Non-goals

- No raw prompt/provider/tool/summary content display.
- No model-judge, scoring, pass/fail evaluation, or replay harness.
- No semantic diff of private content.
- No server/database or browser-upload workflow.
- No automatic claim that one trace is "better" than another.
- No full session branch reconstruction.

### Design notes

- Prefer generating comparison from `/agent-lens index` data or a simple static comparison report command only if command design is approved.
- If command surface is needed, decide before implementation whether it is `/agent-lens compare` or an index-report selection flow.
- Keep comparison dimensions explainable and derived from existing redacted summaries.
- Treat missing metadata as normal for older traces.

### Expected files

Likely touchpoints, subject to command-surface decision:

- `packages/pi-extension-agent-lens/src/index.ts` for command registration if a command is added.
- `packages/pi-extension-agent-lens/src/report.ts` or current report/index renderer module.
- `packages/pi-extension-agent-lens/src/report.test.ts` or current tests.
- `packages/pi-extension-agent-lens/README.md`.
- `docs/pi-extension-agent-lens/versions/0.4.1/*` status/log updates.

## AC

Acceptance criteria if M3 is accepted:

- Users can compare selected traces using only local metadata.
- Comparison output links to source per-trace reports where possible.
- Missing fields are labeled without breaking generation.
- The UI avoids evaluative language and does not imply behavioral correctness.
- No raw private content, new capture hooks, network calls, server mode, or evaluator integration are introduced.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke:

1. Compare at least two traces with different metadata shapes.
2. Confirm differences and missing fields are understandable.
3. Confirm source report links work where reports exist.
4. Confirm no raw private content appears and no correctness judgment is implied.

## Completion notes

- Added `/agent-lens compare` to generate `.pi-agent-lens/compare.html`.
- Added a metadata-only comparison report over local traces using existing redacted trace summaries.
- Comparison rows include source trace, report link where available, record/run/turn/provider counts, models, context counts, tool names, compaction counts, max compaction tokens, file size, and modified time.
- Missing metadata is rendered as `missing`.
- The report includes safety wording that no raw prompt/provider/tool/summary content is rendered and no correctness or quality judgment is implied.
- No new capture hooks, network calls, server mode, evaluator integration, or package dependencies were introduced.

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

1. Confirm M3 is accepted for 0.4.1 rather than deferred.
2. Update `versions/0.4.1/milestones.md` M3 to `In progress`.
3. Append a short start entry to `versions/0.4.1/log.md`.

At milestone completion:

1. Run verification listed above.
2. Update M3 to `Done`.
3. Add completion notes here.
4. Append verification/manual-smoke evidence to `versions/0.4.1/log.md`.
