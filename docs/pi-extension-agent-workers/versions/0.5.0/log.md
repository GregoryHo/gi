# Agent workers v0.5.0 log

Append important planning decisions, milestone starts/completions, verification evidence, and handoff notes here.

## 2026-07-10

- Created proposed v0.5.0 hardening track after sealing v0.4.0. Decision: no additional code hardening blocks the v0.4.0 local release because automated verification and manual `pi-sdk` smoke passed. Remaining work should be tracked as post-MVP hardening.
- Necessary upper-bound scope: child turn/budget limits, testable child resource boundaries, improved `pi-sdk` observability, conservative model/profile option pass-through, and cross-mode orchestration guidance.
- Explicitly deferred: nested sub-agents, long-lived child sessions, automatic child extension/tool inheritance, cloud execution, automatic write authority, multi-agent swarm behavior, and raw child transcript exposure in compact summaries.
