# Changelog

## Unreleased

- Add `/web-search-doctor` diagnostics command for package version, registered tool names, redacted OpenAI/Codex auth status, `OPENAI_API_KEY` presence, and safety-boundary reporting.
- Add public GitHub clone/install README guidance and package metadata/license preparation for 1.0.0.

## 0.6.2 - 2026-06-26

- Strengthen generic `web_research` guidance for natural-language online/public/remote research cues.
- Add explicit cues for `上網`, `online`, `public`, `remote`, `internet`, `web`, `external`, `pi.dev`, `npm`, `GitHub`, and published packages.
- Clarify that questions about what exists outside the current repo or what public packages/libraries/tools are available should consider `web_research` before local search.
- No new tools, schema changes, or sub-agent-specific routing.

## 0.6.1 - 2026-06-26

- Register `web_research` before lower-level web tools to improve natural-language routing.
- Strengthen guidance so public/online source-code, GitHub repository, pi package, extension, library, and implementation discovery prefers `web_research`.
- Clarify that local grep/read should be used only when the user explicitly asks for current-repo/local-file search or provides a local path.
- Guide raw `web_search` toward quick snippets and explicit search-only requests.

## 0.6.0 - 2026-06-26

- Add `web_research({ question, maxSources, maxCharsPerSource, domainFilter })` high-level workflow tool.
- `web_research` searches the web, stores search result ids, fetches top sources with the same SSRF-guarded fetch path, stores fetched full content, and returns a compact evidence bundle.
- Fetch failures for individual sources are recorded without failing the whole research call.
- Low-level `web_search`, `fetch_content`, and `get_search_content` remain available for targeted follow-up and debugging.

## 0.5.2 - 2026-06-26

- Strengthen LLM-facing guidance so search/fetch/retrieval ids and offsets are treated as internal tool plumbing.
- Encourage natural-language research flow: search first, fetch relevant sources, and continue reading truncated content automatically when needed.
- Tell the model not to require users to provide `responseId`, result ids, or offsets unless they ask for debug/tool details.

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
