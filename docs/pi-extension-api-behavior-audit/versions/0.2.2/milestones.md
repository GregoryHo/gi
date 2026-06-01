# API behavior audit v0.2.2 milestone tracker

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M1 Path-based passthrough routes | Done | Local legacy services can route frontend/static path prefixes to the correct service while API paths continue through the recorder | Added `passthroughRoutes` to recording proxy and target profile v2 resolution. |
| M2 Review viewer curation clarity | Done | `review.html` clearly behaves as candidate endpoint curation rather than old/new behavior diff | Includes all `candidates/*.json` suggestions even before matching comparison evidence is accepted into SOT. |
| M3 v0.2.2 release prep | Done | Package and seal v0.2.2 docs/changelog/version after verification | Bumped package/lockfile to 0.2.2, updated changelog/release policy/docs, and passed release verification. No npm publish. |

## Verification baseline

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
