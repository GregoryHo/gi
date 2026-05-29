# M1 — Artifact and redaction primitives

## Status

Done.

## SPEC

### Scope

Create the shared data model and safety primitives used by both Layer A and Layer B capture.

Deliverables:

- Capture run directory naming and layout helpers.
- API exchange data model for sanitized request/response records.
- Redaction helpers for headers, query parameters, and JSON-like bodies.
- Artifact writer helpers for newline-delimited exchanges and manifest metadata.
- Unit tests for redaction and artifact shaping.

### Layer discipline

This milestone is layer-neutral. It must not assume browser-visible capture is the final audit surface.

The same sanitized artifact model should support:

- **Layer A** browser-visible Playwright request/response capture.
- **Layer B** upstream/backend recording proxy request/response capture.

### Non-goals

- No Playwright orchestration.
- No local proxy implementation.
- No old/new project process management.
- No LLM audit report generation.
- No automatic reading or writing of real capture payloads outside test fixtures.

### Design notes

Initial artifact layout should stay simple:

```text
.pi-api-audit-runs/<run-id>/
├── manifest.json
└── exchanges.ndjson
```

A later milestone may introduce per-scenario/per-side subdirectories. M1 should avoid overfitting before real capture exists.

Suggested exchange shape:

```json
{
  "runId": "2026-05-24T...",
  "layer": "browser-visible|upstream",
  "side": "old|new",
  "scenarioId": "account-activity-basic",
  "request": {
    "method": "GET",
    "url": "http://localhost:8080/apis/account/activity?...",
    "headers": {},
    "body": null
  },
  "response": {
    "status": 200,
    "headers": {},
    "body": {}
  },
  "timing": {
    "startedAt": "...",
    "durationMs": 123
  },
  "provenance": {
    "source": "playwright|recording-proxy",
    "pageUrl": "http://localhost:8080/account/activity"
  }
}
```

Redaction defaults must include at least:

- Headers: `authorization`, `cookie`, `set-cookie`, `x-csrf-token`, `x-xsrf-token`.
- Body/query keys containing: `password`, `passwd`, `token`, `secret`, `cookie`, `session`, `authorization`, `csrf`.

Redaction should preserve structure where possible so later diffing remains useful.

### Expected files

Likely package files:

- `packages/pi-extension-api-behavior-audit/src/redaction.ts`
- `packages/pi-extension-api-behavior-audit/src/redaction.test.ts`
- `packages/pi-extension-api-behavior-audit/src/artifacts.ts`
- `packages/pi-extension-api-behavior-audit/src/artifacts.test.ts`
- `packages/pi-extension-api-behavior-audit/src/types.ts`

Docs may be updated if implementation discovers better naming.

## AC

Acceptance criteria:

- Redaction replaces sensitive values with a stable marker such as `[REDACTED]`.
- Redaction handles nested objects and arrays.
- Header redaction is case-insensitive.
- Artifact writer produces deterministic JSON lines from sanitized exchanges.
- No raw secret-looking values appear in test snapshot/output fixtures.
- Public exports remain minimal and package-local.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
```

## Status tracking

At start:

1. Change M1 status in `milestones.md` from `Proposed` to `In progress`.
2. Append a start entry to `log.md`.
3. Commit status/log update before code work.

At completion:

1. Run the verification commands above.
2. Change M1 status to `Done`.
3. Append verification evidence to `log.md`.
4. Commit docs and implementation together.

## Completion notes

Implemented:

- Layer-neutral `ApiExchange` and `CaptureManifest` types.
- Default redaction policy `default-v1` with stable `[REDACTED]` marker.
- Case-insensitive sensitive header redaction.
- Nested JSON-like body redaction.
- Sensitive query-parameter redaction.
- Run id/path helpers plus `manifest.json` and `exchanges.ndjson` writers.

Verification passed on 2026-05-24:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
