# Jira board extension v0.2.0 log

Append-only planning and implementation history for v0.2.0.

## 2026-05-22 — v0.2.0 planning started

Context:

- v0.1.0 is complete and tagged.
- User wants v0.2.0 to focus on onboarding and widget/navigation improvements.
- Env-only Jira setup is considered too hard to use.

Decisions:

- Add `/jira-onboarding` as the setup command name.
- Do not use OS-specific secret stores for v0.2.0.
- Use simple reversible encryption for local Jira password/token storage.
- Do not store password/token in plaintext config.
- Keep env vars as overrides for compatibility.
- Upgrade project/issue querying with filter and paging.
- Evolve the widget toward compact card/item layouts.

Next:

- Create detailed M1 implementation plan before code changes.

## 2026-05-22 — M1 started

Context:

- M1 starts from the v0.2.0 planning branch.
- Scope is `/jira-onboarding` plus encrypted local config.

Outcome:

- Added detailed M1 implementation plan.
- Marked M1 as in progress.

Next:

- Implement M1 with TDD before production code changes.

## 2026-05-22 — M1 completed

Context:

- M1 implemented `/jira-onboarding` and encrypted local config.
- Implementation used TDD: tests were added and observed failing before adding production code.

Outcome:

- Added AES-256-GCM secret encryption helpers.
- Added local config and encrypted secret storage under `~/.pi/agent/jira-board/`.
- Added config fallback from env vars to encrypted local config.
- Added `/jira-onboarding` with masked secret input and connectivity validation before save.
- Updated package metadata, README, and changelog.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 58 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 18 files.

Notes:

- Manual `/jira-onboarding` smoke test was later reported by the user as working.

Next:

- Plan M2 project and issue query primitives before code changes.

## 2026-05-22 — M2 started

Context:

- M1 onboarding was completed and smoke-tested.
- M2 focuses on read-only project/issue query primitives for future browse UI and widget work.

Outcome:

- Added detailed M2 implementation plan.
- Marked M2 as in progress.

Next:

- Implement M2 with TDD before production code changes.

## 2026-05-22 — M2 completed

Context:

- M2 implemented read-only project and issue query primitives.
- Implementation used TDD: tests were added and observed failing before adding production code.

Outcome:

- Added project query primitives with case-insensitive filtering and bounded paging.
- Added `jira_search_projects` tool.
- Added `startAt` paging support to `jira_search_issues`.
- Updated package metadata, README, and changelog.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 65 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 19 files.

Notes:

- Manual smoke test was later reported by the user as working: `jira_search_projects`, project paging, and `jira_search_issues` with project/fixVersion/component filters.

Next:

- Plan M3 interactive browse UI and widget cards before code changes.

## 2026-05-22 — M3 started

Context:

- M2 query primitives were completed and smoke-tested.
- M3 focuses on interactive project/issue browsing and compact widget cards.

Outcome:

- Added detailed M3 implementation plan.
- Marked M3 as in progress.

Next:

- Implement M3 with TDD before production code changes.

## 2026-05-22 — M3 completed

Context:

- M3 implemented interactive project/issue browsing and compact widget cards.
- Implementation used TDD: tests were added and observed failing before adding production code.

Outcome:

- Added `/jira-projects [query]` interactive project browser.
- Added `/jira-issues [jql]` interactive issue browser.
- Added reusable paged picker component helpers.
- Added session-local selected project state for issue browsing.
- Added compact project and issue card widget formatting.
- Updated package metadata, README, and changelog.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 72 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 20 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Plan M4 docs, polish, and release prep before release changes.

## 2026-05-22 — M3.1 planned

Context:

- User reviewed M3 UX and identified two issues:
  - `/jira-projects` selection should apply as the active/default project so autocomplete and defaults work.
  - `/jira-issues` should not require normal users to type raw JQL.

Outcome:

- Added M3.1 as a planned UX polish milestone before M4.
- Planned active project runtime context.
- Planned guided issue filters with raw JQL as advanced mode.

Next:

- Start M3.1 implementation when ready, then return to M4 release prep.

## 2026-05-22 — M3.1 started

Context:

- M3.1 starts after user approved the active project context and guided issue filter plan.

Outcome:

- Marked M3.1 as in progress.

Next:

- Implement M3.1 with TDD before production code changes.

## 2026-05-22 — M3.1 completed

Context:

- M3.1 implemented active project context and guided issue filters.
- Implementation used TDD: tests were added and observed failing before adding production code.

