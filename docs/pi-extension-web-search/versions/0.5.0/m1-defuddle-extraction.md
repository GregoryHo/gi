# M1 — Defuddle extraction

## Status

Done.

## SPEC

### Goal

Improve fetched HTML readability by replacing the current tag-stripping extraction path with a local Defuddle-based article extraction path.

### Scope

Runtime behavior:

- For HTML responses, parse the fetched HTML with `linkedom` and `defuddle/node`.
- Request Markdown output from Defuddle.
- Disable Defuddle async third-party extraction with `useAsync: false`.
- Use Defuddle title/content when it returns non-empty content.
- Fall back to the existing simple extractor if Defuddle fails or returns empty content.
- Preserve all existing fetch safety boundaries: HTTP/HTTPS only, SSRF guard, redirect validation, timeouts, byte caps, inline char caps, session-local chunk retrieval, and untrusted-content warning.

### Non-goals

- Browser rendering or cookies.
- New provider/fallback network calls.
- PDF/video/GitHub special handling.
- Perfect article extraction for every site.

### Expected files

- `src/html-extract.ts` with tests.
- `src/fetch-content.ts` refactor to use the HTML extractor.
- `package.json` dependency updates.
- README/changelog/docs updates.

## AC

- HTML extraction uses Defuddle first and returns cleaner article-like markdown for representative docs pages.
- Defuddle is invoked with `useAsync: false`.
- If Defuddle throws, fetch extraction falls back to existing simple HTML extraction.
- Existing `fetch_content`, `get_search_content`, SSRF, truncation, and tool contract tests remain green.

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

Implemented files:

- `src/html-extract.ts` for Defuddle-first HTML extraction and simple fallback.
- `src/html-extract.test.ts` covering local-only Defuddle options and fallback behavior.
- `src/fetch-content.ts` now delegates HTML extraction to the new extractor.
- `package.json` now depends on `defuddle` and `linkedom`.

Live smoke on `https://pi.dev/docs/latest/extensions` showed the first inline chunk reaches the extension documentation body quickly, instead of spending the first chunk on logo/navigation links.

Verification evidence is recorded in `log.md`.
