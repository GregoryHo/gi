# Agent Lens extension docs index

## Current stable version

- Version: `0.4.1`
- Package: `packages/pi-extension-agent-lens`
- Status: Report UX polish release sealed after M1/M2/M3 completion, automated verification, and manual acceptance.
- Current package version: `0.4.1`

## Active planning version

- Version: `0.5.0`
- Status: Active planning; implementation not started.
- Planning area: `versions/0.5.0/`
- Theme: Multi-agent swimlane + topology foundation.

## Product summary

Agent Lens is a product-y observability extension for pi. It records local, read-only evidence about agent runs and renders reports that explain how context, turns, tools, provider payloads, and compression shape behavior.

v0.1.0 delivered:

- Read-only JSONL lifecycle traces under `.pi-agent-lens/`.
- Redacted summaries for prompts, system prompts, context messages, provider payload shape, tool flow, and compaction events.
- `/agent-lens` status command.
- `/agent-lens report` live-updating HTML reports with `.pi-agent-lens/latest.html`.
- `/agent-lens traces` multi-trace discovery with active trace marking.

v0.2.0 delivered:

- Project-local config loading from `.pi-agent-lens/config.json`.
- Configurable artifact root and live report refresh interval.
- Config source/profile/warning visibility in `/agent-lens` status.
- Trace size and modified-time metadata in `/agent-lens traces`.
- Explicit retention cleanup commands: `/agent-lens clean --dry-run` and `/agent-lens clean --confirm`.
- Multi-trace index report via `/agent-lens index` and `.pi-agent-lens/index.html`.

v0.3.0 delivered:

- Observable log UI with event taxonomy chips, filters, search, and expandable records.
- Trace summary cards for run/turn/provider/context/tool/compaction metadata.
- Session/compaction explorer foundation with before/preparation/result/after cards.
- Reduced chip noise by moving run/turn identifiers into row metadata.
- Defensive report redaction for raw-like `text` and `content` fields.

v0.4.0 delivered:

- Metadata-only memory-flow grouping around compaction events.
- Confidence labels for observed, nearby observed, inferred, and missing relationships.
- Static links from memory-flow cards to observable-log records and backlinks from related rows.
- Memory-flow explorer safety wording that avoids overclaiming full session reconstruction.
- Provider-after cards for the next observed provider request after compaction.

v0.4.1 delivered:

- Multi-trace index sorting, filtering, search, active filtering, report-availability filtering, and stable missing metadata labels.
- Per-trace report section navigation, stable anchors, observable-log visible counts, and comfortable/compact density controls.
- `/agent-lens compare` with a local metadata-only trace comparison report and source report links where available.

## Navigation

- `roadmap.md` — broad product direction and deferred candidates.
- `milestones.md` — sealed v0.1.0 milestone tracker.
- `m1-read-only-event-trace.md` — completed M1 plan.
- `m2-html-report.md` — completed M2 plan.
- `archive.md` — completed/superseded docs index.
- `versions/0.2.0/index.md` — sealed 0.2.0 planning and release notes.
- `versions/0.3.0/index.md` — sealed 0.3.0 planning and release notes.
- `versions/0.4.0/index.md` — sealed 0.4.0 planning and release notes.
- `versions/0.4.1/index.md` — sealed 0.4.1 planning and release notes.
- `versions/0.5.0/index.md` — active 0.5.0 planning for multi-agent swimlane + topology foundation.
- `versions/README.md` — convention for future versioned planning docs.
- `log.md` — append-only product/change log.
- `AGENTS.md` — docs governance and workflow.

## Naming

Chosen product name: `Agent Lens`.

Chosen package/doc name: `pi-extension-agent-lens`.

Rationale:

- `Lens` communicates observation and understanding without limiting the product to context tracing.
- The package can grow to cover turns, tools, compression, provider payloads, session branching, and evaluation views.
- The name follows the repo convention where `docs/<package-name>/` exactly matches `packages/<package-name>/`.