Outcome:

- Added runtime active project context helpers.
- `/jira-projects` now applies selected project as active session context.
- Default issue search, board snapshot, `/jira-refresh`, and autocomplete can use active project before configured project.
- `/jira-issues` supports project shorthand and guided filter prompts.
- Raw JQL remains available via `/jira-issues --jql <JQL>`.
- Updated package metadata, README, and changelog.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 81 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 22 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Plan M4 docs, polish, and release prep before release changes.

## 2026-05-22 — M3 UX design revised

Context:

- User paused implementation to focus on the M3 UX design, which is the most important part of the Jira board extension.
- Discussion clarified that pi widgets should be treated as context display rather than clickable interaction surfaces.
- The current `/jira-issues` guided prompts still require too much user knowledge of Jira fields and values.

Decisions:

- Widget should be a Jira context cockpit: active project, filter summary, issue/page counts, focused issue, and suggested actions.
- Primary interaction should live in `ctx.ui.custom()` browser overlays.
- Issue browser should use faceted filtering: choose filter type, then choose actual value.
- Normal users should not need to write or understand JQL.
- Raw JQL remains an advanced escape hatch.
- First filter value source: project versions/components APIs plus issue result aggregation.
- Full metadata system is documented as optional M3.2 and deferred unless later promoted.

Next:

- Plan revised M3 UX implementation before further code changes.

## 2026-05-22 — Revised M3.1 faceted issue browser started

Context:

- User approved using project versions/components APIs plus issue result aggregation for the first faceted filter implementation.
- Full metadata system remains optional/deferred as M3.2.

Outcome:

- Added revised M3.1 implementation plan for faceted issue browser UX.
- Marked M3.1 as in progress again, replacing the sequential guided prompt approach.

Next:

- Implement revised M3.1 with TDD before production code changes.

## 2026-05-22 — Revised M3.1 faceted issue browser completed

Context:

- Revised M3.1 replaced the sequential guided prompts with faceted issue filtering.
- Implementation used TDD: tests were added and observed failing before adding production code.

Outcome:

- Added project versions/components metadata helpers.
- Added issue-result facet aggregation.
- Added faceted issue filter state and JQL builder.
- `/jira-issues` filter action now lets users choose filter type and then choose actual values.
- `f` and `/` add filters; `c` clears filters.
- Raw JQL remains available through advanced mode.
- Updated package metadata, README, and changelog.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 88 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 24 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Manual smoke test revised M3.1 UX, then proceed to M4 release prep.

## 2026-05-22 — M3.1 focused/current context bridge started

Context:

- User confirmed that current/focused Jira state should not be injected into every LLM turn.
- Session custom entries are acceptable for persisting focused/current state across compaction/reload.
- User also asked whether board should be modeled as a narrowing scope between project and issues.

Decisions:

- Add explicit read-only tools instead of context injection:
  - `jira_get_current_context`
  - `jira_get_focused_issue`
- Model current Jira context as `project > board > issue filters > focused issue`.
- Keep M3.1 board support minimal: configured board id in context, no board picker.
- Add optional M3.3 for board picker and board-scoped browsing.

Outcome:

- Added focused/current context bridge plan.
- Added optional M3.3 board picker plan.
- Marked M3.1 as in progress again for this addendum.

Next:

- Implement focused/current context bridge with TDD.

## 2026-05-22 — M3.1 focused/current context bridge completed

Context:

- M3.1 addendum implemented explicit tools for current/focused Jira state without adding a context hook.
- Implementation used TDD: tests were added and observed failing before production code changes.

Outcome:

- Extended runtime context with active project, issue filter summary, and focused issue metadata.
- Included configured board id in current context when available.
- Persisted context updates with session custom entries using `jira-board-context`.
- Restored context from active branch entries on `session_start`.
- Added `jira_get_current_context` read-only tool.
- Added `jira_get_focused_issue` read-only tool.
- Updated README and CHANGELOG.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 94 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 24 files.

Notes:

- Manual Jira smoke test was not run in this session.
- No automatic Jira context injection was added.

Next:

- Manual smoke test M3.1 focused/current context UX, then proceed to M4 release prep.

## 2026-05-22 — M3.1 manual smoke verified

Context:

- User manually tested several M3.1 scenarios.

Verified:

- Focused issue lookup works through `jira_get_focused_issue`.
- Current Jira context reporting works through `jira_get_current_context`.
- User reported the M3.1 scenarios are working.

