# v0.2.2 M2 — Review viewer candidate curation

## Status

Done.

## SPEC

Clarify `review.html` as candidate endpoint curation / handback rather than old/new behavior diff.

Behavior:

- `review.html` reads all suggestion artifacts under `.pi-api-audit-runs/candidates/`.
- Suggestions appear even before their comparison evidence is accepted into scenario dictionary `evidence.comparisons[]`.
- The upstream table explains that old/new rows are for deciding what to add to `upstreamApiCandidates.old/new`.
- The review viewer points users to `index.html` report mode for old/new behavior comparison.

## AC

- A candidate suggestion with no accepted SOT evidence still appears in `review.html`.
- Viewer copy says "Candidate endpoint curation".
- Viewer copy states that the upstream table is not an old/new behavior diff.
- Docs describe the distinction between review mode and report mode.

## Verification

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit -- src/tools/viewer-build.test.ts
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
```
