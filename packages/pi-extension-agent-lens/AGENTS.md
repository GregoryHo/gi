# Agent Lens extension workflow

This package contains a pi extension for observing agent runs, turns, context composition, provider payloads, tool flow, and memory compression.

## Required reading before work

Before starting any milestone or task in this package:

1. Read `../../docs/pi-extension-agent-lens/AGENTS.md` for docs/spec governance.
2. Read `../../docs/pi-extension-agent-lens/index.md` to identify current status and active planning docs.
3. Read `../../docs/pi-extension-agent-lens/log.md` for recent product decisions.
4. Read the active milestone plan before code work.
5. If pi extension APIs, event order, compaction internals, or provider payload behavior are unclear, inspect the installed local pi docs and examples before implementing.

## Implementation workflow

- Keep changes small and aligned to the active milestone SPEC.
- Do not add features outside the active milestone.
- Prefer pure helpers for message summarization, redaction, artifact paths, and HTML rendering.
- Run the package verification commands from `README.md` before marking package work complete.

## Observability safety rules

- Agent Lens must not change agent behavior unless a future milestone explicitly scopes an opt-in experiment.
- Raw message content, provider payloads, file contents, command output, and tool results may contain secrets; full capture must be explicit opt-in.
- Default artifacts must be redacted and truncated.
- Runtime artifacts must go to ignored local directories such as `.pi-agent-lens/` or `~/.pi/agent/agent-lens/`.
- Do not commit traces, reports, raw payloads, prompts, credentials, tokens, or private code excerpts.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```
