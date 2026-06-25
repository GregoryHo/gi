# Web Search extension docs governance

This directory is the product/spec source of truth for `packages/pi-extension-web-search`.

The docs directory name intentionally matches the package directory name (`pi-extension-web-search`). Keep this 1:1 naming convention.

## Entry points

Before changing Web Search behavior or docs, read in this order:

1. `index.md` — current status and active planning pointers.
2. `log.md` — append-only product/change history.
3. Current milestone docs referenced by `index.md`.
4. Version-specific docs under `versions/<semver>/` when a future product iteration is active.
5. Package workflow in `../../packages/pi-extension-web-search/AGENTS.md` before implementation work.

## Product direction

Web Search exists to give pi a small, auditable web-search tool that can use the user's existing OpenAI/Codex access before introducing extra provider accounts or crawler behavior.

Initial scope is read-only search only:

- Register a compact LLM-callable `web_search` tool.
- Use OpenAI/Codex web-search capability from pi auth or explicit OpenAI API credentials.
- Return synthesized answers with source citations and compact structured details.
- Avoid browser cookies, Google CSE, scraping, and persistent content storage in v0.1.0.

## File management model

Use two concepts:

- **Current milestone docs** — active implementation plans for the initial MVP era.
- **Archived/version docs** — completed or superseded planning docs retained for traceability.

Do not delete completed plans. Prefer indexing and marking them complete.

## Versioning convention

Use semantic versions for product iterations:

- `0.1.0` — initial MVP/local package milestone.
- Future minor versions use `versions/<semver>/` before implementation starts.

Root-level `milestones.md` and milestone plans may be used for the initial MVP planning era. Future post-0.1.0 work should use:

```text
versions/<semver>/
├── index.md
├── milestones.md
├── log.md
└── m<N>-<topic>.md or YYYY-MM-DD-<topic>.md
```

## Required docs

This directory should maintain:

- `index.md` — human navigation and current-version pointer.
- `log.md` — append-only history of important decisions, completed releases, and handoffs.
- `archive.md` — completed/superseded docs index.
- `roadmap.md` — broad long-term product direction.
- `milestones.md` — active or historical milestone tracker.
- `versions/` — future versioned planning areas.

## Milestone workflow

Every milestone must have an implementation plan before code work starts.

A milestone plan must include:

- SPEC: scope, non-goals, design notes, expected files.
- AC: acceptance criteria and verification commands/checks.
- Status tracking: how trackers/logs change at start and completion.

At milestone start:

1. Update the active milestone tracker to `In progress`.
2. Append a short start entry to the active log.
3. Commit the status/log update before implementation work if this is a committed workflow.

At milestone completion:

1. Run the verification listed in the milestone plan.
2. Update the active milestone tracker to `Done`.
3. Add completion notes to the milestone plan.
4. Append a log entry with verification evidence.

## Release workflow

Before tagging or declaring a release sealed:

1. Ensure all target milestone docs are `Done`.
2. Update package `CHANGELOG.md`.
3. Run full verification from the package README.
4. Update `index.md`, `archive.md`, and `log.md`.
5. Mark the released version as stable and clear the active planning version unless the next version has already started.
6. Create a package-scoped tag only when explicitly requested.

## Safety rules

- Do not commit API keys, tokens, browser cookies, credentials, raw private payloads, or local-only config.
- v0.1.0 must be read-only network behavior only.
- Do not use browser-cookie extraction in this package without a future explicit safety milestone.
- Do not return raw auth headers, API keys, provider payloads, or full private response bodies in tool output.
- Keep LLM-facing output compact and source-provenance rich.
