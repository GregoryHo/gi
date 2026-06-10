# M3 — Memory explorer integration and release-shape review

## Status

Done. Automated verification passed and user approved manual smoke on 2026-06-09.

## Motivation

M1 defined the safe memory-flow model and M2 added targeted static report navigation. Because M2 intentionally implemented a narrow M1/M2 overlap in the existing session/compaction explorer, M3 should make the final 0.4.0 experience cohesive before release prep.

M3 is not a new feature expansion milestone. It should polish the combined memory-flow reading experience, reconcile docs/status, and verify the report against a real compaction trace.

## Scope

M3 includes:

- Rename/frame the report section as a memory-flow explorer rather than a generic compaction explorer.
- Add concise partial-view/safety wording near memory flows so inferred relationships are not overpromised.
- Ensure each flow reads as:
  - what stayed recent;
  - what became summary metadata;
  - what the next observed provider request likely saw.
- Tighten tests around the helper contract introduced during M2:
  - record indexes;
  - confidence labels;
  - provider-after linking;
  - missing segment behavior;
  - raw-content redaction safety.
- Reconcile M1 status as completed/subsumed by the implemented helper contract if acceptance criteria are met.
- Keep M2 status done and preserve all M2 anchors/backlinks.
- Run release-candidate verification and document manual smoke results.

## Non-goals

- New trace capture hooks.
- Raw prompt/provider/session/tool/summary rendering.
- Session-file reading.
- Full branch tree reconstruction.
- Behavior evaluation or model judging.
- Generic report polish unrelated to memory flow.
- Local server, websocket, frontend framework, build step, browser storage, or network behavior.

## Design notes

The current implementation uses `buildCompactionExplorer` as the memory-flow helper. M3 may keep that name internally to avoid churn, but user-facing report copy should say `Memory flow explorer`.

Preferred wording:

- `Partial metadata-only view`.
- `nearest context before compaction`.
- `first kept entry boundary`.
- `messages summarized by metadata`.
- `next observed provider request after compaction`.
- `inferred from event order`.

Avoid wording like:

- `the model forgot`;
- `these exact messages were removed`;
- `this provider request definitely used this context`.

## Expected files

Likely implementation touches:

- `packages/pi-extension-agent-lens/src/report.ts`
- `packages/pi-extension-agent-lens/src/report-compaction.test.ts`
- `packages/pi-extension-agent-lens/src/report.test.ts`
- `docs/pi-extension-agent-lens/versions/0.4.0/m1-session-memory-explorer.md`
- `docs/pi-extension-agent-lens/versions/0.4.0/milestones.md`
- `docs/pi-extension-agent-lens/versions/0.4.0/log.md`

## Acceptance criteria

M3 is complete when:

- The report presents memory flows as a cohesive memory-flow explorer with clear partial-view wording.
- The explorer explicitly distinguishes observed, nearby observed, inferred, and missing relationships.
- The report shows safe metadata for what stayed recent, what became summary metadata, and what the next observed provider request likely saw.
- M2 static anchors/backlinks/highlighting still work.
- Tests cover helper-level provider-after linking, confidence labels, record indexes, missing data, and no raw summary leakage.
- M1 status/docs are reconciled with the implemented helper contract.
- No new raw capture, mutation, storage, dependency, build step, server, or network behavior is introduced.
- Automated verification passes.
- Manual smoke evidence is recorded for a real compaction trace or explicitly noted as blocked/unavailable.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke:

1. Load the extension with `pi -e ./packages/pi-extension-agent-lens`.
2. Use or generate a compaction-heavy trace.
3. Run `/agent-lens report`.
4. Confirm the memory-flow explorer can be read without raw private content and without implying full session reconstruction.
5. Confirm links between memory-flow cards and observable-log records still work.

## Status tracking

At M3 start:

1. Add this plan.
2. Update `versions/0.4.0/milestones.md` so `M3` is `In progress`.
3. Append a short start entry to `versions/0.4.0/log.md`.

At M3 completion:

1. Run the verification commands above.
2. Record manual smoke outcome.
3. Update M1/M3 milestone statuses as appropriate.
4. Append verification evidence to `versions/0.4.0/log.md`.
