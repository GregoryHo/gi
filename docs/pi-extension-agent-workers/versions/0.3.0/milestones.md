# Agent workers v0.3.0 milestone tracker

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M1 Version planning setup | Done | Establish versioned v0.3.0 planning docs and root index pointer | Docs only; no runtime changes. Plan: `m1-version-planning-setup.md` |
| M2 Workspace-scoped history | Done | Scope run identity/history by git root or cwd | Implemented scope metadata, scoped history defaults, all-workspaces history, and backward-compatible old entries. Plan: `m2-workspace-scoped-history.md` |
| M3 Original task preview cleanup | Done | Preserve and display the user's original delegated task instead of injected profile/system prompts | New runs store original task previews while resolved worker prompts still execute. Plan: `m3-original-task-preview-cleanup.md` |
| M4 Workspace-scoped config | Done | Add per-workspace local config for safe preferences | Implemented `/worker-config`, safe local config, worker/history/widget defaults, and confirmation-safe request resolution. Plan: `m4-workspace-scoped-config.md` |
| M5 Widget/TUI capability PoC | Done | Experimentally determine what pi widget/TUI APIs can support for worker display/control | Decision: original-style compact `card-widget` is the preferred persistent widget direction; overlay sidepanel remains a detailed cockpit candidate. Decision: `m5-ui-capability-decision.md` |
| M6 Worker UI direction implementation | Done | Implement the UI direction selected after M5 | Implemented compact card-style default widget with component-factory width awareness, slot/start time, truncation, and 5s refresh. Plan: `m6-worker-ui-direction-implementation.md` |
| M7 Custom profiles from config | Done | Allow workspace-defined worker profiles with safety metadata | Implemented local workspace config `profiles` validation, merge/list/resolve, built-in override rejection, and real-adapter confirmation safety. Plan: `m7-custom-profiles-from-config.md` |
| M8 v0.3.0 release prep | Done | Package v0.3.0 docs/runtime changes as a local release | Bumped package to 0.3.0, promoted changelog, sealed docs, updated release policy, and passed release verification. No publish/tag. Plan: `m8-v0.3.0-release-prep.md` |

## Candidate verification baseline

Each runtime milestone should normally pass:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Milestone-specific plans may add focused tests or manual UI smoke checks.
