# Web Search 0.5.1 log

## 2026-06-26 — 0.5.1 sealed

M1 completed and docs sealed for v0.5.1. `fetch_content` and `get_search_content` now surface retrieval metadata in visible text output while keeping structured details unchanged.

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

Manual smoke for 0.5.0 passed functionally, but the smoke agent noted visible output did not show some structured details (`responseId`, `fullCharCount`, `nextOffset`). Started a small patch to surface these metadata fields directly in text output.
