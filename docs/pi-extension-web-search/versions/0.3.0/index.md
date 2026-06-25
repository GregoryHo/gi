# Web Search 0.3.0 planning

## Status

Sealed.

## Goal

Improve provenance across `web_search` and `fetch_content`, and make untrusted fetched web content explicit in tool behavior.

## Milestones

- M1 — `m1-provenance-bridge.md`: completed session-local `responseId` / result ids from `web_search` and `fetch_content` fetch-by-result support.
- M2 — included in M1 for this small version: strengthen fetched-content prompt-injection warning in tool guidelines and output.

## Non-goals

- Persistent search result storage across pi restarts.
- `get_search_content` retrieval tool.
- Multi-provider search.
- Browser cookies, JavaScript rendering, PDF/video/GitHub special handling, or fallback providers.
