# M2 — Layer A account-activity local capture POC

## Status

Done.

## SPEC

### Scope

Implement the first runnable local capture proof of concept using Layer A browser-visible Playwright request/response capture.

Scenario:

```text
id: account-activity-basic
page: /account/activity
feature: Account activity
type: read-only
layer: browser-visible
```

Targets:

```text
old: http://localhost:8080/account/activity
new: http://localhost:8008/account/activity
```

Expected browser-visible APIs:

```text
old: /apis/account/activity
new: /gateway/apis/account/activity
```

### Capture behavior

Add a minimal `/api-audit` subcommand or command argument that can run the account-activity POC locally. Exact UX can be refined during implementation, but it should stay intentionally small.

The POC should:

1. Require local old/new base URLs.
2. Use Playwright to open each side.
3. Support manual-auth flow before capture, because old uses cookies/session and new uses localStorage/token.
4. Navigate to `/account/activity` after auth is ready.
5. Collect request/response pairs for allowlisted API URL patterns.
6. Sanitize via M1 redaction before writing artifacts.
7. Write a manifest that records this is Layer A validation only.

### Manual-auth flow

Initial recommended flow:

1. Open old base URL in a headed browser.
2. User logs in manually.
3. User confirms readiness in pi UI.
4. Save/reuse browser context state for old capture.
5. Repeat for new base URL.
6. Navigate both sides to account activity and collect exchanges.

This avoids committing credentials or automating login before the capture pipeline is proven.

### Non-goals

- No Layer B upstream/backend proxy capture.
- No automatic credential storage.
- No scenario manifest framework beyond hardcoded account-activity defaults.
- No audit report or parity judgment.
- No write/destructive flows.
- No attempt to reuse existing mock-based E2E specs as real backend evidence.

### Design notes

Existing new-project E2E is mock-based and often uses `page.route(...)` plus strict-network guards. M2 must not treat those mock responses as backend evidence.

Layer A artifacts are useful to validate:

- page/scenario anchoring,
- artifact shape,
- redaction,
- command orchestration,
- later LLM-readable summaries.

Layer A artifacts are not sufficient for final backend behavior parity claims.

### Expected files

Likely package files:

- `packages/pi-extension-api-behavior-audit/src/browser-capture.ts`
- `packages/pi-extension-api-behavior-audit/src/browser-capture.test.ts` if helper logic can be unit-tested without launching browsers.
- `packages/pi-extension-api-behavior-audit/src/commands.ts`
- `packages/pi-extension-api-behavior-audit/src/config.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/index.ts`.
- README command usage update.

Playwright may require a runtime dependency decision during implementation. Prefer the smallest viable dependency shape and document it before adding package dependencies.

## AC

Acceptance criteria:

- Command refuses non-local old/new base URLs unless explicitly allowlisted.
- Capture writes sanitized Layer A artifacts for old and new account-activity requests.
- Manifest records scenario id, layer, side, base URLs, started/finished timestamps, and redaction policy version/name.
- Captured responses are not printed directly to the LLM/context by default.
- Missing local services or missing auth produce actionable errors.
- Docs clearly state Layer A is a validation layer, not final backend behavior evidence.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
```

Manual verification, once implemented:

```bash
pi -e ./packages/pi-extension-api-behavior-audit
# then run the documented /api-audit account-activity command
```

## Status tracking

At start:

1. Confirm M1 is `Done`.
2. Change M2 status in `milestones.md` from `Proposed` to `In progress`.
3. Append a start entry to `log.md`.
4. Commit status/log update before code work.

At completion:

1. Run automated verification.
2. Run one local manual capture, if old/new services are available.
3. Change M2 status to `Done`.
4. Append verification evidence and any manual-capture caveats to `log.md`.
5. Commit docs and implementation together.

## Completion notes

Implemented:

- `/api-audit account-activity` command.
- Local-only old/new URL validation.
- Headed Playwright manual-auth flow for old and new local sites.
- Layer A browser-visible capture for:
  - old `/apis/account/activity`
  - new `/gateway/apis/account/activity`
- Sanitized artifact output using M1 redaction primitives.
- Manifest metadata that records Layer A as validation-only.

Manual smoke passed on run:

```text
.pi-api-audit-runs/2026-05-25T01-41-13-308Z/
├── manifest.json
└── exchanges.ndjson
```

Observed:

- `manifest.json` records `layer: "browser-visible"`, scenario `account-activity-basic`, old/new local base URLs, and `exchangeCount: 2`.
- `exchanges.ndjson` contains one old and one new account-activity exchange.
- Redaction scan found no raw cookie, authorization, password/passwd, token/session/csrf values.
- New request authorization header was redacted as `[REDACTED]`.
- Old/new response top-level shape matched: `Items`, `Others`, `Pager`.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
