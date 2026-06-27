# M2 — Public metadata and license

## Status

Done.

## SPEC

### Goal

Make the package and repository safe and understandable as a public GitHub project.

### Scope

- Add a root `LICENSE` file, expected default: MIT unless the author chooses otherwise.
- Update `packages/pi-extension-web-search/package.json` with public metadata:
  - `license`
  - `repository`
  - `bugs`
  - `homepage`
  - optional `author`
- Update `docs/release-policy.md` package table to include `@gregho/pi-extension-web-search` and its current version.
- Audit `.gitignore` for common local/secrets artifacts relevant to this package.
- Consider package tarball hygiene:
  - either keep tests in `npm pack --dry-run` intentionally, or add a package-level `files` list.
  - For GitHub clone use, tests in the repo are useful; for npm publication, a `files` list can be revisited later.

### Non-goals

- Runtime behavior changes.
- Version bump to 1.0.0.
- npm publication.
- Renaming the package.
- Changing package scope from `@gregho/...`.

### Design notes

- Public metadata should not imply npm publication if npm is not planned.
- Repository URLs may use the final public GitHub URL if known; otherwise leave a placeholder only if the repo is not public yet.
- Keep credentials out of config examples; use environment-variable names only.

### Expected files

- `LICENSE`
- `packages/pi-extension-web-search/package.json`
- `docs/release-policy.md`
- `.gitignore` if needed
- `packages/pi-extension-web-search/README.md` if metadata choices need documentation

## AC

- The public repository has a clear license.
- Package metadata points users to the repository, issue tracker, and README.
- Release policy lists Web Search with the correct current version.
- No secrets or local credential paths are introduced.
- `npm pack --dry-run` output is reviewed and either accepted or narrowed intentionally.

## Verification

```bash
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```

Manual checks:

```bash
node -e "const p=require('./packages/pi-extension-web-search/package.json'); console.log(p.license, p.repository, p.bugs, p.homepage)"
git status --short
```

## Status tracking

At start:

- Mark M2 `In progress` in `milestones.md`.
- Append a start entry to `log.md`.

At completion:

- Mark M2 `Done` in `milestones.md`.
- Add completion notes here.
- Append verification evidence to `log.md`.

## Completion notes

Completed on 2026-06-26.

Implemented changes:

- Added root `LICENSE` using MIT terms.
- Added `license`, `author`, `repository`, `bugs`, and `homepage` metadata to `packages/pi-extension-web-search/package.json`.
- Used the current git remote `git@github.com:GregoryHo/gi.git`, represented publicly as `https://github.com/GregoryHo/gi`.
- Added `@gregho/pi-extension-web-search` version `0.6.2` to `docs/release-policy.md`.
- Audited `.gitignore`; existing entries already cover `.env`, `.env.*`, `node_modules/`, and package runtime artifact directories, so no change was needed.
- Reviewed `npm pack --dry-run`; test files remain included intentionally for the current GitHub-clone-focused workflow. A narrower package `files` list can be added later if npm publication becomes a goal.

Verification passed:

```bash
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
node -e "const p=require('./packages/pi-extension-web-search/package.json'); console.log(p.license, p.repository, p.bugs, p.homepage)"
git status --short
```
