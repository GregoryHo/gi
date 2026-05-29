# API behavior audit v0.1.1 milestone tracker

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M1 Workspace path resolution | Done | Runtime defaults and relative API-audit paths resolve under the user's pi workspace root, not the extension repo | Implemented workspace resolver, command/tool boundary path resolution, path-visible target prep, tests, and README note. Plan: `m1-workspace-path-resolution.md` |
| M2 v0.1.1 release prep | Done | Package the path fix as v0.1.1 with docs/changelog/version verification | Bumped package/changelog to 0.1.1, sealed docs, updated release policy, and passed release verification. No publish/tag. Plan: `m2-release-prep.md` |

## Verification baseline

Each runtime milestone should normally pass:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

M1 must add focused tests for workspace-root path resolution and command/tool integration. M2 must include release-specific version/changelog checks.
