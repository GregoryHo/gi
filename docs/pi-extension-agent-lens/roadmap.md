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

## Delivered in 0.4.1

- Multi-trace index sorting/filtering/search so users can find relevant reports quickly.
- Per-trace navigation and density refinements for long static reports.
- Metadata-only trace comparison through `/agent-lens compare` and `.pi-agent-lens/compare.html`.

## Active direction

No active planning version. Future work should be planned under `versions/<semver>/` before implementation starts.

## Deferred candidates

Future work should be planned under `versions/<semver>/` before implementation.

- Additional report UX polish beyond the 0.4.1 milestones.
- Richer metadata-only comparison workflows beyond the initial 0.4.1 compare report.
- Explicit raw capture opt-in design, if still desired after config groundwork.
- Behavior evaluation views beyond metadata-only summaries.
- Optional local server mode if file-based live reports become insufficient.

## Continuing non-goals

- Changing prompts or provider payloads.
- Replacing pi's built-in compaction.
- Sending traces to external services.
- Persisting raw private content by default.
