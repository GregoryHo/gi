# Web Search 0.5.0 log

## 2026-06-26 — 0.5.0 sealed

M1 completed and docs sealed for v0.5.0. Implemented Defuddle-first HTML extraction with local-only `useAsync:false`, retained simple fallback, and verified cleaner pi docs extraction.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

The pi load smoke command exited 0 without extension startup errors.

## 2026-06-26 — M1 started

Started extraction-quality work inspired by `kepano/defuddle`. Initial spike:

- Defuddle is MIT licensed and published as `defuddle@0.19.1`.
- `defuddle/node` accepts a DOM `Document` from `linkedom` and can output Markdown.
- Defuddle output for pi docs starts closer to article content than the current simple extractor, though still includes some top-level docs chrome and remains large enough to require truncation/chunk retrieval.
- Decision: use local-only Defuddle parsing with `useAsync: false`, and retain current simple extractor as fallback.
