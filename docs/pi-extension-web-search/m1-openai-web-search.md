# M1 — OpenAI/Codex web search MVP

## Status

Done.

## SPEC

### Goal

Create the smallest useful Web Search pi package: one read-only `web_search` tool backed by OpenAI/Codex web-search capability.

The milestone should prove that this repository can ship a local pi package that uses the user's existing pi/OpenAI subscription path where possible, without introducing Google CSE or additional provider accounts.

### Scope

Package/docs scaffold:

- `packages/pi-extension-web-search/`
- `docs/pi-extension-web-search/`
- `@gregho/pi-extension-web-search` package manifest with `pi.extensions` pointing at `src/index.ts`.

Runtime behavior:

- Register one LLM-callable tool named `web_search`.
- Accept one query per call for v0.1.0:
  - `query: string`
  - optional `domainFilter?: string[]` for allow/block domain hints where supported.
  - optional `count?: number` as an advisory source-count hint, clamped to a small safe range.
- Resolve OpenAI/Codex credentials in this order:
  1. pi `ctx.modelRegistry.getApiKeyAndHeaders(...)` for known OpenAI/Codex model candidates.
  2. `OPENAI_API_KEY` environment variable as explicit API-key fallback.
- Use OpenAI Responses API web search semantics, referencing `pi-web-access` implementation details during coding:
  - `tools: [{ type: "web_search" }]`
  - `tool_choice: "required"`
  - `store: false`
  - parse assistant answer text and URL citations.
- Return compact model-facing content:
  - synthesized answer.
  - numbered source list with title and URL.
  - clear error message when auth or web-search capability is unavailable.
- Return structured `details`:
  - provider/auth route used, without secrets.
  - query.
  - source count.
  - source metadata.

### Non-goals

- Google CSE / Google Programmable Search.
- Multi-provider routing or fallback.
- Browser cookies, Gemini Web, or any browser profile access.
- General `fetch_content` / page extraction.
- Search result storage or `get_search_content`.
- Curator browser UI.
- YouTube, local video, PDF, or GitHub clone handling.
- Persisting API keys in package-owned config.

### Design notes

- Prefer an extension-shell plus pure-core layout:
  - `src/index.ts` — extension shell.
  - `src/tools.ts` — tool registration and pi adapter.
  - `src/openai-search.ts` — OpenAI/Codex request adapter.
  - `src/results.ts` — pure parsing/formatting helpers.
- Keep auth helpers small and testable. Never return raw headers or tokens from helpers used in `details`.
- If Codex subscription auth cannot be exercised reliably in automated tests, isolate it behind an adapter and cover parsing/formatting plus request construction with unit tests.
- Tool execution should pass the provided `signal` into network calls via `AbortSignal.any([signal, timeout])` where available.

### Expected files

- Package:
  - `packages/pi-extension-web-search/AGENTS.md`
  - `packages/pi-extension-web-search/README.md`
  - `packages/pi-extension-web-search/CHANGELOG.md`
  - `packages/pi-extension-web-search/package.json`
  - `packages/pi-extension-web-search/tsconfig.json`
  - `packages/pi-extension-web-search/src/index.ts`
  - M1 implementation/test files as needed.
- Docs:
  - this plan plus index/roadmap/milestone/log governance files.

## AC

### Functional acceptance

- `pi -e ./packages/pi-extension-web-search` loads the package without startup errors.
- The `web_search` tool is registered with a strict TypeBox schema.
- With no available auth, `web_search` fails with an actionable message and does not expose secret-like values.
- With valid OpenAI/Codex web-search auth, `web_search` returns:
  - an answer string.
  - at least one source URL when the provider supplies citations.
  - structured `details.sources` without secrets.
- Domain filters are either applied to the provider request when supported or clearly treated as advisory in implementation docs.

### Safety acceptance

- No API keys, auth headers, cookies, or provider raw payloads are written to files or returned in tool details.
- No browser-cookie access is implemented.
- No project files are mutated by tool execution.
- Tool output is compact and bounded.

### Verification commands

From the sibling worktree repo root:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```

Manual smoke, when auth is configured:

```bash
pi -e ./packages/pi-extension-web-search
```

Then ask pi to search for a harmless public query and confirm the `web_search` tool returns citations.

## Status tracking

At implementation start:

- Change `docs/pi-extension-web-search/milestones.md` M1 from `Planned` to `In progress`.
- Append a start entry to `docs/pi-extension-web-search/log.md`.

At completion:

- Change M1 to `Done`.
- Add completion notes here with verification evidence.
- Update `packages/pi-extension-web-search/CHANGELOG.md` for `0.1.0`.
- Update docs `index.md`, `archive.md`, and `log.md` before declaring the version sealed.

## Completion notes

Completed on 2026-06-25.

Implemented files:

- `src/index.ts` registers the extension tool.
- `src/tools.ts` registers the strict TypeBox `web_search` tool schema.
- `src/openai-search.ts` resolves OpenAI/Codex auth, calls OpenAI Responses API / Codex endpoint, and parses responses.
- `src/results.ts` normalizes params, builds request bodies, parses citations, and formats compact tool results.
- Unit tests cover tool registration, query/domain normalization, request construction, JSON/SSE response parsing, no-auth errors, and safe structured output.

Verification evidence:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

All automated commands passed. The pi load smoke command exited 0 without extension startup errors. Manual authenticated search smoke remains dependent on an interactive pi/OpenAI login context.
