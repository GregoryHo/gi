# Web Search 0.4.0 log

## 2026-06-25 — 0.4.0 sealed

M1 completed and docs sealed for v0.4.0. Implemented session-local full fetched-content storage, `get_search_content` chunk retrieval, `responseId`/`fullCharCount` metadata, and truncation continuation hints.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

The pi load smoke command exited 0 without extension startup errors.

## 2026-06-25 — M1 started

Started session-local full content retrieval. Reference pattern: `pi-web-access` stores fetch/search results and exposes `get_search_content`; this package will implement a smaller session-local fetched-content-only variant with offset/limit chunks.
