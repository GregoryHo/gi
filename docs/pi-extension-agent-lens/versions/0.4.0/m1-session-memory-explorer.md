# M1 — Session memory explorer foundation

## Status

Done. Implemented through the `buildCompactionExplorer` memory-flow helper contract during the M2/M3 integration path.

## Motivation

0.3.0 made compaction metadata visible, but users still need help understanding how session memory evolves across a run:

- What was summarized?
- What stayed as recent context?
- Which session entry boundary did compaction keep?
- Did a later provider request include a compaction summary?
- What can Agent Lens safely say without pretending to reconstruct the full private session tree?

This milestone defines the safe memory-flow model for 0.4.0. It should use Agent Lens JSONL records first, add only redacted metadata if necessary, and avoid direct raw session-content reading.

## Existing 0.3.0 evidence

Agent Lens already records enough metadata for a partial memory-flow view:

### `context`

Current data:

- `messages.count`
- `messages.roleCounts`
- `messages.contentChars`
- `messages.hasCompactionSummary`
- `messages.toolCallNames`
- `messages.toolResultNames`

Useful for:

- before/after context snapshot cards;
- detecting whether the next context includes a compaction summary;
- showing role/message count changes around compaction;
- showing tool activity in retained context.

Limitations:

- no session entry IDs;
- no direct link to which messages were retained;
- no raw text, intentionally.

### `session_before_compact`

Current data:

- `branchEntryCount`
- `preparation.firstKeptEntryId`
- `preparation.isSplitTurn`
- `preparation.tokensBefore`
- `preparation.previousSummary.length/hash`
- `preparation.messagesToSummarize` summary
- `preparation.turnPrefixMessages` summary
- compaction settings and file op counts

Useful for:

- `What became summary` card;
- `What stayed recent` boundary via `firstKeptEntryId`;
- explaining token pressure before compaction;
- showing split-turn and settings metadata.

Limitations:

- `messagesToSummarize` and `turnPrefixMessages` are aggregate summaries, not entry-by-entry lineage;
- no IDs for all summarized entries;
- no raw previous summary.

### `session_compact`

Current data:

- `compaction.id`
- `compaction.parentId`
- `compaction.firstKeptEntryId`
- `compaction.tokensBefore`
- `compaction.summary.length/hash`
- `compaction.detailKeys`
- `fromExtension`

Useful for:

- compaction result identity;
- parent/kept boundary metadata;
- summary fingerprint;
- linking preparation/result by run index and nearby timestamp.

Limitations:

- summary content is intentionally not available;
- `detailKeys` show shape only;
- parent linkage is not enough for full branch tree reconstruction.

### `before_provider_request`

Current data:

- provider payload shape;
- model;
- input/message counts and roles;
- tool count;
- system/instructions length.

Useful for:

- `What the next request likely saw` card;
- showing whether provider payload size/shape changed after compaction;
- linking post-compaction memory flow to the next model request.

Limitations:

- no raw provider content;
- provider input roles/counts may not map one-to-one to session messages.

## Proposed memory-flow model

Represent each memory flow as a group around a compaction event:

```text
contextBefore? -> preparation? -> result? -> contextAfter? -> providerAfter?
```

Each relationship has a confidence label:

- **Observed** — explicit data in a record, e.g. `firstKeptEntryId`, `tokensBefore`, `summary.length`.
- **Nearby observed** — same run and nearest event before/after by timestamp/order, e.g. nearest context before compaction.
- **Inferred** — plausible relationship from event order, e.g. next provider request likely saw the post-compaction context.
- **Missing** — metadata unavailable; show partial-view message.

## Candidate display

### Memory flow timeline

Show a compact timeline per compaction:

1. Before context snapshot.
2. Compaction preparation.
3. Compaction result.
4. After context snapshot.
5. Next provider request.

Each segment should show whether the relationship is observed, nearby observed, inferred, or missing.

### What stayed recent

Use safe metadata only:

- first kept entry ID;
- turn-prefix message count;
- role counts from `turnPrefixMessages`;
- context-after message count and role counts;
- compaction summary present/not present in after context.

### What became summary

Use safe metadata only:

- messages-to-summarize count;
- role counts from `messagesToSummarize`;
- tokens before compaction;
- previous summary fingerprint if present;
- new summary length/hash.

### What the next request likely saw

Use safe metadata only:

- nearest provider request after compaction;
- model;
- input/message count and role counts;
- tool count;
- instructions/system length;
- cautious wording: `next observed provider request after compaction`, not guaranteed causal reconstruction.

## Metadata gap assessment

M1 should first try to render from existing records. If that is insufficient, possible redacted metadata additions for a later milestone include:

- record index anchors for related events;
- context snapshot ID or sequence number;
- provider request sequence number;
- session/branch ID if exposed safely by pi hooks;
- summarized-entry count by session entry type if available without content.

Do not add raw session reading in M1.

## Non-goals

- Raw compaction summary rendering.
- Raw session message rendering.
- Direct session-file reading in M1.
- Full branch tree reconstruction.
- Mutating session entries.
- Changing compaction behavior.
- Generic report UX polish unrelated to memory flow.

## Safety notes

Prefer IDs, counts, roles, hashes, timestamps, booleans, and record indexes over content.

The UI must avoid claims like:

- `the model forgot X`;
- `these exact messages were removed`;
- `this provider request definitely used this context`.

Preferred wording:

- `messages summarized by metadata`;
- `first kept entry boundary`;
- `nearest context after compaction`;
- `next observed provider request after compaction`;
- `inferred from event order`.

## Acceptance criteria

Implemented status:

- Done: a pure helper builds memory-flow groups from existing JSONL records.
- Done: each present segment has a confidence label: observed, nearby observed, or inferred; missing segments render clear partial-view messaging.
- Done: no raw message/session/provider/summary content is rendered.
- Done: tests cover grouping, next-provider linking, missing metadata, record indexes, confidence labels, and redaction safety.

## Verification draft

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should use a trace with compaction and confirm the memory flow is useful without implying full session reconstruction.
