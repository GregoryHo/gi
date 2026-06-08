# M2 — HTML report

## SPEC

### Scope

Implement the smallest useful local HTML report renderer over M1 JSONL traces:

- Parse Agent Lens JSONL trace records from a trace file.
- Render a self-contained HTML report with:
  - event timeline
  - event counts
  - context snapshots
  - provider payload shape summaries
  - compaction before/after summaries
- Add `/agent-lens report` to write an `.html` report next to the current trace file.
- Keep the generated report live-updating after `/agent-lens report`: later trace events rewrite the HTML, and the HTML auto-refreshes in the browser.
- Include source trace metadata in the report and write `.pi-agent-lens/latest.html` as an alias for the most recently generated live report.
- Add `/agent-lens traces` to list local trace files with record counts and last event metadata, marking the current active trace.
- Show both timestamped report and `latest.html` paths in `/agent-lens report` notifications.
- Keep the report local-only and based on the already-redacted M1 trace records.

### Non-goals

- No browser auto-open.
- No external assets, network calls, or uploads.
- No raw message/provider payload capture.
- No interactive TUI dashboard.
- No report comparison across multiple traces.

### Design notes

- Renderer should be pure where possible: `renderHtmlReport(records, options)` returns a string.
- File IO should live behind a small helper that reads JSONL and writes HTML.
- HTML must escape all dynamic text, even though M1 trace is already redacted.
- The command should preserve existing `/agent-lens` status behavior when no args are passed.

### Expected files

Likely additions:

```text
packages/pi-extension-agent-lens/src/report.ts
packages/pi-extension-agent-lens/src/report.test.ts
```

Update existing files only where needed:

```text
packages/pi-extension-agent-lens/src/commands.ts
packages/pi-extension-agent-lens/src/index.ts
packages/pi-extension-agent-lens/package.json
```

## AC

Acceptance criteria:

- `/agent-lens report` writes an HTML file next to the active JSONL trace.
- The report contains event counts, timeline rows, provider payload summaries, and compaction summaries when present.
- HTML escaping prevents raw trace field values from becoming executable markup.
- Existing `/agent-lens` status command still works.
- Report generation does not mutate session content, context, provider payloads, or compaction behavior.

Verification commands/checks:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke check:

```text
/agent-lens report
```

Then open or inspect the generated `.html` next to the JSONL trace.

## Status tracking

At start:

1. Change M2 status in `milestones.md` from `Proposed` to `In progress`.
2. Append a start entry to `log.md`.

At completion:

1. Run the verification above.
2. Change M2 status in `milestones.md` to `Done`.
3. Add completion notes and verification evidence here.
4. Append a completion entry to `log.md`.

## Completion notes

Implemented M2 local HTML reporting:

- Added `renderHtmlReport()` pure renderer for event counts, timeline, context, provider, and compaction sections.
- Added `writeHtmlReportForTrace()` to read JSONL and write an adjacent `.html` report.
- Added `/agent-lens report` command support while preserving `/agent-lens` status behavior.
- Made generated reports live-updating: future trace events rewrite the same HTML file and the page auto-refreshes every 2 seconds.
- Added source trace metadata and `.pi-agent-lens/latest.html` alias to reduce confusion across timestamped traces.
- Added `/agent-lens traces` for multi-session trace discovery, including active trace marking.
- Updated `/agent-lens report` notifications to include both report paths and captured live rewrite failures as status errors.
- Escaped dynamic HTML content in report output.
- Added tests for rendering, escaping, file generation, and command integration.

Verification evidence:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

All listed automated checks passed on 2026-06-07. User completed in-session manual smoke testing before release sealing, including live report behavior.

## Status

Done.
