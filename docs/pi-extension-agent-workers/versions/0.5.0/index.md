# Agent workers v0.5.0 planning index

## Status

- Version: `0.5.0`
- Package: `packages/pi-extension-agent-workers`
- Status: Proposed / not started
- Branch: TBD

## Theme

Post-MVP hardening for the pi SDK-backed worker adapter added in v0.4.0.

v0.4.0 proved the `pi-sdk` adapter can run local pi SDK child sessions through the existing worker runtime. v0.5.0 should focus only on hardening needed before treating pi-native sub-agents as a robust daily workflow, not on building a broad multi-agent platform.

## Decision from v0.4.0 follow-up

No additional code changes should block the v0.4.0 local release. The MVP has passed automated verification and manual `pi-sdk` smoke. The remaining items are important hardening and ergonomics work, but they are better handled in a new versioned planning track so the sealed v0.4.0 release stays small and auditable.

## Necessary upper-bound hardening

These are the next features that are worth considering necessary for a stronger pi-native sub-agent workflow:

1. Explicit child-session turn/budget limits in addition to timeout.
2. Testable child resource-boundary policy so `pi-sdk` children cannot recursively access `agent_worker_*` tools by default.
3. Better `pi-sdk` observability for setup, prompt, missing-final, usage-unknown, cancel, and timeout outcomes.
4. Safe model/profile option pass-through where supported by the pi SDK, without exposing broad provider configuration.
5. Cross-mode orchestration recipes for Plan Mode → Goal Mode → Agent Workers → `pi-sdk` backend selection.

## Explicitly deferred advanced features

These are not required for v0.5.0 hardening and should remain out of scope unless a later product decision changes the direction:

- Nested sub-agents.
- Long-lived child sessions.
- Automatic child extension/tool inheritance.
- Cloud execution.
- Automatic write authority beyond existing worker confirmation and workspace collision rules.
- Multi-agent swarm/coordinator behavior.
- Raw child transcript exposure in LLM-facing summaries.

## Milestones

- `M1 — Pi SDK hardening and boundary tests` — `m1-pi-sdk-hardening.md`

See `milestones.md` for the tracker.
