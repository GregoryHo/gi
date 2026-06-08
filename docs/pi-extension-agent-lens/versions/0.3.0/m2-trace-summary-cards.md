# M2 — Trace summary cards

## Status

Done.

## SPEC

Add high-signal summary cards to the single-trace report and/or index report so users can quickly understand a trace before reading details.

### Candidate scope

Summary cards may include:

- total records, runs, turns;
- provider request count;
- model names observed;
- max/last context message counts;
- tool call names and counts;
- compaction event count and token-before values;
- first/last event timestamps.

### Expected files

Likely package files:

- `src/report-summary.ts`
- `src/report-summary.test.ts`
- `src/report.ts`
- `src/index-report.ts` if index cards are included

## Non-goals

- Raw prompt/context/tool output display.
- Statistical/eval judgments about quality.
- Cross-trace comparison.

## Acceptance criteria draft

- Summary cards render in single-trace report.
- Summary values derive only from existing redacted JSONL records.
- Missing fields are handled gracefully.
- Tests cover provider/model/tool/compaction summary extraction.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

## Completion notes

Completed on 2026-06-07.

Implemented:

- `src/report-summary.ts` high-signal trace summary extraction.
- `src/report-summary.test.ts` coverage for provider/model/tool/context/compaction metrics and missing fields.
- Trace summary card section in single-trace HTML reports.
- Cards for total records/runs/turns, provider requests/models, context size, tool names, compactions/tokens, and time range.
- Static/redacted report behavior preserved.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

