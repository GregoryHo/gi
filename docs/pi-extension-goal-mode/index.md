# Goal mode docs index

## Current status

- Package: `packages/pi-extension-goal-mode`
- Package version: `0.0.0`
- Status: M3 Tool-based Plan → Goal Integration implemented and verified; M4 Worker-assisted goal loops is planned for the next implementation slice.
- Active milestone: M4 — Worker-assisted goal loops (planned; implementation not started).

## Product summary

Goal Mode is a pi extension for bounded autonomous objective execution. It turns a user objective into a supervised agent loop with explicit stop conditions, verification policy, and safety gates.

The initial loop design is:

```text
plan -> act -> observe -> verify -> continue/block/done
```

## Boundaries

- Plan mode owns safe planning, plan artifacts, and explicit plan execution handoff.
- Goal mode owns bounded objective loops, iteration limits, verification policy, and stop/block decisions.
- Agent workers own delegated worker processes, worker profiles, workspace preflight, wait/status/cancel, and worker summaries.

## Navigation

- `roadmap.md` — broad product direction and milestone route.
- `milestones.md` — active milestone tracker.
- `m1-bounded-main-session-goal-loop.md` — initial runtime milestone plan.
- `m2-goal-control-plane.md` — pause/resume/cancel and stale follow-up control plane.
- `m3-tool-based-plan-goal-integration.md` — tool-based Plan Mode → Goal Mode orchestration.
- `m4-worker-assisted-goal-loops.md` — planned worker-assisted Goal Mode loops through Agent Workers tools.
- `archive.md` — completed/superseded docs index.
- `versions/README.md` — future versioned planning convention.
- `log.md` — append-only product/change log.
- `AGENTS.md` — docs governance and workflow.
