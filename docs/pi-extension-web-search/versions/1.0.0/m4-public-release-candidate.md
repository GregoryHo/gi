# M4 — Public release candidate hardening

## Status

Planned.

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
