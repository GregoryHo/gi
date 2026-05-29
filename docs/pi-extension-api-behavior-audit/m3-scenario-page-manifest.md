# M3 — Scenario/page manifest

## Status

Done.

## SPEC

### Scope

Introduce a minimal scenario manifest so capture runs are anchored to stable page/QA scenario metadata instead of hardcoded strings scattered through the implementation.

M3 should preserve the existing M2 account-activity behavior while moving scenario details into a reusable manifest model.

Deliverables:

- Scenario manifest TypeScript types.
- Built-in default manifest containing the M2 `account-activity-basic` scenario.
- Manifest loader that can read a JSON manifest from disk, with fallback to the built-in manifest.
- Validation for the minimal required fields.
- Account-history capture uses scenario metadata from the loaded/default manifest.
- Manifest metadata is recorded in capture `manifest.json` sufficiently for later report/audit provenance.

### Minimal scenario shape

Use the smallest useful shape:

```json
{
  "version": 1,
  "scenarios": [
    {
      "id": "account-activity-basic",
      "feature": "Account activity",
      "description": "查詢Account activity列表",
      "type": "read-only",
      "layer": "browser-visible",
      "page": {
        "oldPath": "/account/activity",
        "newPath": "/account/activity"
      },
      "apiAllowlist": {
        "old": ["/apis/account/activity"],
        "new": ["/gateway/apis/account/activity"]
      },
      "notes": [
        "Layer A validation-only scenario; final parity evidence requires Layer B."
      ]
    }
  ]
}
```

### Non-goals

- No multi-page capture UX.
- No QA TSV import.
- No full scenario DSL.
- No automatic login scripting.
- No Layer B proxy behavior.
- No audit report generation.
- No breaking change to the M2 `/api-audit account-activity` command.

### Design notes

M3 should avoid a large generic orchestration framework. The point is to make scenario/page anchors explicit and reusable before M4 Layer B work.

The command may optionally accept a manifest path, for example:

```text
/api-audit account-activity --manifest ./api-audit.scenarios.json
```

If no manifest path is provided, use the built-in default manifest.

The run artifact should include enough scenario metadata to know exactly what was captured, without duplicating large future QA case payloads.

### Expected files

Likely package files:

- `packages/pi-extension-api-behavior-audit/src/scenarios.ts`
- `packages/pi-extension-api-behavior-audit/src/scenarios.test.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/browser-capture.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/config.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/types.ts`
- README / CHANGELOG updates

## AC

Acceptance criteria:

- Built-in account-activity scenario is available without user config.
- Loader reads a JSON manifest from disk when `--manifest` is supplied.
- Loader rejects missing/duplicate scenario ids and missing required paths/allowlists.
- `/api-audit account-activity` still works with no manifest argument.
- `/api-audit account-activity --manifest <path>` can use a compatible custom scenario manifest.
- Run `manifest.json` records scenario details or a compact scenario snapshot for provenance.
- Layer A validation-only warning remains present.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Manual verification, if local old/new services are available:

```text
/api-audit account-activity --old-url http://localhost:8080 --new-url http://localhost:8008
```

Custom manifest smoke, using a temporary manifest equivalent to the built-in account-activity scenario:

```text
/api-audit account-activity --manifest ./api-audit.scenarios.json --old-url http://localhost:8080 --new-url http://localhost:8008
```

## Status tracking

At start:

1. Confirm M2 is `Done`.
2. Change M3 status in `milestones.md` from `Proposed` to `In progress`.
3. Append a start entry to `log.md`.
4. Commit the plan/status/log update before code work.

At completion:

1. Run automated verification.
2. Run manual capture if local old/new services are available.
3. Change M3 status to `Done`.
4. Append verification evidence and any manual-capture caveats to `log.md`.
5. Commit docs and implementation together.

## Completion notes

Implemented:

- Built-in `account-activity-basic` scenario manifest.
- Optional `--manifest <path>` loading for compatible custom scenario manifests.
- Scenario manifest validation for version, duplicate ids, required page paths, and required API allowlists.
- Account-history capture now derives page paths and API allowlists from scenario metadata.
- Capture `manifest.json` includes `scenarioSnapshots` for provenance.

Manual smoke passed:

- Built-in manifest smoke run: `2026-05-25T03-10-21-200Z`.
- Custom manifest smoke run: `2026-05-25T03-16-22-781Z` using `/tmp/api-audit.scenarios.json`.

Custom manifest smoke observed:

- `manifest.json` records `scenarioSnapshots`, `layer: "browser-visible"`, and `exchangeCount: 2`.
- `exchanges.ndjson` contains one old `/apis/account/activity` exchange and one new `/gateway/apis/account/activity` exchange.
- Redaction scan found no raw cookie, authorization, password/passwd, token/session/csrf values.
- New authorization header was `[REDACTED]`.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
