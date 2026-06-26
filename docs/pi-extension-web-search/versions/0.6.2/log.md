# Web Search 0.6.2 log

## 2026-06-26 — 0.6.2 sealed

M1 completed and docs sealed for v0.6.2. Added generic online/public/remote/external-existence routing cues without adding narrow tools.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

The pi load smoke command exited 0 without extension startup errors.

## 2026-06-26 — M1 started

Started generic online routing guidance patch. Scope is limited to wording/tests; no new tools or schema changes.
