# M1 — Safe topology model and evidence inventory

## Status

Done.

## Motivation

0.4.x made memory flow and trace reports more legible, but 0.5.0 needs a safe model for relationships before adding swimlanes or topology views.

Users need to know:

- which records belong to the same main agent run;
- whether worker/teammate activity is observable;
- how tools, provider requests, compaction events, and context snapshots relate;
- which relationships are observed, inferred, or unavailable;
- what Agent Lens cannot safely reconstruct.

## SPEC

### Scope

Define a pure helper contract for a metadata-only topology model:

- inventory existing trace records and fields relevant to topology:
  - run/turn indexes;
  - event order and timestamps;
  - provider request metadata;
  - tool call/result metadata;
  - context snapshot metadata;
  - compaction preparation/result metadata;
  - any existing worker/agent/session/branch metadata if present;
- define topology entities, likely including:
  - trace;
  - run;
  - turn;
  - agent lane;
  - tool activity;
  - provider request;
  - context snapshot;
  - compaction/memory event;
  - session/branch marker where safely observable;
- define relationship kinds, likely including:
  - contains;
  - precedes/follows;
  - triggered-by;
  - summarizes;
  - retains-after;
  - next-provider-after;
  - parent/child agent where observable;
- define confidence labels:
  - observed;
  - nearby observed;
  - inferred;
  - missing/unavailable;
- define lane assignment rules for M2;
- document metadata gaps and decide whether minimal new redacted capture is needed.

### Non-goals

- No report rendering beyond minimal test fixtures if needed.
- No raw content capture or rendering.
- No full session branch tree reconstruction.
- No behavior evaluation or scoring.
- No multi-trace topology comparison.
- No local server/WebSocket mode.

### Design notes

- Prefer pure helpers under package code so M2/M3 can reuse the contract.
- Missing worker/agent metadata should produce explicit unavailable/missing topology state rather than guessed lanes.
- If new metadata capture is proposed, M1 must document exact fields, event source, redaction behavior, and why existing metadata is insufficient.
- Keep relationship language conservative and avoid implying causality unless explicitly observed.

### Expected files

Likely touchpoints, subject to implementation discovery:

- `packages/pi-extension-agent-lens/src/report-topology.ts` or equivalent pure helper module.
- `packages/pi-extension-agent-lens/src/report-topology.test.ts`.
- Existing summarizer/trace modules only if M1 approves minimal new metadata capture.
- `docs/pi-extension-agent-lens/versions/0.5.0/*` status/log updates.

## AC

Acceptance criteria:

- A tested pure topology/lane model exists.
- Existing evidence inventory is documented in completion notes.
- Confidence labels distinguish observed, nearby observed, inferred, and missing/unavailable relationships.
- Missing worker/agent/session/branch metadata is represented safely.
- If new metadata capture is needed, the proposed fields are explicitly documented and approved before implementation proceeds.
- No raw content capture or report rendering is introduced by M1.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual review:

1. Inspect the evidence inventory and gap analysis.
2. Confirm any proposed new metadata fields are safe, minimal, and necessary.
3. Confirm M2/M3 can proceed without ambiguous relationship claims.

## Completion notes

Implemented a pure metadata-only topology helper:

- `packages/pi-extension-agent-lens/src/report-topology.ts`
- `packages/pi-extension-agent-lens/src/report-topology.test.ts`

The helper builds:

- topology nodes for trace, run, turn, context snapshot, provider request, tool activity, compaction preparation/result;
- lane hints for trace, main-agent, tools, provider, memory, worker-agent, and unknown;
- relationships for contains, triggered-by, summarizes, retains-after, parent-child-agent, and branch-lineage;
- confidence labels for observed, nearby observed, inferred, and missing;
- explicit gaps for worker metadata and session branch topology.

### Evidence inventory

Existing trace metadata is enough for a first M2 swimlane pass:

- **Run/turn grouping:** `runIndex` and `turnIndex` appear on lifecycle records and can produce main-agent run/turn nodes.
- **Event order:** record index and timestamp support conservative time ordering and nearby/inferred relationships.
- **Provider activity:** `before_provider_request` payload summaries expose model, input/message counts, input roles, and tool count without raw payload content.
- **Tool activity:** context and turn summaries expose tool call/result names and counts without raw tool output.
- **Context snapshots:** context summaries expose message counts, role counts, tool metadata, and compaction-summary presence.
- **Compaction/memory:** compaction preparation/result summaries expose token counts, first-kept boundary, branch entry count, summary length/hash, and detail keys without raw summary text.

### Gap analysis

Current metadata is intentionally partial:

- **Worker/teammate relationships:** no reliable worker/agent IDs, parent-run IDs, or lane hints are currently observed in Agent Lens trace records.
- **Full branch topology:** `firstKeptEntryId` and `branchEntryCount` provide boundary metadata, but not a complete session branch tree.
- **Causality:** provider/tool relationships are often inferred or nearby observed from event order, not explicit causality.

### Metadata-capture decision

No new metadata capture is proposed for M1.

M2 can proceed using existing metadata with these constraints:

- render main-agent, tools, provider, and memory lanes from existing records;
- show worker/teammate lane metadata as unavailable unless future traces expose safe worker/agent IDs;
- keep full session branch topology unavailable/partial rather than reconstructing it;
- preserve observed/inferred/missing labels in M2/M3 UI.

Automated verification completed on 2026-07-11:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

## Status tracking

At milestone start:

1. Update `versions/0.5.0/milestones.md` M1 to `In progress`.
2. Append a short start entry to `versions/0.5.0/log.md`.

At milestone completion:

1. Run verification listed above.
2. Update M1 to `Done`.
3. Add completion notes here, including evidence inventory and metadata-capture decision.
4. Append verification/manual-review evidence to `versions/0.5.0/log.md`.