Next:

- Proceed to M4 docs, polish, and release prep.

## 2026-05-22 — M3.4 command/cockpit consolidation planned

Context:

- User wants to add one more M3 UX scenario before release prep.
- The current command set and widget behavior have grown organically across M3/M3.1.
- The widget has too many scenario-specific layouts.

Decisions:

- Add M3.4 for command and cockpit consolidation.
- Keep a single Jira context cockpit mental model.
- Render widget in compact or focus mode only for normal states.
- Consolidate command behavior around setup, browse/context, and action categories.
- Do not remove commands abruptly; first consolidate behavior and documentation.

Next:

- Review M3.4 plan, then implement with TDD if approved.

## 2026-05-22 — M3.4 started

Context:

- User approved implementing the command/cockpit consolidation plan.

Outcome:

- Marked M3.4 as in progress.

Next:

- Implement M3.4 with TDD before production code changes.

## 2026-05-22 — M3.4 completed

Context:

- M3.4 consolidated commands and widget output around a single Jira cockpit model.
- Implementation used TDD: cockpit renderer tests were added and observed failing before production code changes.

Outcome:

- Added canonical Jira cockpit renderer with compact/focus modes.
- Added `/jira` command to show the current cockpit.
- Routed `/jira-projects`, `/jira-issues`, `/jira-issue`, `/jira-refresh`, and `/jira-status` widget updates through the cockpit renderer.
- `/jira-issue [KEY]` now sets focused issue context and can reuse the focused issue when no key is provided.
- Focused issue state now retains priority and assignee for focus mode.
- Updated README, CHANGELOG, and package metadata.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 97 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 25 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Manual smoke test M3.4 cockpit UX, then proceed to M4 release prep.

## 2026-05-22 — M3.4 focused issue action fallback started

Context:

- User manually tested M3.4 and found that `/jira-plan`, `/jira-fix`, `/jira-comment`, and `/jira-transition` still require explicit issue keys.
- This is inconsistent with the new focused issue/context cockpit UX.

Decision:

- Add focused issue fallback to issue-scoped action commands.
- Resolution priority: explicit key > focused issue > clear warning.
- Preserve Jira write safety: interactive UI, preview, and confirmation remain required.

Next:

- Implement focused issue action fallback with TDD.

## 2026-05-22 — M3.4 focused issue action fallback completed

Context:

- M3.4 action command fallback was implemented after manual testing identified the UX gap.
- Implementation used TDD: command issue resolver tests were added and observed failing before production code changes.

Outcome:

- Added shared issue-key resolver for command args.
- `/jira-plan` and `/jira-fix` now use focused issue when no key is provided.
- `/jira-comment` and `/jira-transition` now use focused issue when no key is provided.
- Explicit issue key still wins over focused issue.
- Missing explicit/focused issue reports a clear warning.
- Jira write commands still require interactive UI, preview, and confirmation.
- Updated README, CHANGELOG, and package metadata.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 101 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 26 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Manual smoke test action command focused issue fallback, then proceed to M4 release prep.

## 2026-05-22 — M3 board milestones renumbered

Context:

- User wants M3 board work split more explicitly instead of keeping board picker as optional/deferred M3.3.
- Scrum and Kanban board scopes are both considered necessary later work; API uncertainty should be handled by milestone validation, not by avoiding the work.

Decisions:

- Renumber command/cockpit consolidation from M3.4 to M3.3.
- Replace optional board picker bucket with concrete board-scope milestones, later patched to insert a shared board foundation milestone.
- Keep M3.2 full metadata system optional/deferred.

Outcome:

- Renamed M3.4 command/cockpit plan file to M3.3.
- Added initial Scrum/Kanban board scope plans, later renumbered to M3.5/M3.6 after inserting M3.4 board foundation.
- Updated milestone table.

Next:

- Patch board milestones to insert the missing shared board foundation.

## 2026-05-22 — M3 board foundation milestone patched

Context:

- User noticed the previous board split skipped the foundational board work.
- Scrum and Kanban scope milestones should build on shared board picker/context state rather than each owning board selection.

Decisions:

- Add M3.4 Board picker and active board context as the shared board foundation.
- Move Scrum active sprint scope from M3.4 to M3.5.
- Move Kanban saved filter scope from M3.5 to M3.6.

Outcome:

- Added M3.4 board picker/active board context plan.
- Renamed Scrum scope plan to M3.5.
- Renamed Kanban scope plan to M3.6.
- Updated milestone table.

