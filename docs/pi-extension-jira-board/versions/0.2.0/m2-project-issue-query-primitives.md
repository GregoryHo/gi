# M2 implementation plan — Project and issue query primitives

## Status

Done.

## Completion notes

Implemented:

- `jira-query.ts` project query primitives.
- Client-side filter and paging over `GET /rest/api/2/project` for Jira Server/Data Center compatibility.
- `jira_search_projects` read-only bounded tool.
- `startAt` paging support for `jira_search_issues`.
- `startAt` included in Jira search path and tool details.
- Package README, CHANGELOG, and `files` allowlist updates.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Latest automated result: 65 tests passed; package and root typecheck passed; pack dry-run included 19 files.

Manual Jira smoke test: user verified `jira_search_projects`, project paging, and `jira_search_issues` with project/fixVersion/component filters successfully.

## Objective

Add reusable read-only query primitives for Jira projects and issues so M3 can build interactive browse UI and widgets on top of bounded, pageable data access.

## SPEC

### Scope

M2 includes:

1. Project query helper with text filtering and pagination.
2. Jira Server/Data Center compatible fallback for project listing.
3. Issue query helper with `startAt`, capped `maxResults`, and safe default JQL.
4. `jira_search_issues` support for `startAt` while preserving existing defaults and caps.
5. Read-only `jira_search_projects` tool for bounded project discovery.
6. Tests for project filtering/paging, issue search path generation, caps, and tool registration behavior.

### Non-goals

M2 does not include:

- Interactive project/issue browser UI.
- Widget card/item layout changes.
- Persistent selected project/issue state.
- Jira writes or LLM-facing write tools.
- Unbounded project or issue dumps.
- Rich JQL builder UI.

### Project query behavior

Jira Server/Data Center compatibility is the priority.

Use a simple fallback-first implementation for M2:

```text
GET /rest/api/2/project
```

Then filter and page client-side. This endpoint is broadly supported by Jira Server/Data Center. If a future Jira version-specific paged endpoint is needed, add it in a later milestone or patch.

Returned project summaries should include only:

- `id`
- `key`
- `name`

Filtering:

- Optional `query` matches case-insensitively against project key or name.
- Empty query returns all accessible projects, paged and capped.

Paging:

- Input `startAt`, default `0`.
- Input `maxResults`, default `25`, hard cap `50`.
- Output includes `total`, `startAt`, `maxResults`, `returned`, `isLast`, and page `projects`.

### Issue query behavior

Add a reusable issue query helper that accepts:

- `jql`, optional.
- `startAt`, optional default `0`.
- `maxResults`, optional default `10`, hard cap `25` for LLM-facing search.
- `includeDescriptions`, optional default `false`.

Default JQL remains:

```text
project = <JIRA_PROJECT> AND statusCategory != Done ORDER BY updated DESC
```

If no `jql` and no configured project exists, return the existing clear error.

Endpoint:

```text
GET /rest/api/2/search?jql=...&startAt=...&maxResults=...&fields=summary,description,status,labels,assignee,priority,issuetype
```

### Tools

#### `jira_search_projects`

Purpose: bounded read-only project discovery for agents and future UI smoke checks.

Input:

- `query` string, optional.
- `startAt` number, optional default `0`.
- `maxResults` number, optional default `25`, hard cap `50`.

Output:

- Compact text list.
- Details with paging metadata and project summaries.

#### `jira_search_issues`

Add optional `startAt` input and include `startAt` in details. Existing callers remain compatible.

### Expected file changes

Likely package source files:

```text
packages/pi-extension-jira-board/src/jira-query.ts
packages/pi-extension-jira-board/src/jira-query.test.ts
packages/pi-extension-jira-board/src/jira-tools.ts
packages/pi-extension-jira-board/src/jira-tools.test.ts
packages/pi-extension-jira-board/src/jira-types.ts
```

Package metadata may need its `files` allowlist updated for new runtime files.

## AC

M2 is complete when all criteria below are true:

1. Project query filters project key/name case-insensitively.
2. Project query returns bounded pages with `startAt`, `maxResults`, `total`, `returned`, and `isLast`.
3. Project query uses read-only Jira APIs and compact summaries.
4. Issue query supports `startAt` and includes it in the Jira search path.
5. Issue query keeps default max `10` and hard cap `25` for `jira_search_issues`.
6. `jira_search_projects` is registered and returns bounded compact project results.
7. Existing `jira_search_issues` behavior remains backwards compatible.
8. No new Jira write behavior is added.
9. Tests and typecheck pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Manual smoke check with real Jira env or local encrypted config:

```bash
pi -e ./packages/pi-extension-jira-board
```

Then ask the agent to use:

```text
Use jira_search_projects to find projects matching CHAT.
Use jira_search_issues with startAt 10 to fetch the next page of open project issues.
```

## Status tracking

At M2 implementation start:

1. Update `docs/pi-extension-jira-board/versions/0.2.0/milestones.md`:
   - `M2 Project and issue query primitives` → `In progress`
2. Append a start entry to `docs/pi-extension-jira-board/versions/0.2.0/log.md`.
3. Commit the status/log/plan update before code changes.

At M2 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/versions/0.2.0/milestones.md`:
   - `M2 Project and issue query primitives` → `Done`
   - `M3 Interactive browse UI and widget cards` → `Planned` or `Next`
3. Add completion notes to this plan.
4. Append verification evidence to `docs/pi-extension-jira-board/versions/0.2.0/log.md`.
5. Commit the completed milestone state.
