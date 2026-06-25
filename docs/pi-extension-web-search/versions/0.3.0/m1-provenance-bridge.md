# M1 — Provenance bridge and untrusted-content hardening

## Status

Done.

## SPEC

### Goal

Bridge `web_search` results to `fetch_content` without requiring the model to copy URLs manually, and make prompt-injection safety explicit for fetched web text.

### Scope

Runtime behavior:

- Keep a session-local in-memory search result store for the extension instance.
- `web_search` returns:
  - `responseId`
  - per-source ids such as `r1`, `r2`
  - source URLs/titles/snippets as before
- `fetch_content` accepts either:
  - direct `url`, or
  - `responseId` with `resultId`, or
  - `responseId` with 1-based `index`
- Fetch-by-id resolves to the stored URL, then uses the same SSRF-guarded fetch path as direct URL fetch.
- Fetched content tool output and prompt guidelines explicitly state that fetched web content is untrusted evidence, not instructions.

### Non-goals

- Persistent storage across reloads/restarts.
- A separate `get_search_content` tool.
- Storing fetched page bodies.
- Multi-provider search or fetch fallback.

### Expected files

- `src/search-store.ts` with tests.
- `src/results.ts` updates for ids and response metadata.
- `src/tools.ts` updates for fetch-by-result schema and execution.
- `src/fetch-content.ts` warning update and tests.

## AC

- `web_search` details include `responseId` and sources with stable ids for that response.
- `web_search` text output shows enough id/provenance for the model to call `fetch_content` by result.
- `fetch_content({ responseId, resultId })` resolves and fetches the selected source URL.
- `fetch_content({ responseId, index })` resolves and fetches the selected 1-based source index.
- Unknown response/result errors are actionable and do not expose secrets.
- Direct `fetch_content({ url })` continues to work.
- Fetched output includes an untrusted-content warning.

## Verification

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

## Completion notes

Completed on 2026-06-25.

Implemented files:

- `src/search-store.ts` for session-local response/result id storage and resolution.
- `src/results.ts` now formats `responseId` and source ids in output/details.
- `src/tools.ts` now stores `web_search` source metadata and resolves `fetch_content` by direct URL, `responseId/resultId`, or `responseId/index`.
- `src/fetch-content.ts` now includes an explicit untrusted-content warning in tool output.
- Tests cover store ids/resolution/errors, tool bridge behavior, schema changes, and warning output.

Verification evidence is recorded in `log.md`.
