# Web Search

Web Search is a pi extension package for read-only web search.

## Status

`0.5.0` implements an OpenAI/Codex-backed `web_search` tool, a safe `fetch_content` tool, a session-local provenance bridge, chunked retrieval for fetched content, and Defuddle-based HTML cleanup.

## Tools

```typescript
web_search({ query: "pi extension docs", count: 5 })
web_search({ query: "typescript release notes", domainFilter: ["typescriptlang.org"] })
web_search({ query: "package comparison", domainFilter: ["github.com", "-spam.example"] })

fetch_content({ url: "https://example.com/docs" })
fetch_content({ url: "https://example.com/docs", maxChars: 8000 })
fetch_content({ responseId: "ws_1", resultId: "r1" })
fetch_content({ responseId: "ws_1", index: 1 })

get_search_content({ responseId: "fc_1" })
get_search_content({ responseId: "fc_1", offset: 12000, limit: 8000 })
```

`web_search`:

- Uses existing pi/OpenAI or Codex auth where possible.
- Falls back to `OPENAI_API_KEY` when pi auth is unavailable.
- Returns a compact synthesized answer with source citations, `responseId`, and per-source result ids.
- Keeps only session-local source metadata so `fetch_content` can fetch a selected result; avoids Google CSE, browser cookies, multi-provider routing, and persistent storage.

`fetch_content`:

- Fetches public HTTP/HTTPS URLs directly or via `responseId` plus `resultId`/`index` from `web_search`.
- Blocks localhost/private/reserved IP targets and validates redirects.
- Converts HTML to cleaner markdown using local Defuddle extraction with simple fallback; returns text/json/markdown as text.
- Enforces timeout, response byte limit, and extracted character limit.
- Marks fetched web text as untrusted evidence/data, not instructions.
- Stores full extracted content in session-local memory and returns a `responseId` for chunked retrieval with `get_search_content`.
- Does not use browser cookies, JavaScript rendering, Defuddle async third-party fallbacks, PDF/video/GitHub special handling, provider fallback, or persistent storage.

## Development

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
```

## Safety default

Web Search is a read-only network extension. It should not mutate local files, persist credentials, or access browser cookies.
