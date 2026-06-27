# M1 — GitHub clone usability

## Status

Done.

## SPEC

### Goal

Make the public GitHub clone-and-install path self-documenting for users who do not know this repository or the author's local setup.

### Scope

Update docs only:

- Root `README.md`:
  - Add `packages/pi-extension-web-search` to the package list.
  - Explain that this is a monorepo of personal pi packages.
  - Point Web Search users to the package README.
- `packages/pi-extension-web-search/README.md`:
  - Add clone-and-install flow:
    - `git clone <repo>`
    - `npm install`
    - `pi install ./packages/pi-extension-web-search`
  - Add temporary trial flow with `pi -e ./packages/pi-extension-web-search`.
  - Add prerequisites:
    - pi installed.
    - Node/npm compatible with the repo.
    - OpenAI/Codex auth through pi or `OPENAI_API_KEY`.
  - Add usage examples for the four tools.
  - Add limitations/non-goals:
    - no browser cookies.
    - no JavaScript rendering.
    - no persistent storage.
    - no PDF/video/GitHub clone special handling.
    - no multi-provider fallback.
  - Add troubleshooting section for auth failure, blocked/private URL failures, app-rendered pages, and truncated content continuation.
  - Clarify that direct monorepo root `pi install git:...` is not the supported path for 1.0.0.

### Non-goals

- Runtime behavior changes.
- Version bump.
- npm publication.
- Direct `pi install git:github.com/<owner>/<repo>` support from the monorepo root.
- New search/fetch capabilities.

### Design notes

- Keep the README honest: this package is intentionally smaller than broad web-access suites.
- Prefer copy-pasteable commands.
- Do not mention private local paths or unpublished repository names where a placeholder is more accurate.

### Expected files

- `README.md`
- `packages/pi-extension-web-search/README.md`

## AC

- A new user can identify Web Search from the root README.
- The package README contains a complete clone → install → use path.
- The package README documents auth requirements and safe limitations.
- The package README includes clear troubleshooting for the most likely first-run failures.
- No runtime source files are changed.

## Verification

```bash
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run typecheck
```

Manual doc check:

```bash
rg "pi-extension-web-search|Web Search" README.md packages/pi-extension-web-search/README.md
rg "pi install ./packages/pi-extension-web-search|pi -e ./packages/pi-extension-web-search" packages/pi-extension-web-search/README.md
```

## Status tracking

At start:

- Mark M1 `In progress` in `milestones.md`.
- Append a start entry to `log.md`.

At completion:

- Mark M1 `Done` in `milestones.md`.
- Add completion notes here.
- Append verification evidence to `log.md`.

## Completion notes

Completed on 2026-06-26.

Implemented docs updates:

- Root `README.md` now lists `packages/pi-extension-web-search`, includes local trial/install commands, and points users to the package README.
- `packages/pi-extension-web-search/README.md` now documents clone-and-install usage, prerequisites, auth paths, tools, limitations/non-goals, troubleshooting, and verification commands.
- The README explicitly clarifies that direct monorepo-root `pi install git:...` is not the supported 1.0.0 path.

Verification passed:

```bash
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run typecheck
rg "pi-extension-web-search|Web Search" README.md packages/pi-extension-web-search/README.md
rg "pi install ./packages/pi-extension-web-search|pi -e ./packages/pi-extension-web-search" packages/pi-extension-web-search/README.md
```
