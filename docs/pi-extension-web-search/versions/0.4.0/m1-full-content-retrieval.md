# M1 — Full fetched-content retrieval

## Status

Done.

## SPEC

### Goal

Keep `fetch_content` inline output bounded while preserving the full extracted fetched content in memory for follow-up chunk retrieval during the current extension session.

### Scope

Runtime behavior:

- Add session-local fetched content store.
- `fetch_content` stores full extracted content and returns a `responseId` in details.
- If inline content is truncated, `fetch_content` output includes a retrieval hint.
- Add `get_search_content` tool:
  - `responseId: string`
  - `offset?: number`, 0-based character offset, default 0
  - `limit?: number`, clamped to a bounded range
- `get_search_content` returns selected content chunk, source metadata, offset, limit, full char count, next offset, and truncated flag.

### Non-goals

- Persistent storage across reloads/restarts.
- Storing raw provider payloads, cookies, headers, or raw HTML.
- Retrieval for web-search answers that were not fetched.
- Multiple URLs per fetch call.

### Expected files

- `src/content-store.ts` with tests.
- `src/fetch-content.ts` updates to preserve full extracted content separately from inline truncation.
- `src/tools.ts` updates for `get_search_content` and fetch storage metadata.
- README/changelog/docs updates.

## AC

- `fetch_content` details include `responseId`, `charCount`, `fullCharCount`, and `truncated`.
- `get_search_content({ responseId })` retrieves the first chunk of full extracted content.
- `get_search_content({ responseId, offset, limit })` retrieves a bounded chunk and reports `nextOffset` when more content remains.
- Unknown `responseId` errors are actionable and do not expose secrets.
- Inline `fetch_content` output remains bounded and warning-bearing.

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

- `src/content-store.ts` for session-local fetched content storage and offset/limit chunk retrieval.
- `src/fetch-content.ts` now preserves `fullContent` while keeping inline content bounded.
- `src/tools.ts` now stores fetched content, returns `responseId`/`fullCharCount`, adds continuation hints, and registers `get_search_content`.
- Tests cover store chunking, tool schema, full-content retrieval, and existing search/fetch regressions.

Verification evidence is recorded in `log.md`.
