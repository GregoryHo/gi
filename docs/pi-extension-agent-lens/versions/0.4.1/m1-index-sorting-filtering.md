# M1 — Index sorting/filtering/search

## Status

Done. Implemented local static controls for multi-trace index sorting, filtering, and search.

## Motivation

0.2.0 added a multi-trace index, and later releases made each per-trace report richer. As trace count grows, users need to find the right report quickly before they can benefit from memory-flow and observable-log details.

M1 improves the index report as the entry point for local Agent Lens artifacts.

## SPEC

### Scope

Add static, local-only index report controls for trace discovery:

- sort traces by modified time, record count, file size, last event kind, and active marker;
- filter/search by trace file name/path, last event kind, generated report availability, and active marker;
- preserve clear empty-state messaging when filters hide all traces;
- keep the current index report links to generated per-trace reports;
- show enough metadata to choose a trace without opening every report.

### Non-goals

- No trace deletion or retention policy changes.
- No raw trace content rendering.
- No server, WebSocket, database, or external search service.
- No browser persistence unless explicitly approved during implementation.
- No cross-trace comparison charts in M1.

### Design notes

- Prefer dependency-free inline JavaScript and simple table/list markup.
- The index must remain usable with JavaScript disabled, with controls treated as progressive enhancement.
- All dynamic values must be HTML-escaped before rendering.
- Sorting/filtering should operate only on metadata already present in index generation.
- If a field is missing, display a stable `unknown`/`missing` value rather than failing report generation.

### Expected files

Likely touchpoints, subject to implementation discovery:

- `packages/pi-extension-agent-lens/src/report.ts` or current index report renderer module.
- `packages/pi-extension-agent-lens/src/report.test.ts` or current report/index tests.
- `packages/pi-extension-agent-lens/README.md`.
- `packages/pi-extension-agent-lens/CHANGELOG.md` when completing the version.
- `docs/pi-extension-agent-lens/versions/0.4.1/*` status/log updates.

## AC

Acceptance criteria:

- `/agent-lens index` generates an index report with visible sort and filter/search controls.
- Default ordering remains sensible, preferably newest/relevant traces first.
- Users can filter to the active trace and search by trace path/name.
- Missing metadata does not break report generation.
- HTML escaping tests cover user/file-derived strings shown in index controls or rows.
- No new capture hooks, raw content rendering, network calls, or package dependencies are introduced.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke:

1. Generate multiple local traces or use fixtures with varied metadata.
2. Run `/agent-lens index`.
3. Confirm sorting, filtering, active-trace filtering, search, links, and empty state work in the generated static HTML.
4. Confirm no raw private content appears.

## Completion notes

- Added visible `/agent-lens index` controls for trace search, active filtering, last-event filtering, report availability filtering, and metadata sorting.
- Added row metadata attributes so the generated static HTML can sort/filter without network calls, browser storage, or new dependencies.
- Missing index metadata now renders as stable `missing` values instead of blank cells.
- Added tests covering controls, row metadata, missing values, report availability, active marker metadata, event options, and HTML escaping.
- Updated README and changelog notes for the index controls.

Verification completed on 2026-06-14:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Static smoke completed with a temporary artifact root and generated `index.html`; confirmed search/sort controls, active/report metadata, missing report metadata, and empty-state text were present. No repo runtime artifacts were created.

## Status tracking

At milestone start:

1. Update `versions/0.4.1/milestones.md` M1 to `In progress`.
2. Append a short start entry to `versions/0.4.1/log.md`.

At milestone completion:

1. Run verification listed above.
2. Update M1 to `Done`.
3. Add completion notes here.
4. Append verification/manual-smoke evidence to `versions/0.4.1/log.md`.
