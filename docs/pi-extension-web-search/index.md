# Web Search extension docs index

## Current stable version

- Version: `0.6.2`
- Package: `packages/pi-extension-web-search`
- Status: Generic online routing guidance patch sealed after M1 completion and automated verification.
- Current package version: `0.6.2`

## Active planning version

- Version: `1.0.0`
- Plan: `versions/1.0.0/index.md`
- Goal: public GitHub clone usability and stable release hardening without broad feature expansion.

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

v0.4.0 delivered:

- Session-local full fetched-content storage for `fetch_content` results.
- `get_search_content({ responseId, offset, limit })` for chunked content retrieval.
- `responseId`, `fullCharCount`, and continuation hints when inline fetched content is truncated.
- No persistent storage across reloads/restarts.

v0.5.0 delivered:

- Defuddle-first HTML extraction through `defuddle/node` and `linkedom`.
- Local-only Defuddle parsing with `useAsync: false`.
- Simple extractor fallback when Defuddle fails or returns empty content.
- Cleaner docs/article extraction while preserving existing safety and truncation boundaries.

v0.5.1 delivered:

- Visible `fetch_content` `responseId` and full character count.
- Visible `get_search_content` retrieval metadata header with offset, limit, counts, and next offset.
- No changes to storage lifetime, extraction, or network behavior.

v0.5.2 delivered:

- Natural-language retrieval guidance for search → fetch → continue-reading flows.
- Guidance that response ids, result ids, and offsets are internal tool plumbing.
- No schema, storage, extraction, or network behavior changes.

v0.6.0 delivered:

- `web_research` high-level workflow tool for natural-language research/read tasks.
- Internal search plus top-source fetch through existing safe paths.
- Per-source fetch failure handling without failing the whole research call.
- Low-level tools remain available for targeted follow-up/debugging.

v0.6.1 delivered:

- `web_research` registered before low-level tools.
- Public/online source-code, GitHub repository, pi package, extension, library, and implementation discovery guidance.
- Local grep/read guidance limited to explicit current-repo/local-file/local-path requests.

v0.6.2 delivered:

- Generic online/public/remote/internet/external cue guidance.
- Explicit `pi.dev`, `npm`, `GitHub`, published package, and outside-current-repo cues.
- No new tools or schema changes.

## Navigation

- `roadmap.md` — broad product direction and deferred candidates.
- `milestones.md` — sealed v0.1.0 milestone tracker.
- `versions/1.0.0/index.md` — active 1.0.0 public GitHub readiness and release-hardening plan.
- `m1-openai-web-search.md` — completed M1 plan.
- `archive.md` — completed/superseded docs index.
- `versions/0.6.2/index.md` — sealed 0.6.2 planning and release notes.
- `versions/0.6.1/index.md` — sealed 0.6.1 planning and release notes.
- `versions/0.6.0/index.md` — sealed 0.6.0 planning and release notes.
- `versions/0.5.2/index.md` — sealed 0.5.2 planning and release notes.
- `versions/0.5.1/index.md` — sealed 0.5.1 planning and release notes.
- `versions/0.5.0/index.md` — sealed 0.5.0 planning and release notes.
- `versions/0.4.0/index.md` — sealed 0.4.0 planning and release notes.
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
