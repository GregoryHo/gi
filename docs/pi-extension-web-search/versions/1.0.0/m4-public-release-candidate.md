# M4 — Public release candidate hardening

## Status

Done.

## SPEC

### Goal

Validate that the public GitHub clone flow works outside the author's current checkout before bumping to 1.0.0.

### Scope

- Create a clean clone smoke checklist for the public repository.
- Run the standard package verification commands.
- Run a clean clone install smoke from a temporary directory.
- Run pi load smoke from the clean clone.
- Run `/web-search-doctor` from the clean clone after M3 exists.
- Record authenticated live search smoke evidence if credentials are available in the test environment.
- Fix only release-blocking docs/package issues found during the smoke.

Clean clone target flow:

```bash
git clone <public-repo-url> /tmp/pi-web-search-smoke
cd /tmp/pi-web-search-smoke
npm install
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
pi -e ./packages/pi-extension-web-search
```

### Non-goals

- Large runtime features.
- Provider expansion.
- npm publication.
- Direct root `pi install git:...` support.
- Cosmetic README rewrites not needed for clone usability.

### Design notes

- This milestone is a release-candidate gate. Prefer finding packaging/docs gaps over adding features.
- If the clean clone reveals monorepo friction, document the exact supported path rather than hiding it.
- Authenticated live search can remain manual because it depends on local pi/OpenAI login or `OPENAI_API_KEY`.

### Expected files

Likely docs only unless smoke finds a real blocker:

- `docs/pi-extension-web-search/versions/1.0.0/m4-public-release-candidate.md`
- `docs/pi-extension-web-search/versions/1.0.0/log.md`
- package README or metadata files if fixes are needed

## AC

- Standard verification passes in the working checkout.
- Clean clone install succeeds with documented commands.
- Clean clone package tests/typecheck/pack dry-run pass.
- Clean clone pi load smoke succeeds.
- `/web-search-doctor` works from the clean clone after M3.
- Any authenticated live smoke result is recorded, or explicitly marked unavailable due to missing credentials in the smoke environment.

## Verification

Working checkout:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```

Clean clone:

```bash
rm -rf /tmp/pi-web-search-smoke
git clone <public-repo-url> /tmp/pi-web-search-smoke
cd /tmp/pi-web-search-smoke
npm install
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
pi -e ./packages/pi-extension-web-search
```

## Status tracking

At start:

- Mark M4 `In progress` in `milestones.md`.
- Append a start entry to `log.md`.

At completion:

- Mark M4 `Done` in `milestones.md`.
- Add completion notes here with clean clone evidence.
- Append verification evidence to `log.md`.

## Completion notes

Completed on 2026-06-26.

Release-candidate hardening notes:

- Public clean clone from `https://github.com/GregoryHo/gi` succeeded at commit `c429980`.
- Initial M4 attempt before pushing M1-M3 changes correctly failed because the public clone did not yet contain `src/doctor.ts`; this was recorded in `log.md`.
- Pushed the Web Search public release-candidate commits to `origin/main` so the default clone path contains the package.
- Added print-mode output for `/web-search-doctor` after discovering `ctx.ui.notify` does not produce visible output under `pi -p`; this was implemented with TDD and pushed before the final clean clone smoke.
- `npm install` in the clean clone completed with npm audit warnings (`4 high severity vulnerabilities`) but exit 0. Dependency audit remediation is outside M4 scope.

Final clean clone verification passed:

```bash
rm -rf /tmp/pi-web-search-smoke && git clone https://github.com/GregoryHo/gi /tmp/pi-web-search-smoke && cd /tmp/pi-web-search-smoke && git rev-parse --short HEAD && test -f packages/pi-extension-web-search/src/doctor.ts && rg "web-search-doctor" packages/pi-extension-web-search README.md && npm install && npm test --workspace @gregho/pi-extension-web-search && npm run typecheck --workspace @gregho/pi-extension-web-search && npm run pack:dry-run --workspace @gregho/pi-extension-web-search && npm run typecheck && pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o && pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session -p "/web-search-doctor"
```

Evidence:

- Public clone HEAD: `c429980`.
- Package tests: `38` tests passed.
- Package typecheck: passed.
- Package pack dry-run: passed.
- Root workspace typecheck: passed.
- Pi load smoke exited successfully and printed `No models matching "gpt-4o"`.
- `/web-search-doctor` print-mode smoke printed the redacted diagnostics report.
