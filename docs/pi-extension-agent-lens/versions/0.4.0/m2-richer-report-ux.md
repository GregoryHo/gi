# M2 — Targeted memory report UX

## Status

Done. Automated verification passed and user approved manual smoke on 2026-06-09.

## Motivation

0.3.0 made the single-trace report much more readable with observable-log rows, filters, search, summary cards, and a session/compaction explorer. For 0.4.0, report UX work is intentionally narrowed to memory/session/compaction reading.

M2 should add only the report navigation primitives needed to make M1's memory-flow model readable in a static local HTML file.

## UX principle

Every M2 UI change must answer yes to this question:

> Does this make memory/session/compaction flow easier to understand?

If not, defer it to `../0.4.1/index.md`.

## Accepted scope

- Add stable HTML anchors for memory-flow groups and related log records.
- Link memory-flow cards to related observable-log records.
- Link related observable-log records back to their memory-flow group with a quiet visible link/chip.
- Highlight before/after/preparation/result/provider-after records around compaction.
- Add a summary-card link to the first memory-flow group only when memory-flow groups exist.
- Keep compact reading to static CSS layout improvements; defer a user-facing density toggle unless M3/manual smoke proves it is needed.
- Preserve no-dependency, no-build, no-server report generation unless explicitly re-scoped.

Generic report polish, broad index filtering, and UX refinements unrelated to memory-flow reading are deferred to 0.4.1.

## Proposed anchor model

Use deterministic static anchors so links work without JavaScript:

```text
#memory-flow-<n>
#memory-flow-<n>-before-context
#memory-flow-<n>-preparation
#memory-flow-<n>-result
#memory-flow-<n>-after-context
#memory-flow-<n>-provider-after
#record-<record-index-1-based>
```

Rules:

- `record-<n>` maps to observable-log row number `n`.
- `memory-flow-<n>` maps to rendered memory-flow group number `n`.
- Helper/model code may use zero-based record indexes internally, but rendered anchors and user-visible labels are one-based.
- Missing segments still render a card with no record link and clear `Missing` state.
- Anchors should be HTML-escaped where dynamic values are involved, though generated IDs should be deterministic and internal.

## Related-record linking

M1 memory-flow groups should expose related record indexes for each segment:

- before context record index;
- preparation record index;
- result record index;
- after context record index;
- provider-after record index.

M2 should render:

- `View record #N` links from memory-flow cards to observable-log rows.
- `View memory flow #M` backlink chips/links on related observable-log rows.
- Cautious labels such as `nearest context before`, `compaction result`, and `next observed provider request`.

## Highlighting model

Related log rows can receive extra classes/data attributes:

```text
data-memory-flow="1"
data-memory-role="before-context|preparation|result|after-context|provider-after"
```

Possible CSS-only highlighting:

- before context: cool/blue border accent;
- preparation/result: warm/orange border accent;
- after context/provider-after: green/teal border accent;
- inferred relationships: dashed border or muted label.

No dynamic state is required for M2. If JavaScript is used, it should only improve local navigation, e.g. focus/open related `<details>` after clicking an anchor.

## Minimal JavaScript boundary

Allowed if needed:

- local-only scroll/focus helper;
- optional open-details-on-anchor behavior;
- no network;
- no dependencies;
- no browser storage by default.

Deferred to 0.4.1 unless explicitly needed for M2:

- persistent density settings;
- localStorage;
- complex keyboard navigation;
- sortable/filterable index improvements.

## Candidate display

### Memory flow section

Each flow card can show:

- segment name;
- confidence label from M1;
- safe metadata summary;
- `View record #N` link when a source record exists.

### Observable log rows

Related rows can show:

- `memory:flow-1` chip/link or a less noisy `Memory flow #1` link;
- memory role label where useful;
- optional subtle highlight.

### Summary cards

The existing compaction summary card can link to the first memory-flow group when M1 produced memory flows:

- `Compactions: 2` → `#memory-flow-1`.

This is useful only if it stays visually quiet and remains absent when there are no memory-flow groups.

## Relationship to M1

M2 depends on M1 exposing enough structured data for links and confidence labels. M2 should not duplicate memory-flow grouping logic in the renderer.

Expected M1/M2 boundary:

- M1 helper returns memory-flow groups with record indexes and confidence labels.
- M1 owns grouping decisions, including which context/provider records are observed, nearby observed, inferred, or missing.
- M2 renderer turns those groups into anchors, links, and highlights.

## Planning decisions

Resolved follow-up decisions:

