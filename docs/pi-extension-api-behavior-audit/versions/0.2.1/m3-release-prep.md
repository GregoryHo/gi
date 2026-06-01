# v0.2.1 M3 — Release prep

## Status

Done.

## SPEC

Package and seal v0.2.1 as a local package release.

Scope:

- Bump `packages/pi-extension-api-behavior-audit/package.json` from `0.2.0` to `0.2.1`.
- Update root `package-lock.json` workspace package version.
- Add dated `0.2.1` changelog notes.
- Seal v0.2.1 docs and update current-version references.
- Update release policy current package version.

Non-goals:

- No npm publish.
- No git tag unless explicitly requested.

## Completion notes

Completed v0.2.1 release prep as a local package release. Package metadata and lockfile now report `0.2.1`; changelog documents persistent proxy/window lifecycle and comparison artifact generation; root/version docs are sealed; archive indexes v0.2.1; and release policy tracks the current package version.

No npm publish or git tag was created.

Verification passed:

```bash
node -e "const p=require('./packages/pi-extension-api-behavior-audit/package.json'); if (p.version !== '0.2.1') process.exit(1)"
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