Next:

- Start M3.4 board picker and active board context when ready.

## 2026-05-23 — M3.4 board picker started

Context:

- M3.4 starts after the board foundation milestone was inserted before Scrum/Kanban-specific board scope work.

Outcome:

- Marked M3.4 board picker and active board context as in progress.

Next:

- Implement `/jira-boards` and active board context with TDD.

## 2026-05-23 — M3.4 board picker completed

Context:

- M3.4 implemented the shared board foundation before Scrum/Kanban-specific board scope work.
- Implementation used TDD: board query/context tests were added and observed failing before production code changes.

Outcome:

- Added `/jira-boards [query]` interactive board picker.
- Added Jira Agile board listing/query helpers.
- Added active board runtime context and session persistence.
- Updated cockpit/current context to show active board.
- Registered board command in the Jira extension.
- Updated README, CHANGELOG, and package metadata.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 106 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 27 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Manual smoke test `/jira-boards`, then start M3.5 Scrum board active sprint scope when ready.

## 2026-05-23 — M3.4 manual smoke verified

Context:

- User manually tested M3.4 board picker and active board context behavior.
- User also confirmed active board does not yet affect `/jira-issues`; that remains planned for M3.5/M3.6.

Verified:

- M3.4 manual smoke test passed.

Next:

- Proceed to M3.5 Scrum board active sprint scope when ready.

## 2026-05-23 — M3.5 Scrum active sprint scope started

Context:

- M3.4 board picker and active board context were manually verified.
- User asked to move on to M3.5.

Outcome:

- Marked M3.5 Scrum board active sprint scope as in progress.
- Fixed M3.5 plan references after milestone renumbering.

Next:

- Implement Scrum active sprint issue scope with TDD.

## 2026-05-23 — M3.5 Scrum active sprint scope completed

Context:

- M3.5 implemented the first board-scoped issue browsing behavior on top of M3.4 active board context.
- Implementation used TDD: sprint lookup, sprint-scoped facet JQL, and `/jira-issues` board-scope tests were added and observed failing before production code changes.

Outcome:

- Added shared Jira active sprint lookup helper.
- `/jira-issues` now uses active Scrum board sprint scope when an active sprint exists.
- Faceted issue filters compose with sprint scope.
- Missing/failed active sprint lookup falls back to project scope with a warning.
- Board snapshot active sprint lookup now uses the shared helper.
- Updated README, CHANGELOG, and package metadata.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 112 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 28 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Manual smoke test M3.5 Scrum active sprint issue scope, then proceed to M3.6 Kanban saved filter scope when ready.

## 2026-05-23 — M3.5 manual smoke verified

Context:

- User manually tested M3.5 Scrum active sprint issue scope behavior.

Verified:

- Active Scrum board can scope `/jira-issues` to active sprint.
- User reported manual testing passed.

Next:

- Proceed to M3.6 Kanban board saved filter scope when ready.

## 2026-05-23 — M3.6 Kanban saved filter scope started

Context:

- M3.5 Scrum active sprint scope was manually verified.
- User asked to move on to M3.6.

Outcome:

- Marked M3.6 Kanban board saved filter scope as in progress.
- Fixed M3.6 plan references after milestone renumbering.

Next:

- Implement Kanban saved filter issue scope with TDD.

## 2026-05-23 — M3.6 Kanban saved filter scope completed

Context:

- M3.6 implemented Kanban board-scoped issue browsing on top of M3.4 active board context.
- Implementation used TDD: Kanban API, JQL composition, faceted filter, and `/jira-issues` board-scope tests were added and observed failing before production code changes.

Outcome:

- Added Kanban board configuration and saved filter lookup helper.
- Added safe-enough JQL `ORDER BY` splitter and scoped JQL composer.
- `/jira-issues` now uses active Kanban board saved-filter scope when available.
- Faceted issue filters compose with saved-filter JQL and preserve existing `ORDER BY`.
- Board filter scope is stored on active board context and appears in current context formatting.
- Lookup failures fall back to project scope with a warning.
- Updated README, CHANGELOG, and package metadata.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 121 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 29 files.

Notes:

- Manual Jira smoke test was not run in this session.

Next:

- Manual smoke test M3.6 Kanban saved filter issue scope, then proceed to M4 release prep when ready.

## 2026-05-23 — M3.6 manual smoke verified

Context:

