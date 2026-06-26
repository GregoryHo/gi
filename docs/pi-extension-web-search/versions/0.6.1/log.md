# Web Search 0.6.1 log

## 2026-06-26 — 0.6.1 sealed

M1 completed and docs sealed for v0.6.1. `web_research` is now listed first and guidance routes public source/package/extension implementation discovery to web research unless local/current-repo search is explicit.

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

Started routing guidance patch. The observed issue: asking to查 sub-agent extension source can be interpreted as local repo search unless the user explicitly says web search. This patch should make public extension/package/source discovery route to `web_research` by default.
