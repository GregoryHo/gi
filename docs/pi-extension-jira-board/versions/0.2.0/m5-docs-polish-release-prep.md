# M5 plan — v0.2.0 docs, polish, and release prep

## Status

Done.

## Objective

Prepare Jira board extension v0.2.0 for local package release after M1-M4 implementation and manual smoke verification.

## Scope

M5 includes:

1. Final package README update for v0.2.0 behavior.
2. Final package CHANGELOG update for v0.2.0.
3. Package metadata polish, including version bump where appropriate.
4. Version docs/index/log/milestone cleanup.
5. Full automated verification.
6. Package dry-run verification.
7. Record final release-prep evidence.

## Non-goals

- New feature behavior.
- New Jira write capabilities.
- Relaxing write confirmation requirements.
- Reworking already accepted M1-M4 UX unless a release blocker is found.

## Release checklist

- [x] README accurately documents onboarding, encrypted local config, cockpit, browsing, board scopes, issue filters, `/jira-clear`, and write safety.
- [x] CHANGELOG has a complete v0.2.0 entry.
- [x] Package metadata reflects the release version.
- [x] Package `files` allowlist includes all runtime source files.
- [x] Version docs status reflects release readiness.
- [x] Full verification passes.
- [x] Pack dry-run includes expected files and no secrets.

## Verification

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

## AC

M5 is complete when:

1. Docs and changelog describe v0.2.0 behavior without stale M4 references.
2. Package metadata is ready for v0.2.0 installation/packaging.
3. Automated verification and pack dry-run pass.
4. Release-prep evidence is recorded in the v0.2.0 log.

Result: complete.
