# Web Search log

## 2026-06-26 — 1.0.0 sealed

v1.0.0 sealed as the stable public GitHub clone-and-install release. The package now includes MIT/public metadata, clone/install docs, `/web-search-doctor`, public clean clone verification evidence, and package version `1.0.0`. Active planning is cleared. No package-scoped tag was created because tagging was not explicitly requested.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```

## 2026-06-26 — 1.0.0 planning started

Started 1.0.0 planning. Goal is to publish the repository on GitHub before 1.0.0 in a clone-and-install form: users can clone the monorepo, run `npm install`, and install `./packages/pi-extension-web-search`. Scope focuses on docs, public metadata/license, diagnostics, clean clone smoke, and release sealing rather than feature breadth expansion.

## 2026-06-26 — 0.6.2 sealed

v0.6.2 sealed with generic online routing guidance. Added natural-language cues for online/public/remote/internet/external research and outside-current-repo availability questions, without adding narrow tools.

## 2026-06-26 — 0.6.1 sealed

v0.6.1 sealed with public source routing guidance. `web_research` is registered first and guidance now steers ambiguous public extension/package/source implementation discovery away from local grep unless the user explicitly asks for local/current-repo search.

## 2026-06-26 — 0.6.0 sealed

v0.6.0 sealed with `web_research`, a high-level workflow tool that searches, fetches top sources, stores fetched content, and returns a compact evidence bundle for natural-language research/read tasks.

## 2026-06-26 — 0.5.2 sealed

v0.5.2 sealed with natural-language retrieval guidance. Tool guidance now tells the model to handle response ids, result ids, and offsets internally, and to continue reading truncated content when more context is needed.

## 2026-06-26 — 0.5.1 sealed

v0.5.1 sealed with visible retrieval metadata. `fetch_content` now shows `responseId` and full character count in text output; `get_search_content` now shows offset/limit/count/next-offset metadata before the retrieved chunk.

## 2026-06-26 — 0.5.0 sealed

v0.5.0 sealed with Defuddle-first HTML extraction. `fetch_content` now parses HTML through local `defuddle/node` with `useAsync:false`, falling back to the prior simple extractor when needed. Live pi docs smoke showed cleaner first-chunk content while preserving truncation and chunk retrieval.

## 2026-06-25 — 0.4.0 sealed

v0.4.0 sealed with session-local full fetched-content retrieval. `fetch_content` now returns `responseId` and `fullCharCount` while keeping inline output bounded; `get_search_content` retrieves full content chunks by offset/limit during the current extension session.

## 2026-06-25 — 0.3.0 sealed

v0.3.0 sealed with session-local provenance bridge and untrusted-content hardening. `web_search` now returns `responseId` plus result ids; `fetch_content` can fetch by direct URL, `responseId/resultId`, or `responseId/index`. Fetched content output explicitly warns that web text is untrusted evidence/data, not instructions.

## 2026-06-25 — 0.1.0 sealed

M1 completed and docs sealed for v0.1.0. Implemented `web_search` with OpenAI/Codex auth resolution, required OpenAI Responses API `web_search` calls, citation parsing from JSON/SSE responses, compact safe output, and tests for core behavior.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

The pi load smoke command exited 0 without extension startup errors. Authenticated live search smoke remains manual because it depends on an interactive pi/OpenAI login context.

## 2026-06-25 — M1 implementation started

M1 implementation started in the sibling worktree. Scope remains one read-only OpenAI/Codex-backed `web_search` tool with tests first for pure parsing, request construction, and tool registration behavior.

## 2026-06-25 — 0.1.0 scope narrowed

Decision: v0.1.0 will not depend on Google CSE. The MVP should use OpenAI/Codex web-search capability because the user already has an OpenAI subscription and current pi provider access is OpenAI-based.

Reference inputs:

- `amosblomqvist/pi-config` for a minimal `web_search` tool shape and query normalization ideas.
- `nicobailon/pi-web-access` for OpenAI/Codex auth resolution and Responses API `web_search` usage.

Constraints:

- Keep v0.1.0 read-only.
- Avoid browser cookies and persistent content storage.
- Keep provider routing out of M1.
