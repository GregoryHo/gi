# API behavior audit v0.1.1 planning index

## Status

- Version: `0.1.1`
- Package: `packages/pi-extension-api-behavior-audit`
- Status: Released / sealed local package release
- Branch: `feature/api-behavior-audit-v0.1.1-path-fix`

## Theme

Workspace-aware path resolution.

v0.1.1 fixes a portability bug in v0.1.0: local runtime paths currently behave as relative to whichever process/package directory happens to run the extension. When the extension is installed or tested from this repo, default artifacts and profile config can accidentally be read from or written to the extension project instead of the user's active pi workspace.

The extension should resolve workspace-local paths from the user's active pi `ctx.cwd`, preferring the Git root when available and falling back to `ctx.cwd` outside Git repositories.

## Milestones

- `M1 — Workspace path resolution` — `m1-workspace-path-resolution.md`
- `M2 — v0.1.1 release prep` — `m2-release-prep.md`

See `milestones.md` for the sealed tracker.

## Design direction

### Workspace root model

Prefer workspace identity in this order:

1. Git root discovered from pi `ctx.cwd`.
2. Normalized pi `ctx.cwd` when no Git root is available.

Do not use the extension package directory or this monorepo root as a runtime default unless the user actually launched pi from this repo.

### Path categories

- **Workspace-local mutable state** — `.pi-api-audit-runs`, profile `config.local.json`, workspace scenario dictionary `scenarios.local.json`, comparisons, analyses, candidates, run directories, and generated viewer files. Defaults and relative paths should resolve under the workspace root.
- **User-supplied local SOT overrides** — `--scenario-dictionary`, `--manifest`, `--comparison`, `--analysis`, and `--suggestion` should resolve relative to the same workspace root when not absolute.
- **Package assets** — bundled schemas remain package-relative via `import.meta.url`/package loaders. Scenario dictionaries in the package are examples only and are not runtime fallbacks.
- **URLs and host allowlists** — unchanged.

### User-visible behavior

Commands/tools should make the resolved workspace root and artifact directory visible in preparation/status output so accidental writes are obvious before capture starts.

## Non-goals

- No artifact schema change.
- No automatic migration of existing `.pi-api-audit-runs` directories.
- No change to capture semantics, redaction, comparison analysis, suggestion validation, or scenario dictionary evidence semantics.
- No production/staging capture defaults.