1. Related log rows should show a quiet visible backlink (`Memory flow #M`) plus a role label. Highlighting alone is too easy to miss after a jump.
2. Static anchors are required. Tiny JavaScript to open/focus linked `<details>` is optional progressive enhancement only, with no storage and no network.
3. Do not ship a user-facing compact/density toggle in M2. Use static card/grid CSS that reads better for long traces; revisit controls in M3 or 0.4.1 after manual smoke.
4. Summary-card links should point to memory flow only when M1 produced at least one memory-flow group.
5. Include provider-after links when M1 marks them `inferred`, but label them as `next observed provider request` and never as guaranteed causal reconstruction.

## Implementation plan

1. **Consume M1 model**
   - Use the M1 memory-flow helper output as the only source for memory-flow group/segment relationships.
   - Treat absent groups as a no-op for M2 UX additions.

2. **Add anchors and links**
   - Give observable-log rows deterministic `id="record-N"` anchors.
   - Give memory-flow groups and segments deterministic `id="memory-flow-N..."` anchors.
   - Render `View record #N` links on memory-flow segment cards when a source record exists.

3. **Add observable-log backlinks/highlights**
   - Build a renderer-side lookup from record index to memory-flow metadata.
   - Add `data-memory-flow`, `data-memory-role`, and CSS classes to related rows.
   - Render a quiet `Memory flow #N` backlink and role/confidence label on related rows.

4. **Wire summary-card entry point**
   - When memory flows exist, add a quiet link from the compaction summary card to `#memory-flow-1`.
   - Leave the summary card unchanged when no memory flow exists.

5. **Keep JavaScript optional**
   - Implement static anchor behavior first.
   - Add only tiny open/focus helper JavaScript if static links are hard to use in manual smoke.

## Expected files

Likely implementation touches:

- `packages/pi-extension-agent-lens/src/report.ts` — render anchors, links, highlights, summary-card entry point, and optional tiny navigation helper.
- `packages/pi-extension-agent-lens/src/report-events.ts` — only if observable-log event metadata needs a small typed extension for rendering links.
- `packages/pi-extension-agent-lens/src/report.test.ts` or a focused report-memory UX test file — generated HTML assertions for anchors, links, attributes/classes, missing segments, and escaping.

M2 should not change trace capture hooks unless M1 explicitly left a tested metadata gap that is accepted into 0.4.0 scope.

## Implementation notes

Implemented as a narrow M1/M2 overlap by extending the existing `buildCompactionExplorer` model instead of adding a separate helper:

- compaction flow segments now expose zero-based record indexes and confidence labels;
- provider-after metadata is inferred from the next observed same-run provider request;
- rendered report anchors and labels remain one-based for users;
- observable-log rows receive static anchors, memory-flow backlinks, role data attributes, and CSS-only role highlights;
- the compaction summary card links to `#memory-flow-1` only when a flow exists;
- no trace capture hooks, raw capture, browser storage, dependencies, build step, server, or network behavior were added.

## Non-goals

- Frontend framework or build step.
- Local server/WebSocket mode by default.
- Raw prompt/provider/session/tool output rendering.
- Automated behavior scoring/evaluation.
- Sending reports/traces to external services.
- Generic index report sorting/filtering.
- Report-wide UI polish unrelated to memory flow.

## Safety notes

Richer UX must not weaken report safety:

- dynamic HTML remains escaped;
- report data remains redacted/summarized;
- inline JavaScript remains local-only;
- no network requests;
- no new capture pipeline unless separately scoped.

## Acceptance criteria

M2 is complete when:

- Memory-flow cards link to related observable-log records with deterministic static anchors.
- Related observable-log rows link back to memory-flow groups with quiet visible labels.
- Before-context, preparation, result, after-context, and provider-after roles are visually distinguishable when present.
- Missing, nearby observed, and inferred relationships remain clearly labeled.
- Provider-after wording says `next observed provider request` when inferred.
- The compaction summary card links to memory flow only when memory-flow groups exist.
- The report still works as a static HTML file with JavaScript disabled, except optional progressive enhancement.
- Dynamic HTML remains escaped.
- Tests cover generated anchors, related-record links, backlink labels, highlighting attributes/classes, missing segments, summary-card no-op behavior, and redaction safety.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should use a compaction-heavy trace and confirm a user can jump between memory flow and related log records without losing context.

## Status tracking

At M2 implementation start:

1. Confirm M1 is `Done` or explicitly accept a narrow M1/M2 overlap.
2. Update `versions/0.4.0/milestones.md` so `M2` is `In progress`.
3. Append a short start entry to `versions/0.4.0/log.md`.

At M2 completion:

1. Run the verification commands above.
2. Add implementation notes to this plan if final behavior differs from the planning decisions.
3. Update `versions/0.4.0/milestones.md` so `M2` is `Done`.
4. Append verification evidence to `versions/0.4.0/log.md`.
