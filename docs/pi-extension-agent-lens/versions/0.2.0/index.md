# Agent Lens 0.2.0

## Status

- Version: `0.2.0`
- Status: Sealed after implementation, automated verification, and user manual acceptance.
- Theme: Operationalization for longer-running local use.
- Package: `packages/pi-extension-agent-lens`
- Stable base: `0.1.0`

## Product goal

Make Agent Lens comfortable to leave enabled across real projects and repeated pi sessions without losing track of artifacts or growing unmanaged trace files.

0.1.0 proved the basic capture/report loop. 0.2.0 improved day-to-day operation:

1. Make behavior configurable without compromising safe defaults.
2. Make trace artifacts discoverable and cleanable.
3. Add an index-level view across traces, not just single-trace reports.

## Delivered scope

| Milestone | Status | Plan | Scope |
| --- | --- | --- | --- |
| M1 | Done | `m1-config-profiles.md` | Config profiles and status visibility. |
| M2 | Done | `m2-retention-cleanup.md` | Retention metadata and explicit cleanup commands. |
| M3 | Done | `m3-multi-trace-index.md` | Multi-trace index report/dashboard. |

## User-facing commands added or expanded

- `/agent-lens` — now shows config source, capture profile, and config warnings.
- `/agent-lens traces` — now shows trace size and modified time.
- `/agent-lens clean --dry-run` — previews retention cleanup.
- `/agent-lens clean --confirm` — executes explicit retention cleanup while protecting active artifacts.
- `/agent-lens index` — writes `.pi-agent-lens/index.html` multi-trace index.

## Non-goals for 0.2.0

- Raw prompt/provider payload capture by default.
- Background daemon or external service.
- Local server/WebSocket live mode.
- Behavior comparison/eval views.
- Session memory branch explorer.
- Any mutation of prompts, context, provider payloads, compaction output, or session entries.

## Safety stance

0.2.0 keeps the 0.1.0 default posture:

- read-only extension behavior;
- local-only artifacts;
- redacted/truncated summaries by default;
- no raw capture implementation;
- cleanup is explicit and user-initiated.

## Verification evidence

Automated verification passed after release cleanup:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

User completed manual acceptance for 0.2.0 behavior before sealing.
