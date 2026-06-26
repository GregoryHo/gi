# Web Search 0.4.0 planning

## Status

Sealed.

## Goal

Add session-local retrieval for full fetched content so `fetch_content` can keep bounded inline output while still allowing follow-up chunk reads.

## Milestones

- M1 — `m1-full-content-retrieval.md`: completed `get_search_content` for session-local fetched content chunks by `responseId`, plus fetch response metadata.

## Non-goals

- Persistent storage across pi reloads/restarts.
- Storing raw provider payloads or web-search answer internals.
- Multi-provider search/fetch fallback.
- Browser cookies, JavaScript rendering, PDF/video/GitHub special handling.
