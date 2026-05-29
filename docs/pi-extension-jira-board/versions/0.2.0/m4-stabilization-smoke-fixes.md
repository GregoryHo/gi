# M4 plan — Stabilization and smoke-test fixes

## Status

Done.

## Objective

Stabilize v0.2.0 after the M1-M3 feature milestones and before release preparation. This milestone captures manual smoke-test findings, fixes bugs and UX inconsistencies, and decides what should be deferred.

## Context

M1-M3 added onboarding, encrypted local config, project/issue queries, interactive browsing, current/focused context bridge, cockpit consolidation, board picker, Scrum active sprint scope, and Kanban saved filter scope.

Before packaging/release prep, user manual testing surfaced additional issues that should be addressed in-version rather than folded into release prep.

The original release-prep milestone is moved from M4 to M5.

## Scope

M4 includes:

1. Record user-reported smoke-test issues.
2. Fix bugs discovered during manual testing.
3. Improve small UX inconsistencies discovered during manual testing.
4. Add regression tests where practical.
5. Update README/CHANGELOG/docs when behavior changes.
6. Explicitly defer any findings that are too large or unsafe for v0.2.0.

## Non-goals

- New major Jira capabilities.
- New Jira write behavior.
- Relaxing write confirmation requirements.
- Package/release prep; moved to M5.
- Broad refactors unrelated to reported stabilization issues.

## Issue log

Add findings here before implementation:

| ID | Finding | Decision | Status |
| --- | --- | --- | --- |
| M4-1 | Fix Version metadata can be very large, but facet selection currently has no paging and no recency-first ordering. | Added paged facet metadata picker and project version recency sorting. | Done |
| M4-2 | Assignee facet currently aggregates only assignees present in the current issue page, so many users are missing. | Added typed Jira assignable-user search and paged picker; no matches are reported clearly. | Done |
| M4-3 | Issue Type facet currently aggregates only issue types present in the current issue page, so Sub-task and other types may be missing from the picker. | Added project issue type metadata lookup via `/project/{key}/statuses`; Issue Type facet no longer depends on current page aggregation. | Done |
| M4-4 | Status category scope is visible in the filter summary, but switching between not done/all/done is too hidden under the generic filter menu. | Added explicit `s status` action in `/jira-issues` to switch not done/all/done. | Done |
| M4-5 | Assignee typed search returns unrelated users even for exact usernames such as `gregory_ho`. | Switched assignable-user lookup to Jira Server/DC `username` parameter and added client-side ranking for exact/prefix/fuzzy-like matches. | Done |
| M4-6 | Jira runtime context can accumulate project/board/filter/focused issue state with no quick reset command. | Added `/jira-clear` to clear active Jira project, board, filters, and focused issue context without removing Jira URL/user/token configuration. | Done |

## AC

M4 is complete when:

1. User-reported stabilization findings are fixed or explicitly deferred with reason.
2. Fixed behaviors have regression tests where practical.
3. No new unsafe Jira write behavior is introduced.
4. Jira context/cockpit behavior remains consistent.
5. Automated verification passes.
6. User manually verifies the stabilization fixes.
7. M5 release prep can start.

## Verification

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Manual smoke:

- Re-run user-reported failing scenarios.
- Confirm fixed/deferred status for each M4 issue.

Result: user reported all M4 manual tests accepted.
