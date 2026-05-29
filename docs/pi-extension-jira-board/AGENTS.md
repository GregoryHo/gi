# Jira board extension docs governance

This directory is the product/spec source of truth for `packages/pi-extension-jira-board`.

The docs directory name intentionally matches the package directory name (`pi-extension-jira-board`). Keep this 1:1 naming convention for future packages.

## Entry points

Before changing Jira extension behavior or docs, read in this order:

1. `index.md` — current version, active planning area, archive pointers.
2. `log.md` — append-only product/change history.
3. Current version docs referenced by `index.md`.
4. `api-reference-notes.md` when Jira API behavior is unclear.

Package implementation work should also follow `../../packages/pi-extension-jira-board/AGENTS.md`.

## File management model

Use two concepts:

- **Current version docs** — the active spec/planning docs for the version being designed or implemented.
- **Archived version docs** — completed or superseded planning docs retained for traceability.

Do not delete completed specs or implementation plans. Prefer indexing and marking them complete. Move files only when the directory becomes too noisy and links can be updated in the same commit.

## Versioning convention

Use semantic versions for product iterations:

- `0.1.0` — initial MVP/local package milestone.
- `0.2.0` — next minor iteration.
- Patch versions, such as `0.1.1`, are for maintenance fixes that do not change the planned product scope.

For future version-specific docs, use:

```text
versions/<semver>/
├── index.md
├── milestones.md
├── log.md
└── YYYY-MM-DD-<topic>.md
```

Use dates for individual design notes, decisions, and implementation plans inside a version folder. Use SemVer for the version folder itself.

## Required docs

This directory should maintain:

- `index.md` — human navigation and current-version pointer.
- `log.md` — append-only history of important decisions, completed releases, and handoffs.
- `archive.md` — index of completed/superseded docs retained for traceability.
- `roadmap.md` — broad long-term product direction.
- `milestones.md` — v0.1.0 historical milestone tracker.
- `versions/` — future versioned planning areas.

Optional docs:

- `decisions.md` or `versions/<semver>/decisions.md` for ADR-style decisions when tradeoffs are important.
- `research.md` or dated research notes when external/API behavior was investigated.

## Milestone workflow

Every milestone must have an implementation plan before code work starts.

A milestone plan must include:

- SPEC: scope, non-goals, design notes, expected files.
- AC: acceptance criteria and verification commands/checks.
- Status tracking: how trackers/logs change at start and completion.

At milestone start:

1. Update the active milestone tracker to `In progress`.
2. Append a short entry to the active log.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the verification listed in the milestone plan.
2. Update the active milestone tracker to `Done`.
3. Add completion notes to the milestone plan.
4. Append a log entry with verification evidence.
5. Commit the completed milestone state.

## Release workflow

Before tagging a release:

1. Ensure all target milestone docs are `Done`.
2. Update package `CHANGELOG.md`.
3. Run full verification from the package README.
4. Update `index.md`, `archive.md`, and `log.md`.
5. Commit docs/package changes.
6. Merge to `main`.
7. Create a SemVer tag matching package version.

## Safety rules

- Do not commit Jira credentials, private raw payloads, cookies, tokens, or passwords.
- Keep examples generic unless a user explicitly approves otherwise.
- Jira write behavior must always document confirmation and non-interactive restrictions.
