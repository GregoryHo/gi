# M1 — Minimal fetch_content

## Status

Done.

## SPEC

### Goal

Add one safe, read-only `fetch_content` tool that fetches public HTTP/HTTPS URLs and returns compact extracted content.

### Scope

Runtime behavior:

- Register `fetch_content` alongside existing `web_search`.
- Accept:
  - `url: string`
  - optional `maxChars?: number`, clamped to a bounded range.
- Fetch only HTTP/HTTPS URLs.
- Validate hostnames/IPs before fetch and on redirects to block SSRF:
  - localhost / `.localhost`
  - private IPv4 ranges
  - loopback/link-local/reserved IPv6 ranges
  - non-HTTP(S) schemes
- Follow a small number of redirects, validating each target.
- Enforce request timeout and response byte/character limits.
- Extract content:
  - text/markdown/json responses as text.
  - HTML responses into compact markdown-ish text: title, headings, links, paragraphs/list text where practical.
- Return compact LLM-facing content plus structured details containing URL, final URL, title, content type, truncation state, and character count.

### Non-goals

- Browser cookies or authenticated browser profile access.
- JavaScript rendering.
- PDF, YouTube, local video, or GitHub clone handling.
- Jina/Gemini/Parallel fallback.
- Persistent content storage or retrieval by response id.
- Raw HTTP header dumps.

### Expected files

- `src/ssrf.ts` — URL validation and redirect-safe fetch adapter.
- `src/fetch-content.ts` — content-type handling, extraction, and formatting.
- `src/tools.ts` updates for `fetch_content` registration.
- Tests for SSRF, extraction, formatting, and tool registration.

## AC

- `fetch_content` rejects non-HTTP(S), localhost, and private/reserved IP targets before fetch.
- Redirect targets are revalidated.
- HTML is converted to compact readable text with title/link provenance where practical.
- Plain text/json/markdown responses are returned compactly.
- Tool output is bounded and marks truncation.
- No browser cookies, credentials, raw headers, or raw provider payloads are used or returned.

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

- `src/ssrf.ts` for HTTP/HTTPS-only URL validation, public IP checks, DNS validation, and redirect-safe fetch.
- `src/fetch-content.ts` for bounded fetch, content-type handling, compact HTML/text extraction, and safe tool result formatting.
- `src/tools.ts` now registers both `web_search` and `fetch_content`.
- Tests cover SSRF blocks, redirect validation, HTML/text extraction, truncation, formatting, and tool registration.

Verification evidence is recorded in `log.md`.
