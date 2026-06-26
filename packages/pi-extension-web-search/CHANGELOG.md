# Changelog

## 0.5.1 - 2026-06-26

- Surface `fetch_content` `responseId` and full character count in visible text output.
- Surface `get_search_content` offset, limit, returned character count, full character count, and next offset in visible text output.
- Improve manual smoke-test observability without changing storage, extraction, or network behavior.

## 0.5.0 - 2026-06-26

- Add Defuddle-based HTML extraction using `defuddle/node` and `linkedom`.
- Disable Defuddle async third-party fallback with `useAsync: false`.
- Preserve the previous simple HTML extractor as fallback when Defuddle fails or returns empty content.
- Improve docs-page readability while preserving existing SSRF, timeout, truncation, chunk retrieval, and untrusted-content safety boundaries.

## 0.4.0 - 2026-06-25

- Add session-local full fetched-content storage for `fetch_content` results.
- Add `get_search_content({ responseId, offset, limit })` for chunked retrieval of fetched content.
- Add `responseId` and `fullCharCount` metadata to `fetch_content` results.
- Add continuation hint when inline fetched content is truncated.
- Keep retrieval session-local only; no persistent storage of fetched bodies.

## 0.3.0 - 2026-06-25

- Add session-local `responseId` and per-source result ids to `web_search` output and details.
- Add `fetch_content({ responseId, resultId })` and `fetch_content({ responseId, index })` support for fetching selected search results.
- Add search result store tests and tool-level provenance bridge tests.
- Strengthen fetched-content prompt-injection warning in tool guidelines and output.

## 0.2.0 - 2026-06-25

- Add `fetch_content` tool for public HTTP/HTTPS URL fetching.
- Add SSRF guard for localhost, private IPv4, reserved IPv4, loopback/link-local IPv6, and redirect targets.
- Add timeout, redirect limit, response byte limit, and extracted character limit.
- Add compact HTML-to-markdown-ish extraction plus plain text/JSON/Markdown handling.
- Preserve no browser cookies, no JavaScript rendering, no persistence, and no provider fallback in this minimal fetch milestone.

## 0.1.0 - 2026-06-25

- Scaffold package and planning docs for the OpenAI/Codex web-search MVP.
- Add `web_search` tool registration with strict TypeBox parameters.
- Add OpenAI/Codex auth resolution from pi model registry, with `OPENAI_API_KEY` fallback.
- Add OpenAI Responses API / Codex endpoint request construction using required `web_search`.
- Add JSON and streamed SSE response parsing for answers and source citations.
- Add compact, secret-safe tool output and structured details.
