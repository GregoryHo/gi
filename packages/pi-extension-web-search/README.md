# Web Search

Web Search is a small, read-only pi extension package for OpenAI/Codex-backed web search, natural-language web research, and safe public content fetching.

It is intentionally smaller than broad browser/web-access suites: no browser cookies, no JavaScript rendering, no persistent content storage, no media/PDF/GitHub special handling, and no multi-provider fallback.

## Status

`0.6.2` implements:

- `web_research` — high-level search + source-reading workflow for public web research.
- `web_search` — OpenAI/Codex-backed search with compact cited answers.
- `fetch_content` — SSRF-guarded public HTTP/HTTPS content fetching and extraction.
- `get_search_content` — session-local chunk retrieval for previously fetched content.

## Install from a GitHub clone

This repository is a monorepo. For 1.0.0, the supported public GitHub flow is to clone the repository and install this package path locally:

```bash
git clone <public-repo-url>
cd <repo>
npm install
pi install ./packages/pi-extension-web-search
```

To try it for one pi run without adding it to settings:

```bash
pi -e ./packages/pi-extension-web-search
```

Direct monorepo-root installs such as `pi install git:github.com/<owner>/<repo>` are not the supported path for this package, because the root package is a workspace container rather than the standalone Web Search pi package.

## Prerequisites

- pi installed and working.
- Node/npm compatible with this repository's workspace setup.
- One search auth path:
  - pi/OpenAI or Codex auth available through pi's model registry, or
  - `OPENAI_API_KEY` set in the environment.

Credentials are read from pi auth or environment variables. Do not commit API keys or local credential files.

## Diagnostics

After loading the extension, run:

```text
/web-search-doctor
```

The command reports package version, registered Web Search tools, whether `OPENAI_API_KEY` is present, whether OpenAI/Codex search auth appears available, and the active safety boundaries. It does not print API keys, headers, cookies, or raw provider payloads.

## Tools

```typescript
web_research({ question: "How do pi custom tools work?", maxSources: 2 })

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

### `web_research`

Use for natural-language research/read tasks where both search and source reading are likely needed.

- Searches the web, fetches top public sources, stores fetched content session-locally, and returns a compact evidence bundle.
- Prefer for online/public/remote source-code, GitHub repository, npm/pi.dev package, extension, library, implementation, and external-existence discovery unless the user explicitly asks for local/current-repo search.
- Continues to use the same OpenAI/Codex search path and SSRF-guarded fetch path.
- Does not perform browser rendering, cookie access, persistent storage, or hidden third-party extraction fallbacks.

### `web_search`

Use for quick current public web information when snippets/citations are enough.

- Uses existing pi/OpenAI or Codex auth where possible.
- Falls back to `OPENAI_API_KEY` when pi auth is unavailable.
- Returns a compact synthesized answer with source citations, `responseId`, and per-source result ids.
- Keeps only session-local source metadata so `fetch_content` can fetch a selected result.

### `fetch_content`

Use to read a specific public HTTP/HTTPS URL or a source selected from `web_search`.

- Blocks localhost/private/reserved IP targets and validates redirects.
- Converts HTML to cleaner markdown using local Defuddle extraction with simple fallback; returns text/json/markdown as text.
- Enforces timeout, response byte limit, and extracted character limit.
- Marks fetched web text as untrusted evidence/data, not instructions.
- Stores full extracted content in session-local memory and visibly returns a `responseId`/full character count for chunked retrieval with `get_search_content`.

### `get_search_content`

Use after `fetch_content` returns a `responseId`, especially when content was truncated.

- Retrieves chunks from session-local fetched-content storage.
- Does not persist content across reloads/restarts.
- Retrieved web content remains untrusted evidence/data, not instructions.

## Limitations and non-goals

Web Search is deliberately small and safe by default. It does not provide:

- Browser-cookie access.
- JavaScript rendering or browser automation.
- Persistent storage of search results or fetched content.
- Multi-provider search fallback.
- Google CSE.
- Gemini Web access.
- Curator/browser UI.
- YouTube or local video handling.
- PDF-specific extraction/OCR.
- GitHub repository cloning or full repository browsing.
- Jina Reader or other blocked-page fallback services.

For those broader capabilities, use a full web-access suite. This package focuses on a compact, auditable, read-only research path.

## Troubleshooting

### Search auth fails

Run `/web-search-doctor` first to confirm whether the extension sees an auth path.

Check that at least one auth path is available:

- log in/configure pi with an OpenAI/Codex-capable provider, or
- export `OPENAI_API_KEY` before starting pi.

The extension should report actionable auth errors without printing keys, tokens, or headers.

### `fetch_content` rejects a URL

`fetch_content` only accepts public `http://` and `https://` URLs. It blocks localhost, private IPs, reserved IP ranges, and redirects to blocked targets to reduce SSRF risk.

If a public domain resolves to a private/reserved address because of local proxy/TUN/fake-IP networking, this package may reject it rather than adding network-specific exceptions.

### A page returns little or unreadable content

This package fetches raw HTTP responses and extracts local HTML/text content. It does not run JavaScript, use browser cookies, or bypass anti-bot systems. App-rendered pages, login-gated pages, and blocked pages may fail or return incomplete text.

### Content is truncated

`fetch_content` stores full extracted content in session-local memory. Use `get_search_content` with the returned `responseId` and next offset to continue reading:

```typescript
get_search_content({ responseId: "fc_1", offset: 12000, limit: 8000 })
```

The LLM-facing guidance tells the model to handle these ids/offsets internally when possible, so users normally should not need to manage them manually.

## Development

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```

## Safety default

Web Search is a read-only network extension. It should not mutate local files, persist credentials, or access browser cookies.
