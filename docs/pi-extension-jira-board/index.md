# Jira board extension docs index

## Current stable version

- Version: `0.2.0`
- Package: `packages/pi-extension-jira-board`
- Status: Release prep complete; merged to `main` for tag `0.2.0`.
- Version docs: `versions/0.2.0/`

## Active planning version

None.

v0.2.0 delivered:

- `/jira-onboarding` for interactive setup with encrypted local credentials.
- Filterable/pageable project, board, and issue browsing.
- Active Jira context bridge for project, board, issue filters, and focused issue.
- Scrum active sprint and Kanban saved filter issue scopes.
- Faceted issue filters with paged metadata, assignee search, issue type metadata, status switching, and `/jira-clear`.

## Navigation

- `roadmap.md` — broad product roadmap.
- `milestones.md` — historical `0.1.0` milestone tracker.
- `log.md` — append-only product/change log.
- `archive.md` — completed/superseded docs index.
- `api-reference-notes.md` — Jira Server/Data Center API notes.
- `AGENTS.md` — docs governance and workflow.

## 0.1.0 MVP contents

Implemented package capabilities:

- Jira env config and connectivity check.
- Read-only issue/search tools.
- Board snapshot tool and widget refresh command.
- Planning commands.
- Jira issue autocomplete.
- Controlled interactive comment/transition writes.
- Local package metadata, changelog, and env example.

## Release checklist for 0.1.0

- [x] M0-M7 complete.
- [x] Package version set to `0.1.0`.
- [x] `CHANGELOG.md` documents `0.1.0`.
- [x] Full verification passed before release docs patch.
- [x] Merged to `main`.
- [x] Git tag `0.1.0` created.
