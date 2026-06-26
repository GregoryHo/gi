# Web Search 0.5.2 log

## 2026-06-26 — 0.5.2 sealed

M1 completed and docs sealed for v0.5.2. Prompt guidance now tells the model to treat response ids, result ids, and offsets as internal tool plumbing and to continue reading truncated content automatically when needed.

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

Started natural-language retrieval guidance patch. The goal is to keep `responseId`/offset metadata available for the LLM while explicitly telling it not to require users to know those internals.
