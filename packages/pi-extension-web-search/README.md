# Web Search

Web Search is a pi extension package for read-only web search.

## Status

`0.6.2` implements an OpenAI/Codex-backed `web_search` tool, a high-level `web_research` workflow, a safe `fetch_content` tool, a session-local provenance bridge, chunked retrieval for fetched content, Defuddle-based HTML cleanup, visible retrieval metadata, and natural-language retrieval/source-routing guidance.

## Tools

```typescript
web_search({ query: "pi extension docs", count: 5 })
web_search({ query: "typescript release notes", domainFilter: ["typescriptlang.org"] })
web_search({ query: "package comparison", domainFilter: ["github.com", "-spam.example"] })

web_research({ question: "How do pi custom tools work?", maxSources: 2 })

fetch_content({ url: "https://example.com/docs" })
fetch_content({ url: "https://example.com/docs", maxChars: 8000 })
fetch_content({ responseId: "ws_1", resultId: "r1" })
fetch_content({ responseId: "ws_1", index: 1 })

get_search_content({ responseId: "fc_1" })
get_search_content({ responseId: "fc_1", offset: 12000, limit: 8000 })
```

`web_research`:

- Use for natural-language research/read tasks where both search and source reading are likely needed.
- Prefer for online/public/remote source-code, GitHub repository, npm/pi.dev package, extension, library, implementation, and external-existence discovery unless the user explicitly asks for local/current-repo search.
- Searches, fetches top public sources, stores fetched content session-locally, and returns a compact evidence bundle.
- Continues to use the same OpenAI/Codex search path and SSRF-guarded fetch path.
- Does not perform browser rendering, cookie access, persistent storage, or hidden third-party extraction fallbacks.

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
- Stores full extracted content in session-local memory and visibly returns a `responseId`/full character count for chunked retrieval with `get_search_content`.
- Guides the LLM to treat response ids, result ids, and offsets as internal plumbing and continue reading automatically when needed.
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
