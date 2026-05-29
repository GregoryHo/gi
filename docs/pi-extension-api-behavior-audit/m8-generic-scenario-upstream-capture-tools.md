# M8 — Generic scenario upstream capture tools

## Status

Done.

## SPEC

### Scope

Generalize the account-activity-specific tool workflow into scenario-id-driven tools.

M8 should let users say they want to prepare or run upstream capture for any scenario already present in the scenario dictionary SOT, without adding one custom tool per scenario.

### Deliverables

Add generic tools:

- `api_audit_prepare_upstream_capture`
  - Inputs include `scenarioId`, old/new page base URLs, old/new backend target URLs, proxy ports, allow-hosts, and optional dictionary path.
  - Reads `scenarioId` from the scenario dictionary SOT.
  - Outputs recorder URLs, page paths, browser-visible API allowlists, upstream candidates, and manual app configuration instructions.
  - Does not start proxies or browsers.
- `api_audit_run_upstream_capture`
  - Inputs include `scenarioId` and the same target/config fields.
  - Reuses the existing recorder + Playwright manual-auth flow through a scenario-generic helper.
  - Requires explicit UI confirmation.
  - Does not mutate old/new app configuration.

The existing account-activity-specific tools remain as compatibility/convenience wrappers.

### Non-goals

- No scenario discovery.
- No automatic scenario dictionary writing.
- No audit report generation.
- No destructive/write API flows.
- No automatic old/new app config mutation.

### Design notes

Generic tools should use the scenario dictionary as the source of truth for:

- page paths,
- browser-visible API allowlists,
- upstream candidate paths,
- scenario notes and evidence lineage.

M8 should avoid duplicating account-activity logic. Existing account-activity helpers can be refactored so account-activity becomes a scenario-specific wrapper around the generic flow.

### Expected files

Likely changes:

- `packages/pi-extension-api-behavior-audit/src/upstream-scenario-capture.ts`
- `packages/pi-extension-api-behavior-audit/src/upstream-scenario-capture.test.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/tools.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/tools.test.ts`
- README / CHANGELOG updates

## AC

Acceptance criteria:

- `api_audit_prepare_upstream_capture` accepts `scenarioId` and reads scenario details from dictionary SOT.
- `api_audit_prepare_upstream_capture` includes old/new page paths and upstream candidates in output.
- `api_audit_run_upstream_capture` accepts `scenarioId` and uses the same scenario paths for Playwright navigation.
- Non-local backend target safety remains allow-host gated.
- UI confirmation is required before capture starts.
- Existing account-activity-specific tools still pass tests.
- Tool outputs do not include raw payload bodies.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

## Status tracking

At start:

1. Add M8 as `In progress` and M9 as `Proposed` in `milestones.md`.
2. Append start entry to `log.md`.
3. Commit docs before code work.

At completion:

1. Run verification commands.
2. Change M8 status to `Done`.
3. Append verification evidence to `log.md`.
4. Commit docs and implementation together.

## Completion notes

Implemented generic scenario-id-driven tools:

- `api_audit_prepare_upstream_capture`
- `api_audit_run_upstream_capture`

Behavior:

- Reads `scenarioId` from the scenario dictionary SOT.
- Includes scenario page paths and upstream candidates in preparation output.
- Reuses existing recorder + Playwright flow with a scenario-specific `CaptureScenario` derived from the dictionary.
- Keeps account-activity-specific tools as compatibility wrappers.
- Preserves allow-host target safety and explicit UI confirmation.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
