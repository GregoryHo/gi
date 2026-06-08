# M1 — Observable log UI with typed chips and expandable records

## Status

Done.

## SPEC

Improve the single-trace HTML report so it reads like an observable event log instead of a raw JSONL table.

Users should be able to quickly see what happened by event type, scan turns/tools/actions/context/provider/compaction events using chips/tags, filter the log, and expand records to read details when needed.

## Reference influence

Reference: `https://github.com/disler/pi-agent-observability`.

Ideas to adapt:

- event taxonomy displayed as type chips;
- rich per-type rows;
- event-type filters;
- expandable details;
- search within event metadata.

Do not adopt in M1:

- server-hosted dashboard;
- SSE/live backend;
- SQLite persistence;
- raw payload rendering.

## Scope

- Define a report event classification helper that maps each Agent Lens JSONL record to:
  - category, e.g. `run`, `turn`, `context`, `provider`, `tool`, `compaction`, `report`, `cleanup`, `config`, `other`;
  - display label;
  - chips/tags;
  - run index / turn index when available;
  - short summary text from existing redacted metadata.
- Render the timeline as an observable log with:
  - colored chips/tags;
  - grouped run/turn metadata where available;
  - expandable record details via `<details>`;
  - a compact summary line visible before expansion.
- Add minimal inline JavaScript for:
  - event/category filter chips;
  - text search over visible metadata;
  - expand/collapse all controls if straightforward.
- Preserve static file-based HTML output.

## Expected files

Likely package files:

- `src/report-events.ts`
- `src/report-events.test.ts`
- `src/report.ts`
- `src/report.test.ts`

Likely docs files:

- `versions/0.3.0/milestones.md`
- `versions/0.3.0/log.md`
- this plan

## Event taxonomy draft

Initial categories and candidate chips:

| Category | Events | Chips |
| --- | --- | --- |
| `run` | `before_agent_start`, `agent_start`, `agent_end` | `run`, `start/end`, `messages` |
| `turn` | `turn_start`, `turn_end` | `turn`, `assistant`, `tool-results` |
| `context` | `context` | `context`, role counts, message count |
| `provider` | `before_provider_request` | `provider`, `model`, `tools`, `input` |
| `tool` | derived from `turn_end` tool result summaries and message tool calls | `tool`, tool names, error marker |
| `compaction` | `session_before_compact`, `session_compact` | `compaction`, `tokens`, `summary` |
| `report` | `report_requested` | `report` |
| `cleanup` | cleanup-related records if added later | `cleanup` |
| `config` | config-related records if added later | `config` |
| `other` | unknown/custom events | `other` |

M1 can classify only existing records; it does not need to add new capture events.

## Non-goals

- Raw content rendering.
- External CSS/JS dependencies.
- Local server/WebSocket mode.
- Multi-agent swimlane/race view.
- Trace comparison/debug workflow.
- New capture hooks solely for classification.

## Acceptance criteria draft

- Single-trace report still renders as one portable `.html` file.
- Timeline rows display category/type chips.
- Users can filter by category/event type in the browser without regenerating the report.
- Users can search visible metadata in the browser.
- Each row has expandable detail JSON preserving existing 0.2.0 data.
- Dynamic HTML remains escaped.
- Tests cover event classification, chip rendering, filter UI presence, expandable details, and escaping.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke before Done:

1. Open `latest.html` generated from a real trace.
2. Verify category/type chips appear on events.
3. Filter to provider/context/tool/compaction categories.
4. Search for a visible metadata value such as model name or tool name.
5. Expand a few records and verify redacted JSON details remain available.

## Completion notes

Started on 2026-06-07.

Implemented so far:

- `src/report-events.ts` event classification helper.
- `src/report-events.test.ts` classifier tests for provider/context/turn/tool/compaction metadata.
- Observable log rendering in `src/report.ts`.
- Category chips, event chips, summary lines, and expandable `<details>` record JSON.
- Minimal inline JavaScript for category filters, metadata search, and expand/collapse all.
- Static file-based output retained; no capture pipeline changes.

Automated verification passed:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual acceptance completed on 2026-06-07.

