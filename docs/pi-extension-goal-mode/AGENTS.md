# Goal mode docs governance

This directory is the product/spec source of truth for `packages/pi-extension-goal-mode`.

The docs directory name intentionally matches the package directory name (`pi-extension-goal-mode`). Keep this 1:1 naming convention.

## Entry points

Before changing Goal Mode behavior or docs, read in this order:

1. `../../AGENTS.md`
2. `../extension-development-style.md`
3. `index.md` — current status and active planning pointers.
4. `roadmap.md` — product direction and milestone route.
5. `milestones.md` — active or historical milestone tracker.
6. `log.md` — append-only decision/change history.
7. Current milestone docs referenced by `milestones.md`.
8. Package workflow in `../../packages/pi-extension-goal-mode/AGENTS.md` before implementation work.

## Product direction

Goal Mode exists to provide a conservative, bounded autonomous loop for planned work:

```text
plan -> act -> observe -> verify -> continue/block/done
```

The user defines the objective. The extension owns loop control, stop conditions, verification policy, and safety gates.

## File management model

Root-level `milestones.md` and milestone plans may be used for the initial MVP era. Future post-MVP product iterations should use `versions/<semver>/` before implementation starts.

Do not delete completed plans. Prefer indexing and marking them complete.

## Required docs

This directory should maintain:

- `index.md` — human navigation and current-version pointer.
- `roadmap.md` — broad product direction.
- `milestones.md` — active or historical milestone tracker.
- `log.md` — append-only history of important decisions and handoffs.
- `archive.md` — completed/superseded docs index.
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

At milestone completion:

1. Run the verification listed in the milestone plan.
2. Update the active milestone tracker to `Done`.
3. Add completion notes to the milestone plan if useful.
4. Append a log entry with verification evidence.

## Safety rules

- M1 must be bounded and conservative.
- Goal loops must stop on max iterations, timeout, repeated failure, missing reports, ambiguity, or safety-sensitive actions.
- Write/destructive operations require explicit user confirmation.
- Do not commit secrets, tokens, raw private payloads, or runtime artifacts.
- Runtime artifacts, if added later, must live in ignored local directories or under `~/.pi/agent/goal-mode/`.
- Worker delegation requires a future explicit milestone and must not bypass `agent-workers` safety rules.
