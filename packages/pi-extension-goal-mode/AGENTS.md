# pi-extension-goal-mode implementation rules

Before package work, read:

1. `../../AGENTS.md`
2. `../../docs/extension-development-style.md`
3. `../../docs/pi-extension-goal-mode/AGENTS.md`
4. `../../docs/pi-extension-goal-mode/index.md`
5. `../../docs/pi-extension-goal-mode/log.md`
6. The active milestone plan under `../../docs/pi-extension-goal-mode/`
7. Installed pi docs: `docs/extensions.md`, `docs/packages.md`, and `docs/tui.md` when UI surfaces are touched.

## Constraints

- Keep M1 conservative and bounded by default.
- Do not implement runtime behavior outside the active milestone SPEC/AC.
- Goal loops must have explicit max-iteration, timeout, and failure stop conditions.
- Write/destructive actions require explicit user approval.
- Verification evidence must be tracked separately from model self-reports.
- Keep LLM-facing injected context compact.
- Do not directly depend on plan-mode or agent-workers internals in M1.

## Verification

Run from repo root:

```bash
npm test --workspace @gregho/pi-extension-goal-mode
npm run typecheck --workspace @gregho/pi-extension-goal-mode
npm run pack:dry-run --workspace @gregho/pi-extension-goal-mode
npm run typecheck
```
