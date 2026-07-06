# Agent workers v0.4.0 log

Append important planning decisions, milestone starts/completions, verification evidence, and handoff notes here.

## 2026-07-06

- Started v0.4.0 planning on branch `feature/pi-native-agent-worker-adapter` for Phase 4 pi-native sub-agent behavior. M1 is scoped to a pi SDK-backed worker adapter MVP inside `pi-extension-agent-workers`, not a separate sub-agent package.
- Safety direction: `pi-sdk` should be treated as a real worker adapter, require confirmation by default, use bounded child sessions, avoid nested sub-agents and long-lived sessions, and preserve existing workspace collision rules.
