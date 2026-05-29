# API behavior audit extension docs governance

This directory is the product/spec source of truth for `packages/pi-extension-api-behavior-audit`.

The docs directory name intentionally matches the package directory name (`pi-extension-api-behavior-audit`). Keep this 1:1 naming convention for future packages.

## Entry points

Before changing API behavior audit extension behavior or docs, read in this order:

1. `index.md` — current status, active planning area, archive pointers.
2. `log.md` — append-only product/change history.
3. Active roadmap and milestone docs referenced by `index.md`.
4. Package workflow in `../../packages/pi-extension-api-behavior-audit/AGENTS.md` before implementation work.

## Product direction

The extension exists to compare backend API behavior between:

```text
old project browser/page -> old Go web API/proxy -> baseline backend API
new project browser/page -> candidate web/API gateway -> backend API gateway
```

Browser-visible capture is allowed as an early validation step, but the final product direction is backend/upstream API behavior evidence. Docs must keep this distinction explicit:

- **Layer A** — browser-visible request/response capture. Useful for MVP validation and page/scenario anchoring.
- **Layer B** — upstream/backend request/response capture. Required for the final audit goal.

Do not describe Layer A as the final audit surface.

## Evidence pipeline drift rule

The evidence pipeline is documented in `evidence-pipeline.md`. If a change affects any of the following, update that document in the same change:

- raw run, comparison, analysis, suggestion, validation, or scenario SOT responsibilities,
- Layer A / Layer B interpretation,
- endpoint normalization,
- classification hints or thresholds,
- suggestion generation or validation semantics,
- scenario dictionary evidence shape,
- audit report assumptions about evidence.

Also update `artifact-schema.md` for artifact shape changes and `scenario-dictionary.md` for scenario SOT shape changes.

## File management model

Use two concepts:

- **Current planning docs** — active roadmap, milestone tracker, and milestone plans.
- **Archived docs** — completed or superseded plans retained for traceability.

Do not delete completed specs or implementation plans. Prefer indexing and marking them complete. Move files only when links can be updated in the same commit.

## Required docs

This directory should maintain:

- `index.md` — human navigation and current-version pointer.
- `log.md` — append-only history of important decisions, completed milestones, and handoffs.
- `archive.md` — index of completed/superseded docs retained for traceability.
- `roadmap.md` — broad long-term product direction.
- `milestones.md` — active MVP milestone tracker.
- `evidence-pipeline.md` — raw run → comparison → analysis → suggestion → validation → scenario SOT semantics and drift guardrails.
- Milestone plan docs named `m<N>-<topic>.md` before implementation starts.

Optional docs:

- `decisions.md` for ADR-style decisions when tradeoffs are important.
- `research.md` or dated research notes when capture mechanics or API behavior are investigated.

## Milestone workflow

Every milestone must have an implementation plan before code work starts.

A milestone plan must include:

- SPEC: scope, non-goals, design notes, expected files.
- AC: acceptance criteria and verification commands/checks.
- Status tracking: how `milestones.md` and `log.md` change at start and completion.

At milestone start:

1. Update `milestones.md` status to `In progress`.
2. Append a short start entry to `log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the verification listed in the milestone plan.
2. Update `milestones.md` status to `Done`.
3. Add completion notes to the milestone plan.
4. Append a log entry with verification evidence.
5. Commit the completed milestone state.

## Safety rules

- Do not commit captured raw API payloads, cookies, auth headers, tokens, passwords, production hostnames, or private user data.
- Capture artifacts must be local and gitignored when implemented.
- Default collection design must use local services and explicit host allowlists.
- Any destructive scenario or API write capture must require explicit user approval before implementation.
- LLM-facing summaries should be compact and derived from sanitized artifacts, not raw secrets-bearing payloads.
