# Web Search 0.3.0 log

## 2026-06-25 — 0.3.0 sealed

M1 completed and docs sealed for v0.3.0. Implemented session-local `responseId`/result ids, fetch-by-result support, and untrusted-content warning hardening.

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

Started provenance bridge implementation. Decision: use session-local in-memory storage only. `web_search` will return a `responseId` and per-source ids; `fetch_content` may accept `responseId` plus `resultId` or `index` to fetch a selected source. Fetched content output must explicitly label web text as untrusted evidence, not instructions.
