# Agent Lens roadmap

## Vision

Agent Lens helps users understand how pi agent behavior emerges from system prompts, session history, tool results, provider payloads, and memory compression.

## Product pillars

1. **Timeline clarity** — show agent runs, turns, tool batches, queued messages, and lifecycle hooks in order.
2. **Context legibility** — explain what was sent to the model without requiring users to read raw provider JSON.
3. **Compression learning** — show what compaction summarized, what stayed raw, and what the next request saw.
4. **Safe observability** — default to redacted/truncated local artifacts; make raw capture explicit and hard to enable accidentally.
5. **Portable reports** — render HTML reports that can be opened locally and shared only after manual review.

## Delivered in 0.1.0

- Read-only event trace: capture lifecycle event metadata and minimal redacted context summaries to JSONL.
- Live HTML report: render timeline, context, provider, tool, and compaction views from JSONL artifacts.
- Basic multi-trace UX: latest report alias, source trace metadata, trace listing, and active trace marking.

## Delivered in 0.2.0

- Config profiles and status visibility.
- Configurable artifact root and live report refresh interval.
- Retention metadata and explicit cleanup commands.
- Multi-trace index report/dashboard.

## Delivered in 0.3.0

- Observable log UI with typed chips/tags, filters, search, and expandable records.
- Trace summary cards for model/context/tools/compaction and run metadata.
- Session/compaction explorer foundation with before/preparation/result/after cards.
- Reduced chip noise by moving run/turn identifiers into row metadata.
- Defensive report redaction for raw-like `text` and `content` fields.

## Active 0.4.0 direction

0.4.0 is planned under `versions/0.4.0/` as a **Memory-explorer UX bridge**:

- Session memory explorer: connect compaction summaries to session entries and branch/navigation metadata where safely observable.
- Targeted richer report UX: add only the navigation and reading improvements needed to make memory/compaction flow legible.

Generic report UX polish and follow-up static report improvements are parked in `versions/0.4.1/index.md`.

## Deferred candidates

Future work beyond 0.4.0 should be planned under `versions/<semver>/` before implementation.

- Generic static report UX polish not required for 0.4.0 memory-flow reading.
- Index report sorting/filtering improvements.
- Metadata-only trace comparison.
- Explicit raw capture opt-in design, if still desired after config groundwork.
- Behavior evaluation views beyond metadata-only summaries.
- Optional local server mode if file-based live reports become insufficient.

## Continuing non-goals

- Changing prompts or provider payloads.
- Replacing pi's built-in compaction.
- Sending traces to external services.
- Persisting raw private content by default.
