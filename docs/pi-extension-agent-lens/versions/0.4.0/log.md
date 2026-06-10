# Agent Lens 0.4.0 log

## 2026-06-07

- Opened 0.4.0 planning after 0.3.0 release sealing and package-scoped tag push.
- Planning focus requested by user: roadmap item 2 (`Session memory explorer`) and item 5 (`Richer report UX beyond static-file improvements`).
- Initial framing defines three tracks: memory first, report UX first, or a memory-explorer UX bridge.
- Corrected earlier draft that mistakenly framed item 4 (`Behavior evaluation views`) as in-scope; behavior evaluation is deferred again unless explicitly re-scoped.
- User approved Track C: Memory-explorer UX bridge for 0.4.0.
- Created 0.4.1 placeholder for generic report UX polish and other deferred 0.4.x follow-ups; raw capture, behavior evaluation, server mode, and full eval/replay remain separate product decisions rather than automatic 0.4.1 scope.
- Deepened M1 planning into a concrete memory-flow foundation: existing evidence inventory, proposed `contextBefore -> preparation -> result -> contextAfter -> providerAfter` model, confidence labels, metadata gaps, and safety wording.
- Deepened M2 planning into concrete static report UX primitives: deterministic anchors, related-record links, memory-flow backlinks, highlighting attributes, minimal JavaScript boundaries, and acceptance criteria.
- Safety stance remains unchanged: read-only by default, local artifacts, no raw private content capture by default, no mutation of pi behavior.

## 2026-06-09

- Followed up 0.4.0 M2 planning by resolving report-UX open questions: quiet visible memory-flow backlinks, required static anchors, optional no-storage/no-network navigation JavaScript, no density toggle in M2, summary-card links only when memory flows exist, and cautious inferred provider-after wording.
- Added an implementation sequence, likely file touchpoints, final acceptance criteria, verification commands, and status-tracking steps to `m2-richer-report-ux.md`.
- Started M2 implementation. Proceeding with a narrow M1/M2 overlap by extending the existing session/compaction explorer contract with record indexes, confidence labels, and provider-after metadata needed for report navigation; M1 remains the conceptual model owner.
- Completed the automated M2 implementation path while leaving the milestone `In progress` pending manual smoke/M1-M3 integration review. Added static memory-flow anchors, record anchors, segment-to-record links, observable-log backlinks/highlights, inferred provider-after cards, and summary-card entry links without new capture hooks or browser storage. Verification passed: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and `npm run typecheck`.
- User approved M2 manual smoke. Marked M2 `Done`; M3 remains proposed for cohesive integration/release-shape review.
- Started M3 memory explorer integration and release-shape review. Scope is limited to cohesive memory-flow report framing, helper-contract tests, M1/M2 status reconciliation, and manual-smoke evidence; no new capture hooks or raw content rendering.
- Completed M3 automated implementation path: report section now presents `Memory flow explorer` with partial metadata-only safety wording, safe cards for what stayed recent / became summary metadata / next observed provider request, and helper-level tests for record indexes, confidence labels, provider-after linking, missing segments, and raw-summary redaction. Reconciled M1 as `Done` via the implemented helper contract. Verification passed: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and `npm run typecheck`. M3 remains `In progress` pending manual smoke evidence.
- User approved M3 manual smoke. Marked M3 `Done`; all planned 0.4.0 milestones are now done and the next step is release prep/sealing.
- Sealed v0.4.0 as a local package release. Updated package metadata/lockfile to `0.4.0`, added changelog notes, updated README/docs/archive/release policy, and ran release verification. No publish or tag was created.
