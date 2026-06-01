# v0.2.0 M2 — Headless automation runner

## Status

Done.

## Problem

M1 lets an agent start and stop recorders, but the agent still needs an ergonomic way to run a bounded browser automation action between those lifecycle calls. Today the built-in capture flows assume a visible browser and manual done confirmation.

M2 composes the M1 lifecycle with optional headless/browserless automation so a single tool call can run:

```text
start recorders -> run automation -> wait for completion/idle/timeout -> stop/finalize
```

## SPEC

Add bounded automation support on top of the M1 capture lifecycle.

Scope:

- Add automation execution options to a new composed tool, likely `api_audit_run_automated_capture(...)`:

```json
{
  "headless": true,
  "openBrowser": false,
  "stopOnNetworkIdleMs": 5000,
  "maxDurationMs": 120000,
  "automationScript": ".pi-api-audit-runs/deposit-probe.mjs"
}
```

- The composed run should:
  1. resolve the same scenario/profile/target inputs as M1,
  2. start a capture session,
  3. run an automation mode,
  4. stop/finalize the session in `finally`,
  5. return the same final run summary as `api_audit_stop_capture` plus automation status.
- Supported automation modes:
  - `openBrowser: false` and no `automationScript`: start and immediately stop is not useful; reject with a clear error unless a future explicit wait mode is added.
  - `automationScript`: run a workspace-local script after recorders are ready.
  - Optional built-in browser navigation can be added only if it stays small and deterministic; otherwise defer to scripts.
- `automationScript` behavior:
  - path resolves under workspace root when relative,
  - script must already exist,
  - run with Node using `pi.exec` or a testable process wrapper,
  - pass metadata through environment variables and/or a JSON file path, not raw payloads.
- Suggested automation metadata:

```json
{
  "captureSessionId": "capture-...",
  "scenarioId": "...",
  "profileName": "...",
  "artifactDir": "...",
  "targets": [
    {
      "targetId": "old",
      "variant": "old",
      "frontendUrl": "http://localhost:8080",
      "pagePath": "/account/activity",
      "proxyUrl": "http://127.0.0.1:18080",
      "runDir": "..."
    }
  ]
}
```

- `headless` should be available to scripts through metadata/env. If built-in browser automation is added, it must pass `headless` into Playwright `chromium.launch({ headless })`.
- `maxDurationMs` must cap the full automation window and trigger cleanup.
- `stopOnNetworkIdleMs` may be implemented by either:
  - observing proxy exchange timestamps in the capture session, or
  - deferring until a later milestone if script completion plus max timeout is sufficient for M2.

Non-goals:

- No arbitrary package asset script execution.
- No automatic app config rewrites.
- No state-changing scenario support beyond existing read-only scenario type.
- No storing browser secrets/cookies in artifacts.
- No parity judgment or scenario SOT mutation.

Expected files:

- `packages/pi-extension-api-behavior-audit/src/core/capture-automation.ts`
- `packages/pi-extension-api-behavior-audit/src/core/capture-automation.test.ts`
- M1 lifecycle files as needed for composed APIs
- `packages/pi-extension-api-behavior-audit/src/tools/tool-types.ts`
- `packages/pi-extension-api-behavior-audit/src/tools/index.ts`
- `packages/pi-extension-api-behavior-audit/README.md`

## Design notes

### Prefer script hook over overfitting browser flows

The extension should not try to encode every product-specific Playwright action. The reusable primitive is recorder lifecycle plus a metadata contract that lets the agent write and run focused scripts.

### Timeout and cleanup discipline

All automation paths must stop recorders in `finally`. If the script fails or times out, the tool should still finalize manifests and return paths/counts with an error/warning summary.

### Network idle semantics

`stopOnNetworkIdleMs` is useful but can be subtle because the recorder currently increments counts without exposing last-exchange timestamps. If implementing it requires recorder contract changes, keep the change minimal and testable. It is acceptable to land script completion + `maxDurationMs` first inside M2 and document network-idle as pending if necessary.

### Safety

Automation scripts can perform real browser actions. For v0.2.0, limit automated capture to read-only scenarios. If a scenario dictionary later supports write/destructive scenario types, those must remain blocked from no-HITL automation until an explicit approval design exists.

## AC

- `api_audit_run_automated_capture` can run an existing workspace `.mjs` script after recorders start and then automatically stop/finalize recorders.
- The script receives enough metadata to navigate target frontend URLs and know recorder proxy URLs/run dirs.
- `maxDurationMs` stops automation and finalizes recorders when the script hangs.
- Script failure still stops/finalizes recorders and returns artifact paths plus a clear automation error.
- `openBrowser: false` prevents built-in browser launch.
- `headless` is propagated to automation metadata and used by any built-in Playwright launch path.
- Tests cover success, script failure, timeout, and cleanup in `finally`.

Verification:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Manual smoke after implementation:

1. Create a small workspace-local `.mjs` script that reads automation metadata and sends one request through each proxy URL.
2. Run `api_audit_run_automated_capture` with `automationScript`, `openBrowser: false`, and a short `maxDurationMs`.
3. Validate returned runs with `api_audit_validate_run`.

## Status tracking

At start:

- Mark `v0.2.0 M2` as `In progress` in `versions/0.2.0/milestones.md`.
- Append a start entry to `versions/0.2.0/log.md`.

At completion:

- Run the verification commands above.
- Mark `v0.2.0 M2` as `Done`.
- Add completion notes here.
- Append completion notes with verification evidence to `versions/0.2.0/log.md`.

## Completion notes

Implemented a bounded script automation runner on top of the M1 capture lifecycle. Added `runAutomatedCapture` and `api_audit_run_automated_capture`, which resolve a target-based capture plan, start recorders, write automation metadata under `<artifactDir>/automation/<captureSessionId>.metadata.json`, run a workspace-local Node script, and stop/finalize recorders in cleanup paths.

Supported options:

- `automationScript` — required in M2; receives metadata path as first CLI arg and `API_AUDIT_AUTOMATION_METADATA_PATH`.
- `headless` — included in metadata and `API_AUDIT_HEADLESS` for script use.
- `openBrowser` — M2 supports `automationScript` with `openBrowser: false`; built-in browser automation remains unimplemented.
- `maxDurationMs` — caps automation and triggers timeout cleanup.
- `stopOnNetworkIdleMs` — preserved in metadata for scripts, but internal recorder idle detection is deferred.

Tests cover success, script failure, timeout, missing script rejection, tool registration/execution, metadata handoff, and guaranteed stop/finalize behavior.

Added `api_audit_review_capture` as an agent-facing review helper. It can queue supported slash-command review steps (`/api-discovery-analyze`, `/api-discovery-suggest`, `/api-discovery-validate-suggestion`) via pi follow-up messages and includes local review viewer guidance for `.pi-api-audit-runs/review.html`. The viewer build command uses `python3`, the package's absolute bundled `tools/build-viewer.py` path, and the workspace SOT path (`--sot .pi-api-audit-runs/scenarios.local.json`) so it works from target workspaces.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Additional smoke verified a real workspace `.mjs` automation script with a temporary local upstream server: automated capture started old/new recorders, script sent one request through each proxy URL, capture stopped/finalized, and both returned run dirs validated with one exchange each. Smoke result: `capture-auto-smoke`, automation status `succeeded`, stdout `probed 2 targets, headless=true`.
