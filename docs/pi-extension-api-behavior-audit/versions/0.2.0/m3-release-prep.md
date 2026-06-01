# v0.2.0 M3 — Release prep

## Status

Done.

## SPEC

Prepare and seal the v0.2.0 local package release after M1 and M2 are complete.

Scope:

- Update package version to `0.2.0`.
- Update `packages/pi-extension-api-behavior-audit/CHANGELOG.md` with programmatic lifecycle and automation runner notes.
- Ensure `package.json` `files` includes any new source files needed at runtime.
- Update README tool examples for:
  - `api_audit_start_capture`,
  - `api_audit_stop_capture`,
  - `api_audit_list_active_captures`,
  - automated capture with `automationScript`.
- Seal docs:
  - mark v0.2.0 stable/current in `../index.md`,
  - update `../archive.md`,
  - append release note to `../log.md`,
  - mark this version index as released/sealed.

Non-goals:

- No npm publish unless explicitly requested.
- No git tag unless explicitly requested.

## AC

- Package metadata reports `0.2.0`.
- Changelog and README mention new programmatic lifecycle tools.
- Version docs are sealed and archived.
- Verification passes:

```bash
node -e "const p=require('./packages/pi-extension-api-behavior-audit/package.json'); if (p.version !== '0.2.0') process.exit(1)"
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

## Status tracking

At start:

- Mark `v0.2.0 M3` as `In progress` in `versions/0.2.0/milestones.md`.
- Append a start entry to `versions/0.2.0/log.md`.

At completion:

- Run the verification commands above.
- Mark `v0.2.0 M3` as `Done`.
- Add completion notes here.
- Append completion notes with verification evidence to `versions/0.2.0/log.md` and parent `log.md`.

## Completion notes

Completed v0.2.0 release prep as a local package release. Package metadata and lockfile now report `0.2.0`; changelog documents programmatic capture lifecycle, automation runner, and review helper changes; README documents start/stop/list, automation-script usage, and review helper usage; release policy tracks the current package version; root/version docs are sealed; and archive indexes v0.2.0.

No npm publish or git tag was created.

Verification passed:

```bash
node -e "const p=require('./packages/pi-extension-api-behavior-audit/package.json'); if (p.version !== '0.2.0') process.exit(1)"
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
