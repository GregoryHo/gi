# Web Search extension docs index

## Current stable version

- Version: `0.3.0`
- Package: `packages/pi-extension-web-search`
- Status: Provenance bridge release sealed after M1 completion and automated verification.
- Current package version: `0.3.0`

## Active planning version

None. Future work should be planned under `versions/<semver>/` before implementation starts.

## Product summary

Web Search is a small pi extension package that provides an LLM-callable web search tool using OpenAI/Codex web-search capability before adding external search providers.

v0.1.0 delivered:

- OpenAI/Codex provider only.
- One `web_search` tool.
- Read-only network calls through OpenAI Responses API / Codex endpoint.
- Compact synthesized answer plus source citations.
- Secret-safe structured details.
- No Google CSE, browser cookies, content fetching, curator UI, or persistent storage.

v0.2.0 delivered:

- `fetch_content` for public HTTP/HTTPS URLs.
- SSRF guard for localhost/private/reserved targets and redirects.
- Timeout, redirect, response byte, and extracted character limits.
- Compact HTML-to-markdown-ish extraction plus text/json/markdown handling.
- No browser cookies, JavaScript rendering, PDF/video/GitHub special handling, fallback providers, or persistence.

v0.3.0 delivered:

- Session-local `responseId` and per-source result ids in `web_search` output/details.
- `fetch_content` by direct URL, `responseId/resultId`, or `responseId/index`.
- Stronger untrusted-content warning in fetched output and tool guidelines.
- No persistent storage of search results or fetched bodies.

## Navigation

- `roadmap.md` — broad product direction and deferred candidates.
- `milestones.md` — sealed v0.1.0 milestone tracker.
- `m1-openai-web-search.md` — completed M1 plan.
- `archive.md` — completed/superseded docs index.
- `versions/0.3.0/index.md` — sealed 0.3.0 planning and release notes.
- `versions/0.2.0/index.md` — sealed 0.2.0 planning and release notes.
- `versions/README.md` — convention for future versioned planning docs.
- `log.md` — append-only product/change log.
- `AGENTS.md` — docs governance and workflow.

## Naming

Chosen product name: `Web Search`.

Chosen package/doc name: `pi-extension-web-search`.

Rationale:

- The name describes the user-facing capability directly.
- The package can later grow into provider routing or content retrieval, but v0.1.0 should stay search-only.
- The name follows the repo convention where `docs/<package-name>/` exactly matches `packages/<package-name>/`.
