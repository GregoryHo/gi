# M1 — Public source routing

## Status

Done.

## SPEC

### Goal

Make ambiguous source discovery requests route to web research when the target appears to be public/online, especially pi packages, extensions, GitHub repositories, libraries, or implementation examples.

### Scope

- Register `web_research` before lower-level web tools so it is more discoverable.
- Strengthen `web_research` guidance:
  - use it for public/online source code, GitHub repos, pi packages, extensions, libraries, and implementations
  - treat phrases like "查", "查詢", "找", "find", "look up", "source", "implementation" as web-research cues unless clearly local
  - use local grep/read only when the user says current repo, local files, this project, or a known local path
- Strengthen `web_search` guidance:
  - prefer `web_research` for research/read/source-inspection tasks
  - use raw `web_search` mainly for quick snippets or when the user explicitly asks only to search

### Non-goals

- New high-level workflow behavior.
- Changing fetch/search logic.
- Changing tool schemas.

## AC

- Tool registration order puts `web_research` first.
- Tests verify public/online source routing guidance.
- Existing behavior tests remain green.

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

- `web_research` is registered before lower-level `web_search`, `fetch_content`, and `get_search_content`.
- `web_research` guidance now explicitly covers public/online source code, GitHub repositories, pi packages, extensions, libraries, and implementations.
- Guidance says local grep/read should be used only when current repo/local files/this project/local path is explicit.
- Tests cover registration order and routing guidance.

Verification evidence is recorded in `log.md`.
