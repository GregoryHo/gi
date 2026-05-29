# Changelog

## Unreleased

No unreleased changes.

## 0.2.0 - 2026-05-24

### Added

- `/jira-onboarding` command for interactive Jira setup.
- Encrypted local Jira credential storage using Node `crypto`.
- Local Jira config fallback when env credentials are absent, with env vars still taking precedence.
- `jira_search_projects` tool for bounded project discovery.
- `startAt` paging support for `jira_search_issues`.
- `/jira-projects` interactive project browser that applies a session-local active project.
- `/jira-issues` interactive issue browser with faceted filters, advanced raw JQL mode, and compact widget focus cards.
- Project versions/components metadata helpers for issue filter values.
- Issue-result facet aggregation for labels, assignees, statuses, priorities, and issue types.
- Current Jira context bridge tools: `jira_get_current_context` and `jira_get_focused_issue`.
- Session custom-entry persistence for active/focused Jira context without automatic LLM context injection.
- Canonical Jira cockpit widget with compact/focus modes.
- `/jira` cockpit command.
- `/jira-boards` interactive board picker that applies a session-local active board.
- Active Scrum board sprint scope for `/jira-issues` when an active sprint exists, with project fallback.
- Active Kanban board saved-filter scope for `/jira-issues`, with JQL composition and project fallback.
- Paged facet value picker and recency-first project version sorting for large Fix Version lists.
- Assignee facet typed Jira assignable-user search with no-match reporting and Server/DC username-based lookup/ranking.
- Issue Type facet project metadata lookup so Sub-task and other types are not limited to current issue page results.
- `/jira-issues` picker `s status` shortcut to switch status category between not done/all/done.
- `/jira-clear` command to clear active Jira project, board, filters, and focused issue context without removing Jira URL/user/token configuration.
- `/jira-issue [KEY]` now sets or reuses the focused issue context.
- `/jira-plan`, `/jira-fix`, `/jira-comment`, and `/jira-transition` now use the focused issue when no key is provided.

## 0.1.0

Initial local pi package milestone.

### Added

- Jira Server/Data Center env config and read-only REST client.
- `/jira-status` connectivity check.
- `jira_get_issue` and `jira_search_issues` tools.
- `jira_board_snapshot` tool and `/jira-refresh` widget command.
- `/jira-issue`, `/jira-plan`, and `/jira-fix` planning commands.
- Jira issue autocomplete for project-key and `#number` shorthand patterns.
- Controlled interactive write commands:
  - `/jira-comment <KEY>`
  - `/jira-transition <KEY>`
- Safety boundaries: write commands require interactive preview and confirmation; non-interactive writes are refused.

### Notes

- Package targets self-hosted Jira REST API v2 and Agile API 1.0.
- Auth uses Basic auth from environment variables.
- No assign, label mutation, or issue creation support is included.
