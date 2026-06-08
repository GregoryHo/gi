# M3 — Multi-trace index report

## Status

Done.

## SPEC

Add an index-level HTML report across local Agent Lens traces so users can navigate more than one session without relying on timestamp filenames.

### Scope

- Generate `.pi-agent-lens/index.html` or equivalent under configured artifact root.
- Show a table of local traces with:
  - trace filename;
  - record count;
  - last event and timestamp;
  - file size/age if M2 provides it;
  - linked timestamped report if present;
  - active/latest marker where available.
- Link to `.pi-agent-lens/latest.html` and per-trace HTML reports.
- Add command to generate/update the index.

### Candidate commands

Exact syntax may change before implementation, but likely:

```text
/agent-lens index
```

Potential integration:

```text
/agent-lens report
```

may update the index after generating the active trace report.

### Expected files

Likely package files:

- `src/index-report.ts`
- `src/index-report.test.ts`
- `src/traces.ts`
- `src/report.ts`
- `src/commands.ts`
- `src/commands.test.ts`
- `src/index.ts`
- README/CHANGELOG updates

Likely docs files:

- `versions/0.2.0/milestones.md`
- `versions/0.2.0/log.md`
- this plan

### Design notes

This should remain file-based, matching 0.1.0. Do not introduce a local server in M3 unless explicitly re-scoped.

The index report should make multi-session use less confusing but should not become a complex dashboard in 0.2.0.

## Non-goals

- Trace diff/eval comparison.
- Live WebSocket/SSE updates.
- Charting library dependency.
- Raw content rendering.
- Cross-project aggregation.

## Acceptance criteria

- `/agent-lens index` writes an index HTML file under the artifact root.
- Index HTML escapes dynamic values.
- Index links known per-trace report files when present.
- Index marks active/latest traces when known.
- Tests cover HTML escaping, trace listing, missing report links, and command integration.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke before Done:

1. Create at least two traces.
2. Generate individual report(s).
3. Run `/agent-lens index`.
4. Open index HTML and confirm links/metadata are correct.

## Completion notes

Completed on 2026-06-07.

Implemented:

- `/agent-lens index` command.
- `.pi-agent-lens/index.html` multi-trace index report.
- Trace table with filename, record count, size, last event/timestamp, modified time, report link, and active marker.
- Links to generated per-trace HTML reports when present.
- Dynamic HTML escaping for index report content.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

