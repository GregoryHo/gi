# API behavior audit v0.1.1 log

Append-only product/change history for the v0.1.1 planning and implementation cycle.

## 2026-05-29

- Started v0.1.1 planning for workspace-aware path resolution after identifying that extension defaults can read/write `.pi-api-audit-runs` under the extension monorepo instead of the user's active pi workspace.
- Chosen direction: resolve mutable API audit paths from pi `ctx.cwd`, prefer Git root when available, and keep packaged schemas/default scenario dictionary package-relative.
- Started v0.1.1 M1 workspace path resolution on branch `feature/api-behavior-audit-v0.1.1-path-fix`. Scope is limited to resolving mutable runtime paths under the user's pi workspace root while keeping package assets package-relative.
- Completed v0.1.1 M1 workspace path resolution. Added `src/workspace-paths.ts`, resolved command/tool path-like inputs from pi `ctx.cwd` with Git-root preference, kept bundled assets package-relative, surfaced artifact dir in target preparation, and documented path defaults in README. Verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started v0.1.1 M2 release prep. Scope is limited to package version/changelog updates, docs sealing, and release verification; no publish or tag without explicit approval.
- Completed v0.1.1 M2 release prep and sealed v0.1.1 as a local package release. Updated package metadata/lockfile to `0.1.1`, added changelog notes, indexed sealed docs in `archive.md`, updated release policy, and ran release verification: package version check, package test/typecheck/pack dry run, and root typecheck. No publish or tag was created.
- Added v0.1.1 follow-up before publish/tag: removed runtime package scenario fallback. Scenario dictionaries are now workspace/repo-owned, conventionally `.pi-api-audit-runs/scenarios.local.json`; package account-activity data remains only as an example fixture. `api_audit_list_scenarios` now reports no workspace dictionary instead of returning package `account-activity-basic`.
