# Agent workers v0.3.0 planning index

## Status

- Version: `0.3.0`
- Package: `packages/pi-extension-agent-workers`
- Status: Released / sealed local package release
- Branch: `feature/pi-extension-agent-workers-v0.3.0`

## Theme

Workspace-aware worker control surface.

v0.3.0 should make the v0.2.0 multi-worker runtime easier to understand and operate by scoping history/config to the current workspace, preserving the user's original delegated task in displays, and validating what pi's widget/TUI APIs can support before committing to a richer worker UI direction.

## Milestones

- `M1 — Version planning setup` — `m1-version-planning-setup.md`
- `M2 — Workspace-scoped history` — `m2-workspace-scoped-history.md`
- `M3 — Original task preview cleanup` — `m3-original-task-preview-cleanup.md`
- `M4 — Workspace-scoped config` — `m4-workspace-scoped-config.md`
- `M5 — Widget/TUI capability PoC` — `m5-widget-tui-capability-poc.md`
- `M6 — Worker UI direction implementation` — `m6-worker-ui-direction-implementation.md`
- `M7 — Custom profiles from config` — `m7-custom-profiles-from-config.md`
- `M8 — v0.3.0 release prep` — `m8-v0.3.0-release-prep.md`

See `milestones.md` for the active tracker.

## Design notes

### Milestone numbering

Milestones restart per version folder. Use full references such as `v0.3.0 M2` in logs and handoffs to avoid confusion with the historical root milestones.

### Workspace scope model

Prefer workspace identity in this order:

1. Git root when available.
2. Normalized cwd when no git root is available.

The exact persisted fields should be finalized in `v0.3.0 M2`, but likely include `scopeKey`, `scopeLabel`, `gitRoot`, and original run cwd.

### UI direction

Do not pre-commit to native widget v2, overlay cockpit, footer hybrid, or custom TUI before `v0.3.0 M5` completes a capability PoC against the current pi APIs.

Known v0.2.0 widget issues to investigate:

- Completed worker cards take too much vertical space.
- `task` often shows the injected system prompt instead of the user's original delegated task.
- `cwd` basename can be ambiguous across worktrees.
- Truncation gives little context about what was hidden.
- Active and recent/completed workers are not visually separated.

## Non-goals for v0.3.0 planning

- No process reattach for historical runs.
- No cloud worker orchestration.
- No domain-specific Jira coupling in the core runtime.
- No default permission/sandbox bypass flags.
- No permanent custom side panel unless pi APIs prove this is supported and stable.
