# M1 — Visible retrieval metadata

## Status

Done.

## SPEC

### Goal

Make manual smoke tests and user follow-up retrieval easier by showing retrieval metadata in visible tool output, not only structured details.

### Scope

Runtime behavior:

- `fetch_content` visible text output always includes:
  - `responseId`
  - full character count
- If `fetch_content` is truncated, it keeps the continuation hint.
- `get_search_content` visible text output includes a metadata header with:
  - `responseId`
  - source URL
  - offset
  - limit
  - returned character count
  - full character count
  - next offset
- The content body remains unchanged after the header.

### Non-goals

- Changing structured details shape.
- Changing storage lifetime.
- Changing extraction or network behavior.

## AC

- Non-truncated direct fetch output visibly shows `responseId` and full character count.
- Truncated fetch output visibly shows `responseId`, full character count, and continuation hint.
- `get_search_content` output visibly shows offset/limit/full count/next offset before content.
- Existing details remain unchanged.

## Verification

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

## Completion notes

Completed on 2026-06-26.

Implemented changes:

- `fetch_content` text output now visibly includes `responseId` and `Full chars` for both truncated and non-truncated fetches.
- `get_search_content` text output now includes a metadata header before the retrieved chunk.
- Structured details are unchanged.
- Tests cover truncated fetch metadata, non-truncated fetch metadata, and chunk retrieval headers.

Verification evidence is recorded in `log.md`.
