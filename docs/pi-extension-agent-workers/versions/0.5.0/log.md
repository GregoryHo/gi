# Agent workers v0.5.0 log

Append important planning decisions, milestone starts/completions, verification evidence, and handoff notes here.

## 2026-07-10

- Created proposed v0.5.0 hardening track after sealing v0.4.0. Decision: no additional code hardening blocks the v0.4.0 local release because automated verification and manual `pi-sdk` smoke passed. Remaining work should be tracked as post-MVP hardening.
- Necessary upper-bound scope: child turn/budget limits, testable child resource boundaries, improved `pi-sdk` observability, conservative model/profile option pass-through, and cross-mode orchestration guidance.
- Explicitly deferred: nested sub-agents, long-lived child sessions, automatic child extension/tool inheritance, cloud execution, automatic write authority, multi-agent swarm behavior, and raw child transcript exposure in compact summaries.

## 2026-07-11

- Confirmed the package boundary: Agent Workers remains the execution/control plane; direct delegation UX and agent definitions move to a separate `pi-extension-subagents`; Goal Mode remains the bounded orchestrator; future Agent Teams owns shared tasks, messaging, assignment, and synthesis.
- Expanded v0.5.0 planning to require bounded complete Pi SDK child results with artifact fallback and actual child system-prompt/model/thinking pass-through where supported.
- Added proposed M2 for a versioned, correlated, reload-safe `pi.events` runtime protocol over the one shared Agent Workers service. The protocol is infrastructure for separate coordination packages, not Agent Teams behavior inside Agent Workers.
- Started M1 Pi SDK hardening and boundary tests on `feature/subagents-runtime-facade`. First implementation slice is bounded complete child results using TDD; option pass-through and lifecycle hardening follow only after that slice is green.
