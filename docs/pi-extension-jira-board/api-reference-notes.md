# Jira API reference notes

Source reference inspected:

`/path/to/example/plugins/tracker-jira/src/index.ts`

## Jira compatibility target

The reference plugin targets Jira Server 8.x REST APIs:

- Jira REST API v2: `/rest/api/2`
- Jira Agile API: `/rest/agile/1.0`

## Auth pattern

The reference uses Basic auth:

```ts
Authorization: Basic base64(`${email}:${token}`)
```

For this pi extension, use environment variables first:

- `JIRA_BASE_URL`
- `JIRA_USER` or `JIRA_EMAIL`
- `JIRA_TOKEN` or `JIRA_PASSWORD`
- `JIRA_PROJECT` optional default project key
- `JIRA_BOARD_ID` optional default board id

Never persist secrets in pi session entries, tool details, docs, or committed config.

## Useful endpoints

### Core REST API v2

- `GET /rest/api/2/issue/{issueKey}`
- `GET /rest/api/2/issue/{issueKey}?fields=status`
- `GET /rest/api/2/search?jql=...&maxResults=...&fields=...`
- `GET /rest/api/2/issue/{issueKey}/transitions` — deferred write milestone support only
- `POST /rest/api/2/issue/{issueKey}/comment` — deferred write milestone support only

### Agile API

- `GET /rest/agile/1.0/board/{boardId}/sprint?state=active`
- `GET /rest/agile/1.0/sprint/{sprintId}/issue`

## Mapping notes

Status category mapping from the reference:

- `done` → closed/done
- `indeterminate` → in progress
- `new` or unknown → open/todo

Issue fields useful for planning:

- `summary`
- `description`
- `status`
- `labels`
- `assignee`
- `priority`
- `issuetype`

Keep tool outputs compact. Prefer summary DTOs over raw Jira responses.
