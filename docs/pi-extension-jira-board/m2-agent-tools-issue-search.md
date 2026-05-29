# M2 implementation plan — Agent tools for issue/search context

## Status

Done. M2 implemented and manually smoke-tested against real Jira.

## Completion notes

Automated checks passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Latest automated verification result: 17 tests passed and package typecheck passed.

Manual Jira smoke checks passed:

- `jira_get_issue` inspected `CHATAPP-5421` successfully.
- `jira_search_issues` searched open issues in project `CHATAPP` successfully.

## Objective

Expose compact, read-only Jira issue and search context to pi agents through custom tools, so the LLM can inspect tickets without dumping raw Jira payloads into context.

## SPEC

### Scope

M2 includes:

1. `jira_get_issue` tool.
2. `jira_search_issues` tool.
3. Compact issue mapper for LLM-facing results.
4. Description truncation and max-result limits.
5. Tests for mapping, truncation, URL/JQL behavior, and safe outputs.

### Non-goals

M2 does not include:

- Board/sprint widget or active sprint snapshot.
- `/jira-plan`, `/jira-fix`, or `/jira-issue` commands.
- Autocomplete.
- Jira writes: comments, transitions, assignments, issue creation, or field updates.
- Persistent caching.

### Tool: `jira_get_issue`

Purpose: fetch one Jira issue by key and return compact, plan-friendly context.

Input:

- `issueKey` string, required. Example: `PROJ-123`.
- `includeDescription` boolean, optional, default `true`.

Jira endpoint:

```text
GET /rest/api/2/issue/{issueKey}?fields=summary,description,status,labels,assignee,priority,issuetype
```

Output:

- text content containing a compact markdown-ish summary for the LLM.
- details containing the mapped summary object.

### Tool: `jira_search_issues`

Purpose: run a bounded JQL search and return compact issue summaries.

Input:

- `jql` string, optional. If omitted, default to configured project when available.
- `maxResults` number, optional. Default `10`, hard cap `25`.
- `includeDescriptions` boolean, optional, default `false`.

Default JQL:

- If `JIRA_PROJECT` is configured: `project = <PROJECT> AND statusCategory != Done ORDER BY updated DESC`
- If no project and no JQL is provided: return a clear tool error asking for `jql` or `JIRA_PROJECT`.

Jira endpoint:

```text
GET /rest/api/2/search?jql=...&maxResults=...&fields=summary,description,status,labels,assignee,priority,issuetype
```

Output:

- text content with total count and compact issue lines.
- details containing total, returned count, JQL, maxResults, and mapped issues.

### Compact issue shape

Mapped issue summaries should include:

- `key`
- `url`
- `summary`
- `status`
- `statusCategory`
- `issueType`
- `priority`
- `assignee`
- `labels`
- `description` only when requested/available
- `descriptionTruncated` boolean

Description truncation:

- Keep descriptions at or below a fixed character limit, initially `2000`.
- If truncated, append a clear marker and set `descriptionTruncated: true`.

### Suggested file structure

```text
packages/pi-extension-jira-board/src/
├── issue-mapper.ts       # compact DTO mapping and formatting
├── jira-tools.ts         # tool registration and tool handlers
├── issue-mapper.test.ts
└── jira-tools.test.ts
```

Existing files may be updated as needed:

- `index.ts` to register the tools.
- `jira-types.ts` if DTOs need minor expansion.
- `README.md` and milestone docs.

## AC

M2 is complete when all criteria below are true:

1. `jira_get_issue` is registered and fetches a single issue through the read-only Jira client.
2. `jira_search_issues` is registered and fetches bounded search results through the read-only Jira client.
3. Search defaults are safe: default max `10`, hard cap `25`.
4. Search without `jql` requires `JIRA_PROJECT`; otherwise it returns a clear error.
5. Tool outputs use compact mapped summaries, not raw Jira payloads.
6. Descriptions are omitted from search by default.
7. Included descriptions are truncated with an explicit marker and `descriptionTruncated` flag.
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

Then ask the agent to use:

```text
Use jira_get_issue to inspect PROJ-123.
Use jira_search_issues to find open issues in project PROJ.
```

## Status tracking

At M2 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M2 Agent tools for issue/search context` → `In progress`
2. Commit that status update before code changes.

At M2 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M2 Agent tools for issue/search context` → `Done`
   - `M3 Board and sprint snapshot widget` → `Planned` or `Next`
3. Add completion notes to this plan if useful.
4. Commit the completed milestone state.

## Reference

If API details are unclear, read:

- `docs/pi-extension-jira-board/api-reference-notes.md`
- `/path/to/example/plugins/tracker-jira/src/index.ts`
