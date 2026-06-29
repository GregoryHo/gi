# Plan mode extension docs index

## Current status

- Package: `packages/pi-extension-plan-mode`
- Status: M1-M4 complete; M5/M6 planned.
- Active milestone: proposed M5, pending implementation.

## Navigation

- `research.md` — local research artifact covering pi APIs, Claude Code, Codex CLI, and repo fit.
- `roadmap.md` — broad product direction.
- `milestones.md` — proposed milestone sequence.
- `m1-read-only-plan-mode.md` — M1 SPEC and acceptance criteria.
- `m2-plan-capture-approval-ux.md` — M2 SPEC and acceptance criteria.
- `m3-execution-progress-handoff.md` — M3 SPEC and acceptance criteria.
- `m4-goal-worker-integration-boundary.md` — M4 boundary contract for future goal/worker integrations.
- `m5-plan-artifact-lifecycle-session-indexing.md` — M5 artifact lifecycle and session indexing plan.
- `m6-natural-language-plan-routing.md` — M6 natural-language routing plan.
- `log.md` — append-only decisions and handoff history.
- `archive.md` — completed/superseded docs index.
- `versions/README.md` — future versioned planning convention.
- `AGENTS.md` — docs governance.

## Naming

Chosen package/doc name: `pi-extension-plan-mode`.

Rationale:

- It describes a top-level planning mode, not worker orchestration.
- It does not duplicate `pi-extension-agent-workers`.
- It follows the repo convention where `docs/<package-name>/` exactly matches `packages/<package-name>/`.
