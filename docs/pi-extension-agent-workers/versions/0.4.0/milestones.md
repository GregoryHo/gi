# Agent workers v0.4.0 milestones

| Milestone | Status | Goal | Notes |
| --- | --- | --- | --- |
| M1 Pi SDK-backed worker adapter MVP | In progress | Add a local pi SDK-backed worker adapter while preserving existing worker safety and CLI adapter behavior | Plan: `m1-pi-sdk-worker-adapter.md` |

## Completion criteria

- `pi-sdk` is accepted anywhere adapter names are accepted.
- Existing `demo`, `claude-code`, and `codex-cli` adapters continue to work.
- `pi-sdk` workers run as isolated bounded child `AgentSession` instances.
- Read-only profiles get conservative read-only tool scopes.
- Write-capable profiles remain confirmation-gated and participate in workspace collision safety.
- Compact final text, usage/status metadata, and artifact/log references are returned without raw child logs in LLM-facing summaries.
- Package tests, package typecheck, pack dry-run, repo typecheck, and load smoke pass.
