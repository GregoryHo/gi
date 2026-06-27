# Plan mode docs governance

This directory is the product/spec source of truth for `packages/pi-extension-plan-mode`.

## Required reading order

1. `../../AGENTS.md`
2. `../extension-development-style.md`
3. `index.md`
4. `roadmap.md`
5. `milestones.md`
6. Active milestone plan, such as `m1-read-only-plan-mode.md`

## File rules

- Keep package docs in `docs/pi-extension-plan-mode/`, matching the package directory exactly.
- Record research in `research.md`; do not rely on conversation memory.
- Milestone plan files must include SPEC and AC before implementation begins.
- Keep `log.md` append-only for decisions and handoffs.
- Use `versions/<semver>/` for future version planning after the initial release is sealed.

## Safety rules

- M1 must remain read-only.
- Write-capable execution requires a later explicit milestone and user confirmation design.
- Do not commit runtime artifacts, secrets, or raw private session payloads.
