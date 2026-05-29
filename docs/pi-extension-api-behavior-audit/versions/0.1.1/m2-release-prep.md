# v0.1.1 M2 — Release prep

## Status

Done.

## SPEC

Package the workspace path fix as the v0.1.1 patch release.

Scope:

- Bump `packages/pi-extension-api-behavior-audit/package.json` from `0.1.0` to `0.1.1`.
- Add a dated `0.1.1` section to `packages/pi-extension-api-behavior-audit/CHANGELOG.md` summarizing the path fix.
- Update README/help text if v0.1.1 changes default path wording.
- Seal v0.1.1 docs:
  - update `versions/0.1.1/index.md` status,
  - update `versions/0.1.1/milestones.md`,
  - append release verification to `versions/0.1.1/log.md`,
  - update root `index.md`, `archive.md`, and root `log.md` as needed.

Non-goals:

- No publish or tag unless explicitly requested.
- No additional runtime behavior beyond M1.
- No artifact/profile migration.

Expected files:

- `packages/pi-extension-api-behavior-audit/package.json`
- `packages/pi-extension-api-behavior-audit/CHANGELOG.md`
- `packages/pi-extension-api-behavior-audit/README.md` if default path docs need clarification
- `docs/pi-extension-api-behavior-audit/versions/0.1.1/*`
- `docs/pi-extension-api-behavior-audit/index.md`
- `docs/pi-extension-api-behavior-audit/archive.md`
- `docs/pi-extension-api-behavior-audit/log.md`
- `docs/release-policy.md` current package version row if this repo continues tracking package versions there

## AC

- Package version is `0.1.1`.
- Changelog contains the v0.1.1 workspace path fix.
- v0.1.1 docs are marked complete/released or ready-for-release with verification evidence.
- Release policy uses package-scoped tag wording if tagging is later requested.

Verification:

```bash
node -p "require('./packages/pi-extension-api-behavior-audit/package.json').version"
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Optional tag command only after explicit user approval:

```bash
git tag pi-extension-api-behavior-audit/v0.1.1
```

## Status tracking

At start:

- Mark `v0.1.1 M2` as `In progress` in `versions/0.1.1/milestones.md`.
- Append a start entry to `versions/0.1.1/log.md`.

At completion:

- Run the verification commands above.
- Mark `v0.1.1 M2` as `Done`.
- Add completion notes here.
- Append release/sealing notes to `versions/0.1.1/log.md` and root `log.md`.

## Completion notes

Completed v0.1.1 release prep as a local package release. Package metadata and lockfile now report `0.1.1`, changelog documents the workspace path fix, root/version docs are sealed, archive indexes v0.1.1, and release policy tracks the current package version.

A follow-up before publish/tag removed runtime package scenario fallback: scenario dictionaries are workspace/repo-owned, conventionally `.pi-api-audit-runs/scenarios.local.json`, and package scenario data is example-only.

No npm publish or git tag was created.

Verification passed:

```bash
node -p "require('./packages/pi-extension-api-behavior-audit/package.json').version"
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
