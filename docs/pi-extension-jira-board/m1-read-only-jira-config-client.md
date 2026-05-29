# M1 implementation plan — Read-only Jira config and client

## Status

Done. M1 implemented env config loading, read-only Jira client helpers, typed DTOs, and `/jira-status` connectivity validation.

## Completion notes

Verified with:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
```

Latest verification result: 8 tests passed and package typecheck passed.

## Objective

Implement the minimum read-only Jira foundation needed by later milestones: configuration loading, Jira REST client helpers, typed response shapes, and a `/jira-status` command that validates connectivity without exposing secrets.

## SPEC

### Scope

M1 includes:

1. Environment-based configuration loader.
2. Shared Jira client helpers for:
   - Core API: `/rest/api/2`
   - Agile API: `/rest/agile/1.0`
3. Read-only connectivity validation command:
   - `/jira-status`
4. Minimal typed DTOs needed by M1 and upcoming read-only milestones.
5. Package typecheck support.

### Non-goals

M1 does not include:

- Issue search tools.
- Board/sprint widget implementation.
- `/jira-plan` or `/jira-fix` prompt generation.
- Autocomplete.
- Jira writes: comments, transitions, assignments, issue creation, or field updates.
- Persisting config in session state or files.

### Configuration

Read config from environment variables only:

| Setting | Env vars | Required | Notes |
| --- | --- | --- | --- |
| Base URL | `JIRA_BASE_URL` | Yes | Trim trailing slash. |
| User | `JIRA_USER` or `JIRA_EMAIL` | Yes | Support self-hosted username or email login. |
| Secret | `JIRA_TOKEN` or `JIRA_PASSWORD` | Yes | Never display. |
| Project | `JIRA_PROJECT` | No | Used by future commands/tools. |
| Board ID | `JIRA_BOARD_ID` | No | Parse to number if present. |

Configuration errors should be actionable and list missing variable names without printing secret values.

### Client behavior

Add helpers equivalent to the reference tracker plugin:

- `jiraApiFetch<T>(config, path, options?)`
- `jiraAgileFetch<T>(config, path, options?)`

Behavior:

- Build URLs from normalized `baseUrl`.
- Add Basic auth header using `Buffer.from(`${user}:${secret}`).toString("base64")`.
- Send `Accept: application/json` and `Content-Type: application/json`.
- Support abort via `RequestInit.signal` when provided by pi contexts.
- Return `undefined` for `204 No Content`.
- Throw sanitized errors for non-2xx responses.

Error format should include:

- API family: `Jira API` or `Jira Agile API`
- HTTP method
- Request path
- Status code
- Short sanitized response body snippet

Do not include auth headers, username, token/password, or full raw payload dumps.

### `/jira-status` command

Replace the scaffold-only `/jira-status` implementation with a real read-only connectivity check.

Expected behavior:

1. Load config.
2. Show non-secret config summary:
   - base URL host or base URL without credentials
   - project value or `not configured`
   - board id or `not configured`
   - whether user/secret are configured, without values
3. Validate connectivity by calling a low-risk read endpoint.

Preferred endpoint order:

1. `GET /rest/api/2/myself` if supported.
2. If `myself` fails due endpoint compatibility, optionally fall back to `GET /rest/api/2/project/{JIRA_PROJECT}` when project is configured.

Keep the implementation simple. If fallback behavior becomes ambiguous, stop at `myself` and report the error clearly.

### Suggested file structure

```text
packages/pi-extension-jira-board/src/
├── index.ts          # extension registration and command wiring
├── config.ts         # env parsing and non-secret config summary
├── jira-client.ts    # REST helpers and error handling
└── jira-types.ts     # DTOs used by M1/M2/M3
```

### Dependency policy

Use Node built-ins and pi-provided peer dependencies only. Do not add runtime dependencies for M1 unless a concrete need appears.

## AC

M1 is complete when all criteria below are true:

1. `/jira-status` reports missing config clearly when required env vars are absent.
2. `/jira-status` never prints token/password values.
3. With valid Jira env vars, `/jira-status` performs a read-only Jira request and reports success.
4. Failed Jira responses show method/path/status and a sanitized body snippet.
5. `JIRA_BASE_URL` is normalized by removing one trailing slash.
6. `JIRA_BOARD_ID` is parsed as a number when present and rejected or ignored clearly when invalid.
7. No Jira write endpoints are implemented or exposed.
8. Package typecheck passes.

## Verification commands/checks

From repo root:

```bash
npm install
npm run typecheck --workspace @gregho/pi-extension-jira-board
```

Manual interactive smoke check:

```bash
JIRA_BASE_URL="https://jira.example.com" \
JIRA_USER="user" \
JIRA_TOKEN="token" \
JIRA_PROJECT="PROJ" \
JIRA_BOARD_ID="123" \
pi -e ./packages/pi-extension-jira-board
```

Then run:

```text
/jira-status
```

For missing-config behavior, unset required env vars and run `/jira-status` again.

## Status tracking

At M1 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M1 Read-only Jira config and client` → `In progress`
2. Commit that status update before code changes.

At M1 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M1 Read-only Jira config and client` → `Done`
   - `M2 Agent tools for issue/search context` → `Planned` or `Next`
3. Add completion notes to this plan if useful.
4. Commit the completed milestone state.

## Reference

If implementation details are unclear, read:

- `docs/pi-extension-jira-board/api-reference-notes.md`
- `/path/to/example/plugins/tracker-jira/src/index.ts`
