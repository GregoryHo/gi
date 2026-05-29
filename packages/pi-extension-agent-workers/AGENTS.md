# Agent workers extension workflow

This package contains a pi extension for supervising delegated AI agent worker CLI processes.

## Required reading before work

Before starting any milestone or task in this package:

1. Read `../../docs/pi-extension-agent-workers/AGENTS.md` for docs/spec governance.
2. Read `../../docs/pi-extension-agent-workers/index.md` to identify current status and active planning docs.
3. Read `../../docs/pi-extension-agent-workers/log.md` for recent product decisions.
4. Read the active version docs linked from `index.md`, usually under `../../docs/pi-extension-agent-workers/versions/<semver>/` for post-v0.2.0 work.
5. Read the current milestone implementation plan before code work.
6. If pi extension APIs, subprocess behavior, or worker CLI JSON formats are unclear, inspect the relevant local docs or CLI help and record findings before implementing.

## Implementation workflow

Follow the milestone lifecycle defined in `../../docs/pi-extension-agent-workers/AGENTS.md`. This package file only adds implementation-specific constraints:

- Keep changes small and aligned to the active milestone SPEC.
- Do not add features outside the active milestone.
- Prefer TDD for command parsing, worker state transitions, event parsing, timeout/cancel behavior, and usage aggregation.
- Run the package verification commands from `README.md` before marking package work complete.

## Worker safety rules

- Do not default to dangerous permission flags such as sandbox bypass modes.
- Do not assume worker token or cost usage is accurate unless the adapter parses reported usage from machine-readable worker output.
- Do not write raw worker stdout/stderr containing secrets into committed fixtures.
- Runtime logs and artifacts must go to ignored local directories or `~/.pi/agent/agent-workers/`.
- Parallel write-capable workers can corrupt a shared working tree; do not add concurrency without an explicit isolation or confirmation design.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```
