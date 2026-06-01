# API behavior audit v0.2.1 milestone tracker

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M1 Persistent proxy/window lifecycle | Done | Agents can keep old/new proxy sockets alive while starting/stopping clean recording windows | Added persistent proxy registry and tools: `api_audit_start_proxy_session`, `api_audit_start_recording_window`, `api_audit_stop_recording_window`, `api_audit_stop_proxy_session`, `api_audit_list_proxy_sessions`. |
| M2 Window comparison/review integration | Done | Recording windows can be promoted to comparison artifacts for local viewer/review workflow | `api_audit_stop_recording_window` now writes `.pi-api-audit-runs/comparisons/<comparisonRunId>.json` and returns `comparisonPath` for analyze/suggest/review. |
| M3 v0.2.1 release prep | Planned | Package and seal v0.2.1 docs/changelog/version after milestones pass | No publish/tag unless explicitly requested. |

## Verification baseline

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
