# Agent Lens 0.3.0

## Status

- Version: `0.3.0`
- Status: Sealed on 2026-06-07 after M1/M2/M3 completion and manual acceptance.
- Theme: Observable log reader and session/compaction legibility.
- Package: `packages/pi-extension-agent-lens`
- Stable base: `0.2.0`

## Product goal

Make Agent Lens feel like an observable log reader: users should be able to open a report, scan the run by event type, see typed chips/tags for turns/tools/actions/compaction, and expand records when they want detail.

0.3.0 is not primarily about debugging or trace diffing. It is about helping users understand what happened in an agent run.

## Reference notes

Reference repo reviewed: `https://github.com/disler/pi-agent-observability`.

Relevant ideas to adapt without copying architecture wholesale:

- Canonical event taxonomy with type chips.
- Rich per-type rendering rather than only a raw table.
- Event filters and search in the browser UI.
- Expandable detail rows.
- Static UI can still be useful; Agent Lens should stay file-based for 0.3.0 unless explicitly re-scoped.

Not adopting for 0.3.0 by default:

- Bun/SQLite server.
- SSE/live server hosting.
- Raw boot snapshot capture.
- Multi-agent swimlane/race views.

## Delivered 0.3.0 scope

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-report-navigation.md` | Observable log UI: typed chips/tags, filters, grouping, expandable records. |
| M2 | Done | `m2-trace-summary-cards.md` | Add high-signal summary cards for model/context/tools/compaction. |
| M3 | Done | `m3-session-compaction-explorer.md` | Session/compaction explorer foundation from existing redacted metadata. |

## Non-goals for 0.3.0 unless explicitly re-scoped

- Raw prompt/provider payload capture implementation.
- Sending traces to external services.
- Mutating prompts, context, provider payloads, compaction output, or session entries.
- Trace comparison/debug workflow.
- Full eval/replay system.
- Complex frontend framework or build step.
- Local server/WebSocket mode.

## Safety stance

0.3.0 should keep reports content-safe by default:

- continue using redacted metadata;
- escape all HTML dynamic values;
- avoid raw prompt/context/provider payload rendering;
- keep reports local and portable;
- inline JavaScript is allowed only for local filtering/search/expand UX and must not fetch remote resources.

## Decisions

- M1 may use minimal inline JavaScript.
- 0.3.0 should move toward session/compaction legibility rather than trace comparison.
- Observable log reading is the immediate user scenario: classify events, show chips/tags, and allow expand-to-read details.

## Release notes

0.3.0 delivered a more readable single-trace report without changing Agent Lens capture defaults:

- Observable log rows classify events into run, turn, context, provider, tool, compaction, report, cleanup, config, and other categories.
- Local report controls support category filtering, metadata search, expand all, and collapse all.
- Summary cards highlight total records, run/turn count, provider request/model metadata, context size, tool names, compaction count/tokens, and time range.
- The session/compaction explorer groups preparation and result records with nearby before/after context snapshots.
- Report rendering defensively redacts raw-like `text` and `content` string fields from detail JSON.
- Run/turn identifiers render as row metadata instead of duplicate chips.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke was approved on 2026-06-07.
