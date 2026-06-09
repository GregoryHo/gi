# M2 — Targeted memory report UX discussion

## Status

Proposed.

## Motivation

0.3.0 made the single-trace report much more readable with observable-log rows, filters, search, summary cards, and a session/compaction explorer. For 0.4.0, report UX work is intentionally narrowed to memory/session/compaction reading.

This milestone explores the static-file report UX needed to make the 0.4.0 memory flow easy to scan without becoming a generic UI polish release.

## Candidate scope

- Add section links that support memory-flow reading.
- Link memory-flow cards to related observable-log records.
- Link related observable-log records back to the memory-flow section.
- Highlight before/after context snapshots around compaction.
- Add compact memory-reading mode only if long compaction-heavy traces require it.
- Preserve no-dependency, no-build, no-server report generation unless explicitly re-scoped.

Generic report polish, broad index filtering, and UX refinements unrelated to memory-flow reading are deferred to 0.4.1.

## Candidate display

- Memory flow anchor links.
- `Related records` links from memory cards.
- `Memory flow` backlink from related log rows.
- Before/after context highlighting.
- Compact memory-flow layout for long traces, if needed.

## Relationship to session memory explorer

Richer report UX should support the session memory explorer rather than become a separate dashboard project. If 0.4.0 is bridge-shaped, M2 can provide the navigation primitives that make M1's memory flow easier to read:

- jump from summary card to memory flow;
- jump from memory flow to related log records;
- highlight before/after context snapshots;
- make partial/inferred memory relationships visually distinct.

## Open questions

1. Which memory-flow jumps are essential: summary-to-memory, memory-to-log, log-to-memory, or all three?
2. Should related records be linked by HTML anchors only, or should inline JavaScript also scroll/focus/open details?
3. Should report controls persist state in the URL/hash/localStorage, or avoid browser storage entirely?
4. Should any index report changes be in scope, or should 0.4.0 focus only on single-trace memory reading?
5. Should compact mode be pure CSS/inline JS, or deferred to 0.4.1?

## Non-goals

- Frontend framework or build step.
- Local server/WebSocket mode by default.
- Raw prompt/provider/session/tool output rendering.
- Automated behavior scoring/evaluation.
- Sending reports/traces to external services.

## Safety notes

Richer UX must not weaken report safety:

- dynamic HTML remains escaped;
- report data remains redacted/summarized;
- inline JavaScript remains local-only;
- no network requests;
- no new capture pipeline unless separately scoped.

## Acceptance criteria draft

If implemented, this milestone should satisfy:

- Memory flow is easier to navigate without adding a build step or external dependency.
- Controls work locally in a static HTML file.
- Dynamic HTML remains escaped.
- Tests cover generated control markup and redaction safety.
- Manual smoke confirms the report is easier to scan than 0.3.0.

## Verification draft

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```
