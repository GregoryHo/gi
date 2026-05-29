# Jira board extension archive

Completed and superseded docs are retained for traceability. Current policy: keep v0.1.0 implementation plans in place and index them here rather than moving files.

## v0.1.0 MVP historical docs

Milestone tracker:

- `milestones.md`

Implementation plans:

- `m1-read-only-jira-config-client.md`
- `m2-agent-tools-issue-search.md`
- `m3-board-sprint-widget.md`
- `m4-planning-commands.md`
- `m5-autocomplete-ux-polish.md`
- `m6-controlled-jira-writes.md`
- `m7-packaging-polish.md`

Supporting docs:

- `api-reference-notes.md`
- `roadmap.md`

## v0.2.0 release docs

Version docs:

- `versions/0.2.0/index.md`
- `versions/0.2.0/milestones.md`
- `versions/0.2.0/log.md`

Release-prep plan:

- `versions/0.2.0/m5-docs-polish-release-prep.md`

Implemented milestone plans:

- `versions/0.2.0/m1-onboarding-encrypted-config.md`
- `versions/0.2.0/m2-project-issue-query-primitives.md`
- `versions/0.2.0/m3-interactive-browse-widget-cards.md`
- `versions/0.2.0/m3.1-active-project-guided-issue-filters.md`
- `versions/0.2.0/m3.1-faceted-issue-browser-rework.md`
- `versions/0.2.0/m3.1-focused-context-bridge.md`
- `versions/0.2.0/m3.3-command-cockpit-consolidation.md`
- `versions/0.2.0/m3.4-board-picker-active-board-context.md`
- `versions/0.2.0/m3.5-scrum-board-active-sprint-scope.md`
- `versions/0.2.0/m3.6-kanban-board-saved-filter-scope.md`
- `versions/0.2.0/m4-stabilization-smoke-fixes.md`

Deferred:

- `versions/0.2.0/m3.2-optional-metadata-system.md`

## Future archive policy

For future versions, prefer keeping active docs under:

```text
versions/<semver>/
```

When a version is released, mark it complete in `index.md`, append release notes to `log.md`, and add links here. Only move files into deeper archive folders if the directory becomes difficult to navigate.
