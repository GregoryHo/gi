# M7 — Tool-based guided comparison workflow

## Status

Done.

## SPEC

### Scope

Replace the previous audit-report milestone with natural-language-triggerable pi tools that help users run and inspect API comparison evidence.

M7 is not a report-generation milestone. It focuses on making the extension convenient to use from natural language while keeping deterministic validation and explicit user confirmation.

### Deliverables

Register pi tools alongside the existing `/api-audit` slash command:

- `api_audit_list_scenarios`
  - Read-only.
  - Lists scenario dictionary entries from the M6 scenario SOT.
- `api_audit_validate_run`
  - Read-only.
  - Validates one artifact run directory with M6 schema-backed loaders.
- `api_audit_prepare_account_history_upstream_capture`
  - Read-only guidance.
  - Produces recorder/config instructions for account-activity upstream capture without starting browsers or proxies.
- `api_audit_run_account_history_upstream_capture`
  - Interactive local artifact writer.
  - Runs the existing M5 account-activity upstream capture flow through a tool entrypoint.
  - Requires UI confirmation before Playwright navigation.

Existing slash commands remain supported for deterministic manual invocation.

### Natural-language examples

Users should be able to ask:

```text
有哪些 API audit scenario 可以跑？
幫我檢查這個 API audit run 是否符合 schema。
我要比對 account-activity，新舊 backend target 是 old=... new=...
幫我跑 account-activity 的新舊 upstream API capture。
```

The LLM should then select the registered tool instead of asking the user to type `/api-audit ...`.

### Non-goals

- No audit report artifact.
- No LLM-generated parity decision.
- No automatic old/new app config mutation.
- No new scenario creation tool.
- No destructive/write API flows.
- No production targets by default.

### Safety notes

- Tools that only list or validate data are read-only.
- The run-capture tool may write local sanitized artifacts under `.pi-api-audit-runs`.
- The run-capture tool must preserve M5 safeguards:
  - local old/new page URLs,
  - non-local backend targets require explicit allow-hosts,
  - explicit UI confirmation before page actions,
  - no raw payloads in tool result text.
- Tool results should expose paths, counts, scenario ids, and warnings only.

### Expected files

- `packages/pi-extension-api-behavior-audit/src/tools.ts`
- `packages/pi-extension-api-behavior-audit/src/tools.test.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/index.ts`
- README/CHANGELOG updates

## AC

Acceptance criteria:

- Extension still registers `/api-audit` commands.
- Extension registers pi tools via `pi.registerTool`.
- Tool prompt snippets/guidelines make natural-language triggering likely.
- `api_audit_list_scenarios` returns scenario ids, features, page paths, browser APIs, and upstream candidates from the scenario dictionary SOT.
- `api_audit_validate_run` uses `loadValidatedRun`, not raw JSON parsing.
- `api_audit_prepare_account_history_upstream_capture` returns deterministic user instructions and does not start proxies/browsers.
- `api_audit_run_account_history_upstream_capture` reuses M5 capture code and requires interactive UI confirmation.
- Tool outputs do not include raw request/response payload bodies.
- M7 removes the audit-report milestone from active roadmap/tracker.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

## Status tracking

At start:

1. Replace M7 audit report artifact in `milestones.md` with M7 tool-based guided comparison workflow.
2. Update roadmap/index/log.
3. Commit plan/status/log update before code work.

At completion:

1. Run verification commands.
2. Change M7 status to `Done`.
3. Append verification evidence to `log.md`.
4. Commit docs and implementation together.

## Completion notes

Implemented four natural-language-callable pi tools:

- `api_audit_list_scenarios`
- `api_audit_validate_run`
- `api_audit_prepare_account_history_upstream_capture`
- `api_audit_run_account_history_upstream_capture`

Existing `/api-audit` slash commands remain registered.

Tool implementation notes:

- Scenario listing reads the M6 scenario dictionary SOT.
- Run validation uses schema-backed `loadValidatedRun`.
- Preparation guidance is deterministic and does not start proxies or browsers.
- Account-history upstream capture reuses M5 capture code and requires interactive UI confirmation.
- Tool result text reports paths/counts/warnings only, not raw request/response bodies.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
