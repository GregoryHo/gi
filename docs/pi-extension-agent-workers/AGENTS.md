# Agent workers extension docs governance

This directory is the product/spec source of truth for `packages/pi-extension-agent-workers`.

The docs directory name intentionally matches the package directory name (`pi-extension-agent-workers`). Keep this 1:1 naming convention for future packages.

## Entry points

Before changing agent workers extension behavior or docs, read in this order:

1. `index.md` — current stable version, active planning version, archive pointers.
2. `log.md` — append-only product/change history.
3. Current version docs referenced by `index.md`.
4. Version-specific docs under `versions/<semver>/` when a new product iteration is active.
5. Package workflow in `../../packages/pi-extension-agent-workers/AGENTS.md` before implementation work.

## Product direction

The extension exists to let pi act as a control console for delegated AI agent worker CLI processes.

Initial scope is generic worker supervision only:

- Start and monitor local worker processes.
- Track elapsed time, status, exit code, logs, and cancellation.
- Parse machine-readable event streams when available.
- Report token/cost usage only when the worker adapter has a reliable source; otherwise mark usage as estimated or unknown.

Domain context, including Jira issue context, is composed through other extensions and LLM tool orchestration. The core `agent-workers` package stays generic worker infrastructure.

## File management model

Use two concepts:

- **Current version docs** — the active spec/planning docs for the version being designed or implemented.
- **Archived version docs** — completed or superseded planning docs retained for traceability.

Do not delete completed specs or implementation plans. Prefer indexing and marking them complete. Move files only when the directory becomes too noisy and links can be updated in the same commit.

## Versioning convention

Use semantic versions for product iterations:

- `0.1.0` — initial MVP/local package milestone.
- `0.2.0` — next minor iteration.
- Patch versions, such as `0.2.1`, are for maintenance fixes that do not change the planned product scope.

Root-level `milestones.md` and `m<N>-<topic>.md` docs are historical for the initial unversioned planning era through `v0.2.0`. For future version-specific docs, use:

```text
versions/<semver>/
├── index.md
├── milestones.md
├── log.md
└── YYYY-MM-DD-<topic>.md or m<N>-<topic>.md
```

Use the version folder itself to separate active planning from sealed releases. Individual design notes, decisions, and implementation plans may use either dated names or milestone names, but they must live inside the active version folder after `v0.2.0`.

## Required docs

This directory should maintain:

- `index.md` — human navigation and current-version pointer.
- `log.md` — append-only history of important decisions, completed releases, and handoffs.
- `archive.md` — index of completed/superseded docs retained for traceability.
- `roadmap.md` — broad long-term product direction.
- `milestones.md` — historical milestone tracker for the initial planning era through `v0.2.0`.
- `versions/` — future versioned planning areas.

Optional docs:

- `decisions.md` or `versions/<semver>/decisions.md` for ADR-style decisions when tradeoffs are important.
- `research.md` or dated research notes when worker CLI behavior or event formats are investigated.

## Milestone workflow

Every milestone must have an implementation plan before code work starts.

A milestone plan must include:

- SPEC: scope, non-goals, design notes, expected files.
- AC: acceptance criteria and verification commands/checks.
- Status tracking: how trackers/logs change at start and completion.

At milestone start:

1. Update the active milestone tracker to `In progress`.
2. Append a short start entry to the active log.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the verification listed in the milestone plan.
2. Update the active milestone tracker to `Done`.
3. Add completion notes to the milestone plan.
4. Append a log entry with verification evidence.
5. Commit the completed milestone state.

## Release workflow

Before tagging or declaring a release sealed:

1. Ensure all target milestone docs are `Done`.
2. Update package `CHANGELOG.md`.
3. Run full verification from the package README.
4. Update `index.md`, `archive.md`, and `log.md`.
5. Mark the released version as stable and clear the active planning version unless the next version has already started.
6. Commit docs/package changes.
7. Merge to `main` and create a package-scoped tag only when explicitly requested.

## Safety rules

- Do not commit worker logs, raw CLI output, prompts containing private context, credentials, tokens, or cost/account data.
- Runtime artifacts must be local and gitignored, preferably under `~/.pi/agent/agent-workers/`.
- Default worker execution must avoid dangerous permission bypass flags.
- Any write-capable, destructive, or multi-worker execution mode must require explicit user confirmation before support is added.
- LLM-facing summaries should be compact and should distinguish reported usage from estimated or unknown usage.
