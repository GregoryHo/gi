# M3 implementation plan — Board and sprint snapshot widget

## Status

Done. M3 implemented and manually smoke-tested against real Jira.

## Completion notes

Automated checks passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Latest automated verification result: 23 tests passed and package typecheck passed.

Manual Jira smoke checks passed:

- `jira_board_snapshot` summarized current `CHATAPP` context successfully.
- `/jira-refresh` widget path was confirmed by the user as working.

## Objective

Add read-only Jira board/sprint context and a compact interactive widget so users can see the current Jira project/board state while still exposing the same context to the agent through a bounded tool.

## SPEC

### Scope

M3 includes:

1. Active sprint lookup for configured `JIRA_BOARD_ID`.
2. Board snapshot aggregation from bounded Jira issue search.
3. `jira_board_snapshot` tool.
4. `/jira-refresh` command to refresh the interactive widget.
5. Brief in-memory cache to avoid repeated Jira calls during one session.
6. Tests for snapshot aggregation, status counts, default JQL, cache behavior, and widget formatting.

### Non-goals

M3 does not include:

- `/jira-plan`, `/jira-fix`, or `/jira-issue` commands.
- Autocomplete.
- Rich interactive board navigation.
- Pagination beyond the bounded snapshot.
- Jira writes: comments, transitions, assignments, issue creation, or field updates.

### Active sprint lookup

If `JIRA_BOARD_ID` is configured, fetch active sprint via Agile API:

```text
GET /rest/agile/1.0/board/{boardId}/sprint?state=active
```

Behavior:

- If no board id is configured, snapshot still works without sprint context.
- If no active sprint exists, snapshot reports `Active sprint: none`.
- If the Agile API call fails, report a clear snapshot warning but keep project-level issue snapshot working when possible.

### Snapshot issue search

Use bounded issue search to avoid dumping a whole project.

Default JQL:

- If active sprint exists: `sprint = <sprintId> AND statusCategory != Done ORDER BY updated DESC`
- Else if `JIRA_PROJECT` is configured: `project = <PROJECT> AND statusCategory != Done ORDER BY updated DESC`
- Else require explicit `jql` input for the tool, or report clear command error for `/jira-refresh`.

Default/max result behavior:

- Default max issues: `25`
- Hard cap: `50`

Fields:

```text
summary,description,status,labels,assignee,priority,issuetype
```

Descriptions should not be included in widget display or default snapshot text.

### Tool: `jira_board_snapshot`

Purpose: provide compact board/project context to the LLM.

Input:

- `jql` string, optional override.
- `maxResults` number, optional, default `25`, hard cap `50`.
- `refresh` boolean, optional, default `false`; bypasses cache when true.

Output details:

- project
- boardId
- activeSprint
- jql
- total
- returned
- statusCounts
- sample issues
- warnings, if any

### Command: `/jira-refresh`

Purpose: refresh the Jira widget in interactive mode.

Behavior:

1. Load config.
2. Fetch or refresh snapshot.
3. If `ctx.hasUI`, call `ctx.ui.setWidget("jira-board", lines)`.
4. Notify success/failure.
5. In non-interactive mode, report via notification if possible but do not require widget APIs.

### Widget format

Keep widget compact, roughly:

```text
Jira CHATAPP / Board 123
Sprint: Sprint 42
Issues: 25 of 336
Status: BACKLOG 20 | Uat Verify 2 | In Progress 3
Recent: CHATAPP-5421, CHATAPP-5400, CHATAPP-5429
```

Do not include issue descriptions in the widget.

### Cache behavior

Use a simple in-memory cache in the extension module:

- Cache key includes base URL, project, board id, and JQL.
- TTL: 60 seconds.
- `/jira-refresh` and tool input `refresh: true` bypass cache.

No session persistence in M3.

### Suggested file structure

```text
packages/pi-extension-jira-board/src/
├── board-snapshot.ts
├── board-snapshot.test.ts
└── index.ts                  # command/tool registration wiring
```

Existing `jira-tools.ts` may be updated to register `jira_board_snapshot`, or M3 may use a separate registration function if simpler.

## AC

M3 is complete when all criteria below are true:

1. `jira_board_snapshot` is registered and returns bounded compact board/project context.
2. `/jira-refresh` updates a compact widget when UI is available.
3. Snapshot works with configured `JIRA_PROJECT` even when `JIRA_BOARD_ID` is absent.
4. Snapshot includes active sprint information when `JIRA_BOARD_ID` has an active sprint.
5. Snapshot status counts are computed from returned issues.
6. Snapshot uses max-result caps and avoids descriptions by default.
7. Agile API failure does not expose secrets and produces a clear warning.
8. No Jira write endpoints are implemented or exposed.
9. Tests and typecheck pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Manual interactive smoke check with real Jira env:

```bash
pi -e ./packages/pi-extension-jira-board
```

Then run:

```text
/jira-refresh
```

And ask the agent:

```text
Use jira_board_snapshot to summarize current CHATAPP board context.
```

## Status tracking

At M3 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M3 Board and sprint snapshot widget` → `In progress`
2. Commit that status update before code changes.

At M3 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M3 Board and sprint snapshot widget` → `Done`
   - `M4 Planning commands` → `Planned` or `Next`
3. Add completion notes to this plan if useful.
4. Commit the completed milestone state.

## Reference

If API details are unclear, read:

- `docs/pi-extension-jira-board/api-reference-notes.md`
- `/path/to/example/plugins/tracker-jira/src/index.ts`
