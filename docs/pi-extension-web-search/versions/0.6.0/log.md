# Web Search 0.6.0 log

## 2026-06-26 — 0.6.0 sealed

M1 completed and docs sealed for v0.6.0. Added `web_research` high-level workflow tool for natural-language research/read tasks.

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

Started high-level `web_research` tool. This version should let the model choose one tool for common natural-language research/read requests, internally coordinating search and fetch while preserving low-level tools for follow-up and debugging.
