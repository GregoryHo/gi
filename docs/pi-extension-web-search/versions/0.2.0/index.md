# Web Search 0.2.0 planning

## Status

Sealed.

## Goal

Add the smallest safe web-fetch capability to complement 0.1.0 `web_search`.

## Milestones

- M1 — `m1-fetch-content.md`: completed minimal read-only `fetch_content` tool with SSRF guard, timeouts, size limits, and compact HTML/text extraction.

## Non-goals

- Browser cookies or authenticated browser profile access.
- JavaScript rendering.
- PDF, YouTube, local video, or GitHub clone handling.
- Multi-provider fallback through Jina, Gemini, Parallel, or Exa.
- Persistent storage or `get_search_content`.
