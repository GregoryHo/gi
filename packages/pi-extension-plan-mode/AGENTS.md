# pi-extension-plan-mode implementation rules

Before package work, read:

1. `../../AGENTS.md`
2. `../../docs/extension-development-style.md`
3. `../../docs/pi-extension-plan-mode/AGENTS.md`
4. The active milestone plan under `../../docs/pi-extension-plan-mode/`
5. Installed pi docs: `docs/extensions.md`, `docs/packages.md`, and `docs/tui.md` when UI surfaces are touched.

## Constraints

- Keep M1 read-only and safe by default.
- Do not implement runtime behavior outside the active milestone SPEC/AC.
- Preserve user-selected active tools when entering/exiting plan mode.
- Write/destructive execution must remain out of scope until an explicit later milestone.
- Keep LLM-facing injected context compact.

## Verification

Run from repo root:

```bash
npm test --workspace @gregho/pi-extension-plan-mode
npm run typecheck --workspace @gregho/pi-extension-plan-mode
npm run pack:dry-run --workspace @gregho/pi-extension-plan-mode
npm run typecheck
```
