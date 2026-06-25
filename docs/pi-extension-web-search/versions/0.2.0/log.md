# Web Search 0.2.0 log

## 2026-06-25 — 0.2.0 sealed

M1 completed and docs sealed for v0.2.0. Implemented `fetch_content` with SSRF validation, redirect target validation, bounded public HTTP/HTTPS fetch, compact HTML/text extraction, safe structured details, and tests.

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

Started minimal `fetch_content` implementation. Reference projects:

- `pi-web-access` for SSRF guard and fetch/fallback boundaries.
- `pi-config` for the small-extension philosophy.

Decision: implement only public HTTP/HTTPS fetch with local parsing and compact output. No browser cookies, provider fallback, persistence, PDF/video/GitHub special cases, or JS rendering.
