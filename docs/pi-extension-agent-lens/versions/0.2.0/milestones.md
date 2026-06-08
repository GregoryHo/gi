# Agent Lens 0.2.0 milestones

## Tracker

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-config-profiles.md` | Config profiles and status visibility. |
| M2 | Done | `m2-retention-cleanup.md` | Retention metadata and explicit cleanup commands. |
| M3 | Done | `m3-multi-trace-index.md` | Multi-trace index report/dashboard. |

## Sequencing rationale

1. **M1 config first** because retention and index generation need stable settings such as artifact root, refresh interval, and retention policy.
2. **M2 retention second** because cleanup should understand configured artifact locations and expose safe dry-run behavior before deletion.
3. **M3 index third** because the index can consume trace summaries and retention metadata once those primitives exist.

## Release criteria

0.2.0 should not be sealed until:

- all accepted milestones are `Done`;
- package changelog includes 0.2.0 entries;
- root docs point current stable to 0.2.0;
- automated verification passes;
- manual smoke covers `/agent-lens`, `/agent-lens report`, `/agent-lens traces`, any new config/cleanup/index commands.

## Deferred beyond 0.2.0

- Raw capture opt-in implementation.
- Local server/WebSocket report mode.
- Trace comparison/eval views.
- Session memory branch explorer.
- Advanced report visualizations beyond a basic index/dashboard.
