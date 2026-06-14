# Agent Lens 0.4.1 log

## 2026-06-14

- Opened active 0.4.1 planning after user selected the report UX polish path.
- Framed 0.4.1 around static/local report ergonomics on top of the sealed 0.4.0 memory-flow release.
- Proposed candidate milestones: index sorting/filtering/search, per-trace navigation/density refinements, and optional metadata-only trace comparison.
- Safety stance remains unchanged: local-only static reports, no raw capture by default, no mutation of pi behavior, no external services, and no local server unless explicitly re-scoped.
- Created `plan-spec.md` as the version-level planning gate before implementation.
- Started M1 implementation for multi-trace index sorting/filtering/search. Scope remains limited to static/local report controls over existing metadata.
- Completed M1 implementation: `/agent-lens index` now renders static local controls for search, active/event/report filtering, metadata sorting, row metadata, stable missing values, and an empty-state message. Verification passed: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck`. Static smoke generated an index in a temporary artifact root and confirmed controls/metadata without creating repo artifacts.
- Started M2 implementation for per-trace report navigation and density refinements. Scope remains limited to static/local report UX over existing redacted metadata.
- User requested continuing until all milestones are complete and doing final manual smoke themselves. M3 is accepted for 0.4.1. Stop condition: complete automated implementation and verification for M2/M3, then stop before sealing/release so the user can run final manual smoke.
- Started M3 implementation for metadata-only trace comparison.
- Completed automated M2 implementation: per-trace reports now include section navigation, stable section IDs, observable-log visible counts, and density controls while preserving existing memory-flow safety wording, links/backlinks, filters, search, and expandable details.
- Completed automated M3 implementation: added `/agent-lens compare` and `.pi-agent-lens/compare.html` metadata-only comparison over local traces with report links, missing-field labels, and no evaluative claims.
- Verification passed after M2/M3: `npm test --workspace @gregho/pi-extension-agent-lens`, `npm run typecheck --workspace @gregho/pi-extension-agent-lens`, `npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens`, and root `npm run typecheck`. Awaiting user final manual smoke before sealing 0.4.1.
- User completed final manual smoke for 0.4.1. Marked M2 and M3 `Done`; all planned 0.4.1 milestones are now done.
- Sealed v0.4.1 as a local package release. Updated package metadata/lockfile to `0.4.1`, converted changelog `Unreleased` notes to a dated 0.4.1 section, updated README/docs/archive/release policy, and ran release verification. No publish or tag was created.
