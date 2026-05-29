# M3 implementation plan — Interactive browse UI and widget cards

## Status

Done.

## Post-implementation UX revision

After M3/M3.1 implementation, UX discussion clarified that the current browser is technically functional but not the desired final M3 UX.

Revised direction:

- Treat the widget as a read-only Jira context cockpit, not a clickable/interactive Jira board.
- Keep primary interaction in `ctx.ui.custom()` browser overlays.
- Redesign issue browsing around faceted filters:
  - choose filter type
  - choose available value
  - update issue list
- Do not make normal users type or understand JQL.
- Raw JQL remains advanced mode only.
- Use project versions/components APIs plus issue result aggregation first.
- Defer a full Jira metadata system to optional M3.2.

## Completion notes

Implemented:

- `/jira-projects [query]` interactive project browser.
- `/jira-issues [jql]` interactive issue browser.
- Reusable paged picker component helper using `ctx.ui.custom()`.
- Session-local selected project state for `/jira-issues` defaults.
- Compact project and issue card widget formatters.
- Widget focus update when a project or issue is selected.
- README, CHANGELOG, and package `files` allowlist updates.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Latest automated result: 72 tests passed; package and root typecheck passed; pack dry-run included 20 files.

Manual Jira smoke test was not run in this session.

## Objective

Add a small interactive Jira browser for projects/issues and improve widget output into compact card/item-style context, without turning pi into a full Jira client.

## SPEC

### Scope

M3 includes:

1. `/jira-projects` command for interactive project browsing.
2. `/jira-issues` command for interactive issue browsing.
3. Reusable paged picker component helpers using `ctx.ui.custom()`.
4. Compact project and issue card/item widget formatting.
5. Session-local selected project context for `/jira-issues` defaults.
6. Tests for card formatting, paging action helpers/components, command registration, and non-interactive guards.

### Non-goals

M3 does not include:

- Full-screen Jira clone.
- Persisting selected project/issue globally.
- Updating encrypted local config when a project is selected.
- Rich board/kanban navigation.
- Drag/drop or automatic transitions.
- New Jira write APIs.
- LLM-facing write tools.

### Commands

#### `/jira-projects [query]`

Purpose: browse accessible Jira projects and set the session-local selected project.

Behavior:

1. Require interactive UI. Refuse clearly otherwise.
2. Load Jira config.
3. Use optional command args as initial project filter.
4. Fetch a bounded page via M2 `queryJiraProjects`.
5. Show a custom paged picker:
   - `↑/↓` select item.
   - `Enter` select project.
   - `n` next page when available.
   - `p` previous page when available.
   - `/` change filter by prompting for a new query.
   - `Esc` cancel.
6. On selection, store selected project in module/session-local extension state.
7. Update widget with selected project card.

#### `/jira-issues [jql]`

Purpose: browse issues and focus one issue in the widget.

Behavior:

1. Require interactive UI. Refuse clearly otherwise.
2. Load Jira config.
3. Resolve JQL:
   - If args are non-empty, treat them as explicit JQL.
   - Else if session-selected project exists, use `project = <KEY> AND statusCategory != Done ORDER BY updated DESC`.
   - Else use the configured project default via existing search resolver.
4. Fetch bounded issue pages with `startAt` and `maxResults`.
5. Show a custom paged picker:
   - `↑/↓` select item.
   - `Enter` focus issue.
   - `n` next page when available.
   - `p` previous page when available.
   - `/` change JQL by prompting for a new JQL.
   - `Esc` cancel.
6. Update widget with focused issue card and current page context.

### Widget formatting

Keep widget bounded and readable. Use compact cards/items, for example:

```text
Jira issues · CHATAPP · 10/334 · startAt 0
JQL: project = CHATAPP AND statusCategory != Done ORDER BY updated DESC

CHATAPP-5429  BACKLOG  Low
[Web2.0] ...
assignee: bryce_ni · labels: none
```

Rules:

- Never display secrets.
- Never display raw Jira JSON.
- Truncate long summaries/metadata to preserve widget width.
- Show at most a small number of issue cards in widget output.

### State

Use in-memory module state only:

```ts
selectedProject?: JiraProject
focusedIssue?: CompactJiraIssue
```

Do not persist selection to config in M3. Persisting defaults can be considered later if the UX proves useful.

### Expected file changes

Likely package source files:

```text
packages/pi-extension-jira-board/src/jira-browser.ts
packages/pi-extension-jira-board/src/jira-browser.test.ts
packages/pi-extension-jira-board/src/index.ts
packages/pi-extension-jira-board/src/jira-query.ts
packages/pi-extension-jira-board/src/package.json
```

Package docs likely updated:

```text
packages/pi-extension-jira-board/README.md
packages/pi-extension-jira-board/CHANGELOG.md
```

## AC

M3 is complete when all criteria below are true:

1. `/jira-projects` is registered and refuses clearly without interactive UI.
2. `/jira-projects` lets users page/filter project results and select a project.
3. Selected project is stored in session-local extension state.
4. `/jira-issues` is registered and refuses clearly without interactive UI.
5. `/jira-issues` uses explicit JQL, selected project, or configured project in that order.
6. `/jira-issues` lets users page/change JQL and focus an issue.
7. Widget shows compact project/issue cards/items.
8. Widget never displays secrets or raw Jira payloads.
9. No new Jira write behavior is added.
10. Tests and typecheck pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Manual interactive smoke check with real Jira config:

```bash
pi -e ./packages/pi-extension-jira-board
```

Then run:

```text
/jira-projects CHAT
/jira-issues
/jira-issues project = CHATAPP AND fixVersion = "v1.62" AND component = IOS AND statusCategory != Done ORDER BY updated DESC
```

Expected:

- Project browser supports next/previous/filter/select.
- Issue browser supports next/previous/JQL change/select.
- Widget updates with compact project/issue card context.

## Status tracking

At M3 implementation start:

1. Update `docs/pi-extension-jira-board/versions/0.2.0/milestones.md`:
   - `M3 Interactive browse UI and widget cards` → `In progress`
2. Append a start entry to `docs/pi-extension-jira-board/versions/0.2.0/log.md`.
3. Commit the status/log/plan update before code changes.

At M3 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/versions/0.2.0/milestones.md`:
   - `M3 Interactive browse UI and widget cards` → `Done`
   - `M4 v0.2.0 docs, polish, and release prep` → `Planned` or `Next`
3. Add completion notes to this plan.
4. Append verification evidence to `docs/pi-extension-jira-board/versions/0.2.0/log.md`.
5. Commit the completed milestone state.
