# M1 — Natural-language retrieval guidance

## Status

Done.

## SPEC

### Goal

Teach the model-facing tool guidance that `responseId`, `resultId`, and offsets are internal tool plumbing. Users should be able to ask natural-language research/read questions without knowing result ids or continuation mechanics.

### Scope

- `web_search` guidance should encourage search → fetch for research questions when snippets are insufficient.
- `fetch_content` guidance should tell the model to automatically continue with `get_search_content` when fetched content is truncated and more context is needed.
- `get_search_content` guidance should tell the model to use the last fetched response id / next offset for follow-up continuation requests, without asking users for offsets.
- Final answers should avoid exposing tool JSON unless the user asks for debugging or exact tool details.

### Non-goals

- New high-level workflow tool. That is planned for 0.6.0.
- Changing tool schemas.
- Changing visible metadata or storage semantics.

## AC

- Tool tests verify guidance includes natural-language/autonomous continuation instructions.
- Tool schemas and execution behavior remain unchanged.
- All existing tests remain green.

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

- `web_search` guidance now tells the model to search first, then fetch relevant sources for natural-language research tasks.
- `fetch_content` guidance now tells the model to automatically call `get_search_content` when truncated content needs more context.
- `get_search_content` guidance now tells the model to infer response ids/offsets from prior metadata for continuation requests.
- Tests verify the new guidance without changing execution behavior.

Verification evidence is recorded in `log.md`.
