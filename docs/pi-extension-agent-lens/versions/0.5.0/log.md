# Agent Lens 0.5.0 log

## 2026-06-25

- Opened active 0.5.0 planning after user selected backlog areas: additional report UX polish, full/partial session branch topology, and multi-agent swimlane/race views.
- Chosen direction: **Multi-agent swimlane + topology foundation**.
- Chosen track: **Balanced bridge** — M1 safe topology model, M2 swimlane timeline, M3 partial topology explorer.
- Chosen data strategy: **Hybrid** — start with existing trace metadata; M1 decides whether minimal new redacted metadata capture is needed.
- Chosen worker/agent metadata strategy: **M1 decide** — do not pre-commit to new worker/agent capture fields before evidence inventory.
- Safety stance remains unchanged: static/local-first reports, metadata-only by default, no raw content capture, no mutation of pi behavior, and no full session reconstruction claims.
- Started M1 implementation for safe topology model and evidence inventory. Scope is limited to a tested pure helper and docs evidence/gap analysis; no report UI or capture hooks are planned for M1.
- Completed M1: added `report-topology` pure helper and tests for metadata-only topology nodes, lane hints, relationships, confidence labels, missing worker/session topology metadata, and raw-content exclusion. Evidence inventory found existing metadata is sufficient for an initial swimlane pass; no new metadata capture is proposed. Verification passed: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck`.
- Started M2 implementation for a static report swimlane timeline using the M1 topology/lane model.
- Completed M2: `/agent-lens report` now includes a static metadata-only swimlane timeline with main-agent, provider, tools, memory, and worker/teammate unavailable lanes. Swimlane cards are generated from the M1 topology model and link back to observable-log records. Verification passed: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck`.
- Started M3 implementation for a partial topology explorer using M1 relationships and M2 swimlane anchors.
- Completed M3: `/agent-lens report` now includes a static partial topology explorer generated from the M1 topology model. Relationship cards show confidence labels, link to M2 swimlane node anchors and observable-log records where available, and include partial metadata-only safety wording. No full session reconstruction, raw capture, server mode, network behavior, dependencies, or frontend build step were introduced.
- Final automated 0.5.0 verification passed: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck`. M1/M2/M3 automated implementation is complete.
- Static smoke completed for report/index/compare generation in a temporary artifact root. Verified swimlane timeline, partial topology explorer, topology-to-swimlane/record links, missing worker metadata wording, index controls/report links, compare metadata, and raw summary text exclusion.
- Sealed v0.5.0 as a local package release. Updated package metadata/lockfile to `0.5.0`, converted changelog notes to a dated 0.5.0 section, updated README/docs/archive/release policy, and ran release verification. No publish or tag was created.
