# Web Search roadmap

## Product intent

Provide pi with a small, auditable web-search extension that starts from the user's existing OpenAI/Codex access and only grows into additional providers after the core tool contract is stable.

## 0.1.0 MVP

OpenAI/Codex web-search provider only.

- Register one `web_search` tool.
- Resolve OpenAI/Codex auth from pi's model registry and optional `OPENAI_API_KEY` fallback.
- Call OpenAI Responses API / Codex-compatible web-search endpoint with `web_search` required.
- Return a concise synthesized answer and citations.
- Keep output compact and safe.

## 0.2.0

Minimal safe `fetch_content` companion tool with SSRF protection, timeout, response size limits, and local HTML/text extraction.

## Near-term candidates after 0.2.0

Plan these under `versions/<semver>/` after the current version is sealed.

- Provider interface and second provider experiment, likely Brave or Exa.
- Search result storage and retrieval by response id.
- `/web-search` diagnostics command for auth/provider availability.
- Better result rendering for TUI.
- Summary/workflow integration once raw search is stable.

## Explicitly deferred from 0.1.0

- Google CSE.
- Browser-cookie search or Gemini Web access.
- Curator browser UI.
- YouTube, local video, PDF, GitHub clone, or general content extraction.
- Multi-provider auto fallback.
