# v0.2.2 M2 — Release prep

## Status

Done.

## SPEC

Package and seal v0.2.2 as a local patch release.

Scope:

- Bump `packages/pi-extension-api-behavior-audit/package.json` from `0.2.1` to `0.2.2`.
- Update root `package-lock.json` workspace package version.
- Add dated `0.2.2` changelog notes.
- Seal v0.2.2 docs and update current-version references.
- Update release policy current package version.

Non-goals:

- No npm publish.
- No git tag unless explicitly requested.

## Completion notes

Completed v0.2.2 release prep as a local patch release.

Verification passed:

```bash
node -e "const p=require('./packages/pi-extension-api-behavior-audit/package.json'); if (p.version !== '0.2.2') process.exit(1)"
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
