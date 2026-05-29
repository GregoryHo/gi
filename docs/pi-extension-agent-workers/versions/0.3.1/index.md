# Agent workers v0.3.1 planning index

## Status

- Version: `0.3.1`
- Package: `packages/pi-extension-agent-workers`
- Status: Released / sealed local package patch
- Branch: current working branch

## Theme

Maintenance patch to remove the temporary Worker UI PoC runtime command after the accepted widget direction shipped as the default `agent-workers` widget in v0.3.0, and to prevent orphaned historical active runs from appearing as indefinitely running in history/widget displays.

## Milestones

- `M1 — Remove worker-ui-poc command, stale historical running display, and patch release` — `m1-remove-worker-ui-poc-command.md`

See `milestones.md` for the tracker.

## Scope

- Remove the public `/worker-ui-poc` slash command from runtime registration and help output.
- Remove PoC-only source and tests that were only reachable through `/worker-ui-poc`.
- Mark historical active runs left by interrupted/reloaded sessions as stale failed history in list/history/widget paths.
- Keep historical v0.3.0 PoC docs intact for traceability.
- Bump the package to `0.3.1` and update release docs.

## Non-goals

- No production widget layout/rendering changes beyond receiving normalized stale historical run statuses from history.
- No new UI surface or replacement cockpit command.
- No npm publish or git tag unless explicitly requested.
