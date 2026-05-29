# Extension planning docs

This directory contains product/spec planning areas for pi extension packages in this repo.

## Package mapping

- `docs/pi-extension-jira-board/` → `packages/pi-extension-jira-board/`
- `docs/pi-extension-api-behavior-audit/` → `packages/pi-extension-api-behavior-audit/`
- `docs/pi-extension-agent-workers/` → `packages/pi-extension-agent-workers/`

## Repo-wide docs

- `release-policy.md` — package version ownership and tag naming policy for this monorepo.

## Convention

Use `docs/<package-name>/` for planning docs, where `<package-name>` exactly matches the package directory under `packages/`.

For non-trivial packages, keep:

- `AGENTS.md` — product/spec documentation governance.
- `index.md` — current status and navigation.
- `roadmap.md` — broad product direction.
- `milestones.md` — active or historical milestone tracker.
- `log.md` — append-only decision, release, and handoff history.
- `archive.md` — completed or superseded docs retained for traceability.
