# Agent workers v0.4.0 planning index

## Status

- Version: `0.4.0`
- Package: `packages/pi-extension-agent-workers`
- Status: Released / sealed local package release
- Branch: `feature/pi-native-agent-worker-adapter`

## Theme

Add a pi SDK-backed worker adapter so `agent-workers` can run local pi-native child agent sessions without requiring external Claude Code or Codex CLI worker processes.

## Milestones

- `M1 — Pi SDK-backed worker adapter MVP` — `m1-pi-sdk-worker-adapter.md`

See `milestones.md` for the tracker.

## Scope

- Refactor the worker adapter/runtime contract to support both subprocess-backed adapters and in-memory async adapters.
- Add a `pi-sdk` adapter that starts an isolated in-memory child `AgentSession` with bounded execution.
- Reuse worker profile prompts and safety metadata for pi SDK workers.
- Add conservative tool scopes for read-only profiles and write-capable profiles.
- Preserve existing worker safety defaults: confirmation gates, workspace preflight, timeout behavior, history, and widget summaries.
- Update command, LLM-tool, config, docs, and tests for the new adapter.

## Implementation notes

Current implementation slices add the async adapter contract, `pi-sdk` adapter, public adapter wiring, conservative tool scopes, confirmation classification, and async terminal-path tests. The adapter uses a minimal child resource loader so child sessions do not recursively load `agent-workers` tools or discover project-local child extensions in this MVP.

## Non-goals

- No nested sub-agents.
- No long-lived child sessions.
- No cloud execution.
- No automatic write authority beyond existing worker safety rules.
- No removal of Claude Code or Codex CLI adapters.
