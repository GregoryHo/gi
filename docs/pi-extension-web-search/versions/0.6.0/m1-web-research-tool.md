# M1 — `web_research` high-level workflow tool

## Status

Done.

## SPEC

### Goal

Provide a high-level tool for natural-language research tasks that need both discovery and source reading, so users can ask normal questions without knowing `responseId`, `resultId`, or offsets.

### Scope

Runtime behavior:

- Register `web_research` with parameters:
  - `question: string`
  - `maxSources?: number`, clamped to 1-3
  - `maxCharsPerSource?: number`, clamped to a bounded range
  - `domainFilter?: string[]`
- `web_research` internally:
  - calls OpenAI/Codex-backed search using the question
  - stores search sources with a session-local search response id
  - fetches the top sources through the same SSRF-guarded fetch path
  - stores each fetched full content with session-local fetch response ids
  - returns a compact evidence bundle: search answer plus fetched excerpts and source metadata
- If a source fetch fails, the tool records the source error and continues with other sources.

### Non-goals

- Persistent storage.
- Browser cookies, JS rendering, or new providers.
- Hiding low-level tools; they remain available for advanced follow-up/debugging.
- Perfect autonomous multi-hop reading. This is a bounded first workflow.

## AC

- `web_research` schema is registered and guidance says to prefer it for natural-language research/read tasks.
- `web_research` searches, fetches at least the top source, stores fetched content, and returns source/fetch metadata.
- Fetch failures for one source do not fail the whole research call.
- Existing tools and tests remain green.

## Verification

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

## Completion notes

Completed on 2026-06-26.

Implemented changes:

- Added `web_research` tool registration.
- `web_research` calls the existing OpenAI/Codex search path, stores search result ids, fetches top sources through the same SSRF-guarded fetch dependency, stores full fetched content, and returns an evidence bundle.
- Fetch errors are recorded per source and do not fail the whole research call.
- Tests cover schema/guidance, successful search+fetch workflow, and per-source fetch failure continuation.

Verification evidence is recorded in `log.md`.
