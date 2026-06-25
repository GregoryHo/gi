# Agent Lens 0.5.0 plan and spec

## Status

Planning only. Implementation must not start until an accepted milestone is marked `In progress`.

## Assumptions

- 0.5.0 builds on the sealed `0.4.1` local report UX and metadata-only comparison release.
- Agent Lens remains read-only with respect to pi behavior.
- Reports remain static/local-first unless explicitly re-scoped.
- Existing redacted JSONL trace metadata is the first data source.
- New redacted metadata capture is allowed only after M1 documents a specific gap and a minimal safe field list.
- No raw prompt, provider payload, tool output, session entry content, or compaction summary content is captured or rendered.

## Product spec

0.5.0 should make complex agent activity legible across time and relationships.

The user should be able to:

1. see agent/tool/provider/memory activity arranged as lanes in a single trace report;
2. distinguish main-agent, worker/teammate, tool, provider, and memory activity where metadata supports it;
3. inspect partial topology relationships between agents, sessions, branches, compactions, provider requests, and tools;
4. understand which relationships are observed, inferred, or missing;
5. avoid being misled into thinking Agent Lens has reconstructed the full private session tree.

## Proposed implementation plan

### Phase 0 — Planning gate

- Keep all milestones `Proposed` until work begins.
- Before coding a milestone, update `milestones.md` and `log.md` according to that milestone's status-tracking section.
- If M1 proposes new metadata capture, document the exact fields and safety rationale before implementation.

### Phase 1 — M1 safe topology model and evidence inventory

Implement first because swimlane and topology views need a stable data contract.

Success criteria:

- Existing trace metadata is inventoried for agent/session/tool/provider/memory relationships.
- A safe topology model defines entities, relationships, lane hints, confidence labels, and missing-data behavior.
- Any proposed new metadata fields are minimal, redacted, and explicitly justified.
- Tests cover the pure helper contract before report rendering depends on it.

Plan doc: `m1-safe-topology-model.md`.

### Phase 2 — M2 swimlane timeline view

Implement after M1 because lane assignment should use the M1 model.

Success criteria:

- `/agent-lens report` includes a static swimlane timeline view.
- Lanes are generated from existing/M1-approved metadata.
- Swimlane cards link back to observable-log records and preserve existing report navigation.
- Missing worker/agent metadata is represented as unavailable rather than guessed.

Plan doc: `m2-swimlane-timeline.md`.

### Phase 3 — M3 partial topology explorer

Implement after M2 because topology navigation should reuse the M1 model and M2 anchors.

Success criteria:

- `/agent-lens report` includes a partial topology explorer.
- Relationships show observed/inferred/missing confidence labels.
- Topology nodes link to swimlane and observable-log records where available.
- Safety wording clearly avoids full session reconstruction claims.

Plan doc: `m3-partial-topology-explorer.md`.

## Final AC and stop condition

0.5.0 implementation is complete when:

- accepted M1/M2/M3 code and tests are implemented;
- README, changelog, package metadata, and version docs reflect the new report capabilities;
- full verification baseline passes;
- user manual smoke passes;
- release/sealing docs are updated.

Stop before sealing if:

- M1 identifies missing metadata that needs product approval before capture;
- any implementation would require raw content capture;
- the design starts implying full session branch reconstruction;
- static/local report constraints become insufficient and local server mode is being considered.

## Verification baseline

Run after any implementation milestone:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should cover:

- `/agent-lens report` swimlane/topology sections;
- `/agent-lens index` links to generated reports;
- `/agent-lens compare` still works after topology metadata changes;
- no raw private content appears in generated reports.
