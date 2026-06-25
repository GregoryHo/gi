# Agent Lens 0.5.0

## Status

- Version: `0.5.0`
- Status: Active planning; implementation not started.
- Expected base: `0.4.1`
- Theme: Multi-agent swimlane + topology foundation.
- Package: `packages/pi-extension-agent-lens`

## Product goal

0.5.0 should help users understand how agent activity, worker/teammate activity, tools, provider requests, memory events, and partial session topology relate over time.

The release is a **balanced bridge**:

1. model safe topology relationships first;
2. render a swimlane timeline for time-based reading;
3. add a partial topology explorer for relationship-based reading.

## Product decisions

- Track: **Balanced bridge**.
- Data strategy: **Hybrid**.
  - Start with existing redacted trace metadata.
  - M1 performs evidence inventory and gap analysis.
  - Add minimal new redacted metadata only if M1 shows it is necessary.
- Worker/agent metadata strategy: **M1 decide**.
  - Do not pre-commit to new worker/agent capture hooks.
  - M1 must identify available metadata and justify any proposed new fields.
- Safety stance: metadata-only by default, static/local-first reports, no raw content capture.

## Planning docs

- `plan-spec.md` — version-level product spec, implementation plan, gates, and verification baseline.
- `milestones.md` — milestone tracker and release criteria.
- `log.md` — append-only 0.5.0 planning and implementation history.

## Proposed scope

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Proposed | `m1-safe-topology-model.md` | Safe topology model, evidence inventory, gap analysis, and metadata-capture decision. |
| M2 | Proposed | `m2-swimlane-timeline.md` | Static report swimlane timeline view using the M1 topology/lane model. |
| M3 | Proposed | `m3-partial-topology-explorer.md` | Partial topology explorer linking agent/session/tool/provider/memory relationships where safely observable. |

## Non-goals

- Raw prompt, provider payload, tool output, session entry content, or compaction summary capture.
- Behavior evaluation, scoring, model-judge views, or user-authored review labels.
- Full replay/eval harness.
- Full session branch tree reconstruction.
- Local server/WebSocket mode.
- Frontend framework, build step, or new package dependencies unless explicitly re-scoped.
- Mutating pi prompts, sessions, provider payloads, or compaction behavior.

## Verification baseline

Any accepted implementation milestone should pass:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke should cover `/agent-lens report`, `/agent-lens index`, `/agent-lens compare`, and any new swimlane/topology controls introduced by the milestone.