- User manually tested M3.6 Kanban saved filter issue scope behavior.

Verified:

- Active Kanban board can scope `/jira-issues` via saved filter JQL.
- User reported manual testing passed.

Next:

- Proceed to M4 docs, polish, and release prep when ready.

## 2026-05-23 — M4 stabilization milestone inserted

Context:

- User found additional issues during manual testing before package/release prep.
- User wants a new milestone inserted before update/pack work.

Decision:

- Add M4 Stabilization and smoke-test fixes.
- Move original M4 docs/polish/release prep to M5.
- Keep M4 focused on user-reported stabilization findings, regression tests, and explicit deferrals.

Outcome:

- Added M4 stabilization plan.
- Updated milestone table so release prep is now M5.

Next:

- Record specific M4 findings and implement fixes with TDD.

## 2026-05-23 — M4 findings recorded

Context:

- User reported three stabilization findings from manual testing.

Findings:

- M4-1: Fix Version metadata can be very large; facet selection needs paging and recency-first ordering where possible.
- M4-2: Assignee facet currently aggregates only users present in current issue results; it needs typed Jira assignable-user search and a picker.
- M4-3: Issue Type facet currently aggregates only issue types present in current issue results; Sub-task and other issue types may be missing from the picker.

Next:

- Implement M4-1 with TDD, then M4-2 and M4-3.

## 2026-05-23 — M4-1 facet metadata paging completed

Context:

- M4-1 addresses large Fix Version metadata lists and lack of recency-first ordering.
- Implementation used TDD: facet picker paging and project version sorting tests were added and observed failing before production code changes.

Outcome:

- Added reusable paged facet value picker helpers.
- Fix Version facet now uses paged selection instead of a single flat select list.
- Project versions now retain optional release/start/sequence metadata and sort active/newer versions first where possible.
- Added package allowlist entry for the facet picker helper.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 124 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.

Next:

- Implement M4-2 assignee typed Jira user search with TDD.

## 2026-05-23 — M4-2 assignee typed search completed

Context:

- M4-2 addresses Assignee facet values being limited to users present in the current issue result page.
- Implementation used TDD: Jira assignable-user helper tests and `/jira-issues` Assignee facet tests were added and observed failing before production code changes.

Outcome:

- Added Jira assignable-user search helper using `/rest/api/2/user/assignable/search`.
- Assignee facet now prompts for a typed user query.
- Query results are shown in the paged facet picker.
- JQL uses Jira username/name when available.
- Empty query results show a clear error.
- Added package allowlist entry for the user helper.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 129 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.

Next:

- Implement M4-3 Issue Type metadata/search support with TDD.

## 2026-05-23 — M4-3 issue type metadata completed

Context:

- M4-3 addresses Issue Type facet values being limited to the current issue result page, causing Sub-task and other issue types to be missing from the picker.
- Implementation used TDD: project issue type metadata tests and `/jira-issues` Issue Type facet tests were added and observed failing before production code changes.

Outcome:

- Added project issue type metadata helper using `/rest/api/2/project/{projectKey}/statuses`.
- Issue Type facet now uses project metadata instead of current-page aggregation.
- Sub-task can be selected even when the current issue page does not include any subtasks.
- Existing board/sprint/filter scope still determines whether selected issue types return results.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 131 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.

Next:

- Run full verification and request manual M4 smoke test.

## 2026-05-23 — M4-4 status category switch requested

Context:

- User confirmed the status mode is already visible in the filter summary.
- The remaining UX issue is that switching `not done` / `all` / `done` is too hidden under the generic filter flow.

Decision:

- Add an explicit status category switch action to `/jira-issues`.
- Keep the default `not done` behavior.

Next:

- Implement M4-4 with TDD.

## 2026-05-23 — M4-4 status category switch completed

Context:

- User wanted an easier way to switch `/jira-issues` status category between `not done`, `all`, and `done`.
- Implementation used TDD: issue picker status action and `/jira-issues` re-query tests were added and observed failing before production code changes.

Outcome:

- Added `s status` action to the `/jira-issues` picker.
- The action opens a `Status category` selector with `not done`, `all`, and `done`.
- Selecting `all` removes the status category clause from generated JQL.
- Selecting `done` uses `statusCategory = Done`.
- Selecting `not done` keeps the default `statusCategory != Done` behavior.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 133 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.

Next:

- Run full verification and request manual M4 smoke test.

## 2026-05-22 — M3.4 manual smoke verified

