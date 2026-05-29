# Jira board pi extension

pi package for exposing self-hosted Jira Server/Data Center board and issue context to pi agents.

## Status

Version `0.2.0` adds interactive onboarding, project/board/issue browsing, active Jira context, and stabilization fixes on top of the initial local package milestone. See:

- [`CHANGELOG.md`](CHANGELOG.md)
- [`../../docs/pi-extension-jira-board/roadmap.md`](../../docs/pi-extension-jira-board/roadmap.md)
- [`../../docs/pi-extension-jira-board/milestones.md`](../../docs/pi-extension-jira-board/milestones.md)

## Load or install

Load temporarily while developing or only when needed:

```bash
pi -e ./packages/pi-extension-jira-board
```

Install as a local pi package:

```bash
pi install ./packages/pi-extension-jira-board
```

## Configuration

Recommended setup:

```text
/jira-onboarding
```

The onboarding command prompts for Jira URL, account, auth type, and a masked password/token, then stores non-secret config plus an encrypted local secret under `~/.pi/agent/jira-board/`.

Local secret storage uses reversible encryption to avoid plaintext-at-rest accidental exposure. It is not an OS keychain or enterprise vault; anyone who can read both the local `master.key` and encrypted secret file can decrypt the secret.

Shell env vars still work and take precedence over local config. You can copy `.env.example` as a reference, but do not commit real secrets.

```bash
export JIRA_BASE_URL="https://jira.example.com"
export JIRA_USER="your-user"          # or JIRA_EMAIL
export JIRA_TOKEN="your-token"        # or JIRA_PASSWORD
export JIRA_PROJECT="PROJ"            # optional default project
export JIRA_BOARD_ID="123"            # optional default board
```

Self-hosted Jira often accepts username/password. Some setups use email/token.

## Commands

Read-only/context commands:

- `/jira-onboarding` — configure Jira with encrypted local credentials.
- `/jira-status` — validate config/connectivity.
- `/jira-refresh` — refresh board widget/cache.
- `/jira` — show the current Jira cockpit widget.
- `/jira-clear` — clear active Jira project, board, issue filters, and focused issue context; keeps Jira URL/user/token configuration.
- `/jira-projects [query]` — browse/filter/page projects and apply a session-local active project.
- `/jira-boards [query]` — browse/filter/page boards for the active project and apply a session-local active board.
- `/jira-issues [project]` — browse/page issues with faceted filters and focus one issue in the widget; defaults to active Scrum sprint or Kanban saved-filter scope when available.
- `/jira-issues --jql <JQL>` — advanced raw JQL issue browsing.
- `/jira-issue [KEY]` — display compact issue context and set/fetch the focused issue.
- `/jira-plan [KEY]` — generate an implementation-planning prompt; uses focused issue when key is omitted.
- `/jira-fix [KEY]` — generate a debugging-oriented fix prompt; uses focused issue when key is omitted.

Controlled write commands:

- `/jira-comment [KEY]` — add a Jira comment after editor preview and confirmation; uses focused issue when key is omitted.
- `/jira-transition [KEY]` — choose and apply a Jira transition after preview and confirmation; uses focused issue when key is omitted.

## Cockpit widget

The extension uses one Jira cockpit widget model with compact/focus modes. It shows active project, board id when configured, filter summary, focused issue, and suggested actions.

## Tools

- `jira_get_current_context` — read current project/board/filter/focused issue context from extension state.
- `jira_get_focused_issue` — fetch the currently focused issue without requiring an issue key.
- `jira_search_projects` — list accessible projects with bounded filtering and paging.
- `jira_get_issue` — fetch one compact issue summary.
- `jira_search_issues` — run bounded JQL search with compact issue summaries, including `startAt` paging.
- `jira_board_snapshot` — fetch a compact board/project snapshot.

No Jira write tools are exposed to the LLM in `0.2.0`.

## Autocomplete

In interactive pi sessions, the extension preloads recent open issues from `JIRA_PROJECT` and suggests issue keys while typing.

Supported patterns:

```text
/jira-plan CHATAPP-
Please inspect CHATAPP-54
look at #5421     # expands to CHATAPP-5421 when JIRA_PROJECT=CHATAPP
```

Autocomplete is read-only, bounded, and delegates to pi's built-in autocomplete for non-Jira input.

## Safety boundaries

Most functionality is read-only. The only Jira writes are:

- `/jira-comment <KEY>`
- `/jira-transition <KEY>`

Both require interactive UI, show a preview, and ask for explicit confirmation before calling Jira write APIs. Non-interactive writes are refused. Assign/labels/create issue writes are not implemented.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```
