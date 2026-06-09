# M1 — Session memory explorer discussion

## Status

Proposed.

## Motivation

0.3.0 made compaction metadata visible, but users still need help understanding how session memory evolves across a run:

- What was summarized?
- What stayed as recent/raw session context?
- Which session entry boundary did compaction keep?
- Did a later provider request include a compaction summary?
- How did branch/session metadata affect what the agent saw?

This milestone explores how far Agent Lens can answer those questions from safe, existing, read-only metadata.

## Candidate scope

- Add a deeper session/memory report section.
- Link existing compaction records to session-entry boundary metadata where available.
- Show before/after context snapshots around compaction with message counts, roles, summary presence, and kept-entry IDs.
- Show session/branch identifiers only when safely available as metadata.
- Distinguish observed facts from inferred relationships.

## Candidate display

- `Memory flow` timeline:
  - context snapshot;
  - compaction preparation;
  - compaction result;
  - next provider request/context snapshot.
- `What stayed recent` card:
  - kept entry ID;
  - recent message count;
  - role counts;
  - tool-call/result counts if summarized.
- `What became summary` card:
  - summary length;
  - summary hash;
  - tokens before compaction;
  - no raw summary text.
- `What the next request likely saw` card:
  - context message count;
  - compaction summary present/not present;
  - provider payload shape metadata.

## Open questions

1. Does pi expose enough session-entry metadata through current hooks/traces, or does Agent Lens need to add more redacted metadata capture?
2. Should this feature read pi session files directly, or only use Agent Lens JSONL records?
3. If direct session reading is allowed, how do we prevent accidental raw session-content rendering?
4. Should branch/session navigation be a 0.4.0 feature or deferred until lineage metadata is clearer?
5. What language should the report use when relationships are inferred rather than directly observed?

## Non-goals

- Raw compaction summary rendering.
- Raw session message rendering.
- Full branch tree reconstruction unless metadata is already safe and reliable.
- Mutating session entries.
- Changing compaction behavior.

## Safety notes

Prefer IDs, counts, roles, hashes, timestamps, and booleans over content. Any direct session-file reading must be treated as higher risk than JSONL-derived reporting and should require its own acceptance criteria.

## Acceptance criteria draft

If implemented, this milestone should satisfy:

- Report distinguishes observed memory facts from inferred relationships.
- No raw message/session/summary content is rendered.
- Empty or incomplete metadata produces clear partial-view messaging.
- Tests cover safe extraction, missing metadata, and redaction safety.

## Verification draft

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should use a trace with compaction and confirm the memory flow is useful without implying full session reconstruction.
