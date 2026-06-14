# Agent Lens 0.4.1

## Status

- Version: `0.4.1`
- Status: Sealed on 2026-06-14 after M1/M2/M3 completion, automated verification, and manual acceptance.
- Expected base: `0.4.0`
- Theme: Follow-up report UX polish and metadata-only report-reading workflows.
- Package: `packages/pi-extension-agent-lens`

## Product goal

0.4.1 should make existing Agent Lens reports easier to scan, revisit, and compare without changing capture defaults.

The release should stay focused on static/local report ergonomics that help users read existing redacted traces:

- improve the multi-trace index as the entry point for many traces;
- improve per-trace navigation and density controls for long reports;
- optionally add metadata-only trace comparison if it remains the most valuable report-reading workflow after M1/M2.

## Planning docs

- `plan-spec.md` — version-level product spec, implementation plan, gates, and verification baseline.
- `milestones.md` — milestone tracker and release criteria.
- `log.md` — append-only 0.4.1 planning and implementation history.

## Delivered scope

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-index-sorting-filtering.md` | Multi-trace index sorting/filtering/search so users can find relevant reports quickly. |
| M2 | Done | `m2-report-navigation-density.md` | Per-trace report navigation and density refinements that reduce scrolling and improve long-report reading. |
| M3 | Done | `m3-metadata-trace-comparison.md` | Metadata-only comparison between local traces using redacted metadata only. |

## Design boundaries

0.4.1 should not become a new capture or evaluation release. Prefer consuming existing JSONL metadata and generated report summaries.

Allowed by default:

- static HTML/CSS/inline JavaScript with no network calls;
- local-only, file-based generated reports;
- browser state only if explicit, minimal, and non-sensitive; default should work without persistence;
- metadata, counts, roles, event kinds, timestamps, hashes, file sizes, and generated report links.

Avoid unless explicitly re-scoped:

- new raw content capture;
- local server/WebSocket mode;
- automated evaluator/model-judge integration;
- full replay/eval harness;
- full session branch reconstruction;
- package dependencies or frontend build step.

## Release notes

0.4.1 delivered report-reading polish without changing Agent Lens capture defaults:

- The multi-trace index now has local static controls for trace search, active/inactive filtering, last-event filtering, report-availability filtering, and sorting by modified time, record count, file size, event, or active marker.
- Index rows expose metadata for local controls and render missing values as `missing` instead of blank cells.
- Per-trace reports now include section navigation, stable section anchors, observable-log visible counts, and comfortable/compact density controls.
- `/agent-lens compare` writes `.pi-agent-lens/compare.html`, a metadata-only local trace comparison report with source report links where available.
- Comparison output uses counts, models, tools, context/compaction metadata, file size, and modified time only.
- No raw capture, new dependencies, frontend build step, network behavior, server mode, or evaluator integration was added.

## Verification

0.4.1 was verified with:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke was completed by the user on 2026-06-14 for `/agent-lens report`, `/agent-lens index`, and `/agent-lens compare`.
