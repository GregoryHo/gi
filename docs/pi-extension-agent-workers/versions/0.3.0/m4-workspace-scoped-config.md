# v0.3.0 M4 — Workspace-scoped config

## Status

Done.

## SPEC

Add a local config model for safe workspace-scoped agent-worker preferences.

Scope:

- Define config storage under the existing local artifact/config area, outside git-tracked paths.
- Scope config by the same workspace model introduced in M2.
- Add read/update command surfaces for workspace config.
- Add compact tool surfaces only if useful and safe.
- Apply safe defaults from config when starting workers.

Candidate config fields:

- default profile
- default adapter
- default timeout
- history default scope/limit
- widget placement/limit

Safety constraints:

- Do not store credentials or raw private context.
- Config must not silently weaken real-worker confirmation.
- Destructive/write-capable behavior still requires explicit confirmation.
- Invalid config should fail closed with actionable messages.

Possible surfaces:

- `/worker-config`
- `/worker-config set <key> <value>`
- Optional: `agent_worker_get_config`
- Optional: `agent_worker_set_config` with explicit confirmation for writes

Non-goals:

- No custom profile definitions; that is M7.
- No global policy engine.
- No secrets management.

## AC

- Config is read from and written to local ignored storage.
- Config resolution is workspace-scoped and falls back to safe defaults.
- `/worker-config` shows effective config without secrets/private payloads.
- Config updates validate known keys/values.
- Real adapters still require confirmation by default, regardless of config.
- Tests cover config read/write, malformed config fallback/error behavior, workspace scoping, and safe confirmation semantics.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

## Status tracking

At start:

- Mark `v0.3.0 M4` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M4` as `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.3.0/log.md`.

## Completion notes

Implemented workspace-scoped safe config:

- Added `src/config.ts` with per-workspace config files under local ignored agent-worker config storage.
- Added safe config fields for `defaultProfile`, `defaultAdapter`, `defaultTimeoutMs`, `historyScope`, `historyLimit`, `widgetPlacement`, and `widgetLimit`.
- Added `/worker-config` and `/worker-config set <key> <value>`.
- Applied config defaults to command/tool worker start confirmation planning and service starts without allowing config to disable real-worker confirmation.
- Applied config defaults to `/worker-history` scope/limit behavior.
- Applied config defaults to worker widget limit and placement.
- Exported config helpers from package entrypoint and included `src/config.ts` in the package file list.
