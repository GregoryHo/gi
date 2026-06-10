# Agent Lens 0.4.0

## Status

- Version: `0.4.0`
- Status: Sealed on 2026-06-09 after M1/M2/M3 completion and manual acceptance.
- Theme: Memory-explorer UX bridge.
- Package: `packages/pi-extension-agent-lens`
- Stable base: `0.3.0`

## Product goal

0.4.0 is scoped to a **Memory-explorer UX bridge**.

It combines two roadmap directions without fully expanding either one:

1. **Session memory explorer** — help users understand how session entries, compaction summaries, retained recent messages, and branch/history shape the next provider request.
2. **Richer report UX** — add only the navigation and reading improvements needed to make memory/compaction flow understandable in static local reports.

Generic report polish that is not necessary for memory-flow reading is deferred to 0.4.1.

## Chosen track

### Considered track A — Session memory explorer first

Build on 0.3.0's compaction explorer and make session memory more legible.

Possible scope:

- Read session metadata safely from existing trace/session artifacts.
- Link compaction records to nearby session-entry IDs where available.
- Show what is summarized, what remains raw/recent, and what the next request likely saw.
- Add branch/session navigation only where metadata is already safe and observable.

Why this fits now:

- It is the most direct continuation of 0.3.0 M3.
- It strengthens Agent Lens' core value: explaining context and compaction.
- It can remain read-only and redacted by default.

Main risk:

- pi session internals may not expose enough safe metadata to reconstruct lineage without either partial views or extra capture design.

### Considered track B — Richer report UX first

Improve the static-file report experience so users can scan, filter, jump, and revisit traces more comfortably.

Possible scope:

- Sticky or compact local controls for search/filter/expand.
- Section jump links and better table-of-contents behavior.
- Collapsible sections and density modes.
- Better run/turn grouping and row metadata layout.
- Index report sorting/filtering improvements.

Why this might matter:

- 0.3.0 proved the report can be product-y without a server.
- The user already noticed chip density and reading UX issues.
- Report UX improvements make every future feature easier to consume.

Main risk:

- UI polish can sprawl. 0.4.0 should avoid a frontend framework, build step, or local server unless explicitly re-scoped.

### Chosen track C — Memory-explorer UX bridge

Use richer report navigation to make session memory and compaction flow easier to understand.

0.4.0 scope:

- Define a safe memory-flow model based on existing redacted trace records and any additional redacted metadata explicitly scoped by milestones.
- Show what stayed recent, what became summary metadata, and what the next provider request likely saw.
- Distinguish observed facts from inferred relationships.
- Jump from summary cards to memory flow.
- Jump from memory flow cards to related observable-log records.
- Highlight before/after context snapshots.
- Add only compact/dense controls needed for long compaction-heavy traces.
- Keep index-level improvements minimal unless they directly support memory exploration.

Why this may be the best 0.4.0 shape:

- It combines roadmap item 2 and item 5 without overbuilding either.
- It stays close to Agent Lens' core: making agent behavior legible.
- It preserves privacy/safety defaults and static-file portability.

## Non-goals unless explicitly re-scoped

- Raw prompt, raw provider payload, raw tool output, or raw compaction summary capture by default.
- Automated model-judge scoring or behavior evaluation views.
- Mutating pi session entries, prompts, context, provider payloads, or compaction output.
- Replacing pi's built-in compaction.
- Sending traces or reports to external services.
- Full replay/eval harness.
- Local server/WebSocket mode.

## Safety stance

0.4.0 should keep Agent Lens read-only and local by default:

- Prefer metadata, fingerprints, IDs, counts, roles, timestamps, and hashes.
- Any browser-side state, if introduced, should be explicit and local-only.
- Any future raw capture, user annotations, or automated evaluator should require a separate explicit design milestone.

## Product decisions

- 0.4.0 follows Track C: Memory-explorer UX bridge.
- Report UX work is in scope only when it directly improves memory/session/compaction reading.
- Generic report polish is deferred to 0.4.1.
- Behavior evaluation remains deferred and is not part of 0.4.0 or automatically part of 0.4.1.

## Delivered 0.4.0 scope

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-session-memory-explorer.md` | Safe memory-flow grouping from existing redacted trace records. |
| M2 | Done | `m2-richer-report-ux.md` | Static memory-flow/record anchors, links, backlinks, and role highlights. |
| M3 | Done | `m3-memory-explorer-integration.md` | Cohesive memory-flow explorer framing, safety wording, and release-shape review. |

## Release notes

0.4.0 delivered a memory-explorer UX bridge without changing Agent Lens capture defaults:

- Memory-flow groups link context-before, compaction preparation/result, context-after, and provider-after records where available.
- Relationships are labeled as observed, nearby observed, inferred, or missing.
- Reports show partial metadata-only wording to avoid implying full session reconstruction.
- Memory-flow cards link to observable-log rows, and related rows link back with role labels and highlights.
- The trace summary compaction card links to the first memory-flow group when one exists.
- Provider-after cards show the next observed provider request after compaction as inferred from event order.
- No raw capture, browser storage, dependencies, server, or network behavior was added.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke was approved on 2026-06-09.
