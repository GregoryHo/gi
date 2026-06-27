# Plan mode extension docs index

## Current status

- Package: `packages/pi-extension-plan-mode`
- Status: scaffolded; no runtime plan mode behavior implemented yet.
- Active milestone: proposed M1, pending review.

## Navigation

- `research.md` — local research artifact covering pi APIs, Claude Code, Codex CLI, and repo fit.
- `roadmap.md` — broad product direction.
- `milestones.md` — proposed milestone sequence.
- `m1-read-only-plan-mode.md` — M1 SPEC and acceptance criteria.
- `m2-plan-capture-approval-ux.md` — proposed M2 SPEC and acceptance criteria.
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
