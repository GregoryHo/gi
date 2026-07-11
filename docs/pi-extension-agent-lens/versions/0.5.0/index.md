# Agent Lens 0.5.0

## Status

- Version: `0.5.0`
- Status: Sealed on 2026-07-11 after M1/M2/M3 completion, automated verification, static smoke, and acceptance.
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
| M1 | Done | `m1-safe-topology-model.md` | Safe topology model, evidence inventory, gap analysis, and metadata-capture decision. |
| M2 | Done | `m2-swimlane-timeline.md` | Static report swimlane timeline view using the M1 topology/lane model. |
| M3 | Done | `m3-partial-topology-explorer.md` | Partial topology explorer linking agent/session/tool/provider/memory relationships where safely observable. |

## Release notes

0.5.0 delivered the multi-agent swimlane + topology foundation without changing capture defaults:

- Added a pure metadata-only topology model for trace, run, turn, provider request, tool activity, context snapshot, compaction, and memory event nodes.
- Added observed, nearby observed, inferred, and missing relationship confidence labels.
- Documented evidence inventory and concluded that existing trace metadata is sufficient for the first swimlane/topology pass; no new capture hooks were added.
- Added a static `#swimlane-timeline` report section with main-agent, provider, tools, memory/compaction, and worker/teammate unavailable lanes.
- Added a static `#partial-topology-explorer` report section linking topology relationships to swimlane nodes and observable-log records where available.
- Preserved static/local reports, no raw content capture, no network/server mode, no frontend framework, and no new package dependencies.

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

Static smoke was completed on 2026-07-11 for `/agent-lens report`, `/agent-lens index`, and `/agent-lens compare` generation paths, including swimlane/topology sections, topology links, missing worker metadata wording, and raw summary text exclusion.
