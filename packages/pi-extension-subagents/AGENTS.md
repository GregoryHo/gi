# pi-extension-subagents implementation rules

Before package work, read:

1. `../../AGENTS.md`
2. `../../docs/extension-development-style.md`
3. `../../docs/pi-extension-subagents/AGENTS.md`
4. `../../docs/pi-extension-subagents/index.md`
5. `../../docs/pi-extension-subagents/log.md`
6. The active milestone plan under `../../docs/pi-extension-subagents/`
7. Installed pi docs: `docs/extensions.md` and `docs/packages.md`.

## Constraints

- Subagents is a delegation facade; Agent Workers remains the execution/control plane.
- Reuse only the versioned `pi.events` protocol. Never create or import `WorkerManager`, adapters, worker history, or artifacts.
- M1 is foreground, read-only, bounded, and parallel.
- Every child request must narrow authority with `readOnly: true`.
- Require one explicit user confirmation before starting real child sessions.
- Keep calls and concurrency bounded; preserve input order in results.
- Do not add nesting, parent-context inheritance, persistent/background sessions, writes, retries, shared tasks, messaging, or team semantics.

## Verification

```bash
npm test --workspace @gregho/pi-extension-subagents
npm run typecheck --workspace @gregho/pi-extension-subagents
npm run pack:dry-run --workspace @gregho/pi-extension-subagents
npm run typecheck
```
