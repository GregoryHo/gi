# Agent workers v0.5.0 planning index

## Status

- Version: `0.5.0`
- Package: `packages/pi-extension-agent-workers`
- Status: M1 implementation in progress
- Branch: `feature/subagents-runtime-facade`

## Theme

Post-MVP hardening for the pi SDK-backed worker adapter added in v0.4.0, followed by a versioned runtime protocol that separate coordination packages can consume.

v0.4.0 proved the `pi-sdk` adapter can run local pi SDK child sessions through the existing worker runtime. v0.5.0 keeps `agent-workers` focused on execution and supervision: bounded complete results, child-session option/budget hardening, explicit resource boundaries, and a versioned `pi.events` protocol over one shared worker manager. Direct sub-agent UX belongs in a separate `pi-extension-subagents` package; shared tasks and teammate coordination belong in a future Agent Teams package.

## Decision from v0.4.0 follow-up

No additional code changes should block the v0.4.0 local release. The MVP has passed automated verification and manual `pi-sdk` smoke. The remaining items are important hardening and ergonomics work, but they are better handled in a new versioned planning track so the sealed v0.4.0 release stays small and auditable.

## Necessary upper-bound hardening

These are the next features that are worth considering necessary for a stronger pi-native sub-agent workflow:

1. Bounded complete child results with private artifact fallback instead of preview-only deliverables.
2. Explicit child-session turn/budget limits in addition to timeout.
3. Testable child resource-boundary policy so `pi-sdk` children cannot recursively access `agent_worker_*` tools by default.
4. Better `pi-sdk` observability for setup, prompt, missing-final, usage-unknown, cancel, and timeout outcomes.
5. Safe system-prompt/model/thinking option pass-through where supported by the pi SDK, without exposing broad provider configuration.
6. A versioned, correlated, reload-safe `pi.events` runtime protocol for separate sub-agent and future team coordination packages.
7. Cross-mode orchestration recipes for Plan Mode → Goal Mode → Agent Workers → `pi-sdk` backend selection.

## Explicitly deferred advanced features

These are not required for v0.5.0 hardening and should remain out of scope unless a later product decision changes the direction:

- Nested sub-agents.
- Long-lived child sessions.
- Automatic child extension/tool inheritance.
- Cloud execution.
- Automatic write authority beyond existing worker confirmation and workspace collision rules.
- Multi-agent swarm/coordinator behavior.
- Raw child transcript exposure in LLM-facing summaries.

## Product boundary

- `pi-extension-agent-workers` owns execution, lifecycle, adapters, safety, concurrency, history, and artifacts.
- `pi-extension-subagents` will own direct delegation tools, agent definitions, context policy, and bounded result presentation.
- `pi-extension-goal-mode` owns bounded objective-loop orchestration.
- A future Agent Teams package will own shared tasks, teammate messaging, assignment, and synthesis.

## Milestones

- `M1 — Pi SDK hardening and boundary tests` — `m1-pi-sdk-hardening.md`
- `M2 — Versioned worker runtime protocol` — `m2-runtime-protocol.md`

See `milestones.md` for the tracker.
