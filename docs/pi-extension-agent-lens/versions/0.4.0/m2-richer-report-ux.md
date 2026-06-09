# M2 — Targeted memory report UX

## Status

Proposed.

## Motivation

0.3.0 made the single-trace report much more readable with observable-log rows, filters, search, summary cards, and a session/compaction explorer. For 0.4.0, report UX work is intentionally narrowed to memory/session/compaction reading.

M2 should add only the report navigation primitives needed to make M1's memory-flow model readable in a static local HTML file.

## UX principle

Every M2 UI change must answer yes to this question:

> Does this make memory/session/compaction flow easier to understand?

If not, defer it to `../0.4.1/index.md`.

## Candidate scope

- Add stable HTML anchors for memory-flow groups and related log records.
- Link memory-flow cards to related observable-log records.
- Link related observable-log records back to their memory-flow group.
- Highlight before/after context snapshots around compaction.
- Add a compact memory-flow layout only if long compaction-heavy traces require it.
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

The existing compaction summary card can link to the first memory-flow group when compactions exist:

- `Compactions: 2` → `#memory-flow-1`.

This is useful only if it stays visually quiet.

## Relationship to M1

M2 depends on M1 exposing enough structured data for links and confidence labels. M2 should not duplicate memory-flow grouping logic in the renderer.

Expected M1/M2 boundary:

- M1 helper returns memory-flow groups with record indexes and confidence labels.
- M2 renderer turns those groups into anchors, links, and highlights.

## Open questions

1. Should related log rows show a visible chip/link, or should highlighting plus anchors be enough?
2. Should clicking `View record #N` open that record's `<details>` automatically with tiny local JS?
3. Should compact mode ship in 0.4.0 M2, or wait until M3/manual smoke proves it is needed?
4. Should summary-card links point to memory flow only when compaction records exist?
5. Should provider-after be included in M2 links if M1 marks it as inferred rather than observed?

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

## Acceptance criteria draft

If implemented, this milestone should satisfy:

- Memory-flow cards link to related observable-log records.
- Related observable-log rows can link back to memory-flow groups.
- Before/after/preparation/result/provider-after roles are visually distinguishable when present.
- Missing or inferred relationships remain clearly labeled.
- The report still works as a static HTML file with JavaScript disabled, except optional progressive enhancement.
- Dynamic HTML remains escaped.
- Tests cover generated anchors, related-record links, highlighting attributes/classes, missing segments, and redaction safety.

## Verification draft

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should use a compaction-heavy trace and confirm a user can jump between memory flow and related log records without losing context.