Context:

- User manually tested the M3.4 cockpit and focused issue action fallback scenarios.

Verified:

- Cockpit behavior works as expected.
- `jira_get_focused_issue` returned the newly focused issue context.
- Focused issue fallback for action commands was reported working.
- User reported all manual smoke tests pass.

Next:

- Proceed to M4 docs, polish, and release prep.

## 2026-05-24 — M4-5/M4-6 findings recorded

Context:

- User manual testing found Assignee typed search returns unrelated picker results even for precise usernames such as `gregory_ho`.
- User also wants a quick way to clear accumulated Jira runtime context.

Decision:

- M4-5: Use Jira Server/Data Center-compatible assignable-user `username` search parameter and rank results client-side so exact matches appear first.
- M4-6: Add `/jira-clear` to clear active project, board, issue filter summary, and focused issue.

Next:

- Implement M4-5 with TDD, then M4-6 with TDD.

## 2026-05-24 — M4-5 assignee search improved

Context:

- Assignee typed search returned unrelated users even for precise usernames.
- Likely cause was using `query`, while Jira Server/Data Center assignable-user search expects `username`.
- Implementation used TDD: assignable-user path and ranking tests were updated/added and observed failing before production code changes.

Outcome:

- Assignable-user lookup now calls `/rest/api/2/user/assignable/search?project=<key>&username=<query>&maxResults=50`.
- Client-side result ranking now prefers exact username, username prefix, exact display/email, then fuzzy-like display/email matches.
- Normalization treats spaces, dots, underscores, and hyphens similarly for ranking.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 134 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.

Next:

- Implement M4-6 `/jira-clear` with TDD.

## 2026-05-24 — M4-6 Jira clear command completed

Context:

- Jira runtime context can accumulate active project, board, issue filter, and focused issue state.
- User wanted a quick reset command.
- Implementation used TDD: `/jira-clear` command behavior was tested and observed failing before production code changes.

Outcome:

- Added `/jira-clear` command.
- Command clears active Jira project/board/filter/focused issue runtime context and persists an empty Jira context entry in the session branch.
- Jira URL/user/token configuration is not removed.
- UI users receive a `Cleared Jira project/board/issue context` notification and the cockpit widget is refreshed.
- Added package allowlist entry for the clear command helper.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 135 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.

Next:

- Run full verification and request manual M4 smoke test.

## 2026-05-24 — M4 manual smoke accepted

Context:

- User manually tested the M4 stabilization changes.

Verified:

- M4-1 facet metadata paging and version sorting.
- M4-2/M4-5 assignee search flow and ranking.
- M4-3 issue type metadata including Sub-task visibility.
- M4-4 status category switch between not done/all/done.
- M4-6 `/jira-clear` clears project/board/issue context while keeping Jira configuration.

Outcome:

- User reported all manual tests accepted.
- M4 marked Done.

Next:

- Proceed to M5 docs, polish, and release prep.

## 2026-05-24 — M5 release prep started

Context:

- M4 stabilization has passed manual smoke testing.
- User asked to enter M5.

Outcome:

- Added M5 docs, polish, and release prep plan.
- Marked M5 as in progress.
- Updated v0.2.0 index status to reflect release prep.

Next:

- Update package README/CHANGELOG/package metadata and run full release-prep verification.

## 2026-05-24 — M5 release prep completed

Context:

- M5 prepared the Jira board extension package for v0.2.0 release after M1-M4 implementation and manual smoke verification.

Outcome:

- Bumped `@gregho/pi-extension-jira-board` package version to `0.2.0`.
- Updated package `CHANGELOG.md` with the v0.2.0 release entry.
- Updated package `README.md` to describe v0.2.0 scope and `/jira-clear` behavior.
- Confirmed package `files` allowlist includes all runtime source files.
- Marked M5 release checklist complete.

Verification:

- `npm test --workspace @gregho/pi-extension-jira-board` — 135 tests passed.
- `npm run typecheck --workspace @gregho/pi-extension-jira-board` — passed.
- `npm run typecheck` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-jira-board` — passed; package dry-run contained 32 files.

Pack dry-run:

- Package: `@gregho/pi-extension-jira-board@0.2.0`
- Tarball: `gregho-pi-extension-jira-board-0.2.0.tgz`
- Package size: 30.2 kB
- Unpacked size: 135.0 kB
- Total files: 32

Next:

- Review/merge the v0.2.0 branch and tag/release when ready.
