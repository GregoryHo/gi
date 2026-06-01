# v0.2.0 M1 — Programmatic capture lifecycle

## Status

Done.

## Problem

Current capture tools are shaped around manual completion. They start recorders, open browsers, prompt the user, and stop everything inside one tool call. That prevents an AI agent from using the recorder as a programmatic resource across multiple steps:

```text
start recorders -> run separate Playwright/script/tool actions -> stop/finalize recorders
```

M1 introduces a first-class live capture session lifecycle without changing artifact semantics or adding browser automation.

## SPEC

Add programmatic start/list/stop tooling for upstream recorder sessions.

Scope:

- Add a capture lifecycle module, likely `src/core/capture-lifecycle.ts`, that can:
  - create a unique `captureSessionId`,
  - resolve a target-based capture plan from existing profile/scenario inputs,
  - start selected recording proxies without opening any browser,
  - store live recorder handles in an in-memory session registry,
  - expose session summaries safe for LLM/tool output,
  - stop/finalize a session by id,
  - stop all live sessions on extension shutdown/reload best-effort.
- Add pi tools:
  - `api_audit_start_capture(...)`,
  - `api_audit_stop_capture({ captureSessionId })`,
  - `api_audit_list_active_captures(...)`.
- `api_audit_start_capture` inputs should be close to `api_audit_prepare_target_capture` / `api_audit_run_target_capture`:
  - `scenarioId`,
  - `artifactDir`,
  - `profileName`,
  - `scenarioDictionaryPath`,
  - `targetIds`,
  - `groupName`.
- `api_audit_start_capture` must start recorders only:
  - no browser launch,
  - no manual confirmation,
  - no app config mutation,
  - no scenario dictionary mutation.
- Return a compact session handle with target-based canonical data plus old/new aliases when applicable:

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
      "runId": "...",
      "runDir": "...",
      "proxyUrl": "http://127.0.0.1:18080",
      "manifestPath": "...",
      "exchangesPath": "..."
    }
  ],
  "oldRunDir": "...",
  "newRunDir": "...",
  "oldProxyUrl": "http://127.0.0.1:18080",
  "newProxyUrl": "http://127.0.0.1:18081"
}
```

- `api_audit_stop_capture` must:
  - look up the live session by `captureSessionId`,
  - stop each recorder,
  - rely on existing recording proxy finalization to write `finishedAt`, `recording`, and `exchangeCount`,
  - return final exchange counts, manifest/exchange paths, warnings for zero-exchange runs, and final status,
  - be idempotent enough that stopping an already stopped known session returns its final summary instead of leaking handles.
- `api_audit_list_active_captures` must return live non-stopped sessions with proxy URLs and run ids.
- Preserve existing manual run tools unchanged.

Non-goals:

- No automation script execution in M1.
- No headless browser implementation in M1.
- No network-idle auto-stop in M1.
- No persistent live-session recovery across pi process exits.
- No artifact schema version bump unless existing manifest fields cannot represent start/stop state.

Expected files:

- `packages/pi-extension-api-behavior-audit/src/core/capture-lifecycle.ts`
- `packages/pi-extension-api-behavior-audit/src/core/capture-lifecycle.test.ts`
- `packages/pi-extension-api-behavior-audit/src/tools/tool-types.ts`
- `packages/pi-extension-api-behavior-audit/src/tools/target-profile-executors.ts` or a new focused executor file
- `packages/pi-extension-api-behavior-audit/src/tools/index.ts`
- `packages/pi-extension-api-behavior-audit/src/index.ts` if extension shutdown cleanup needs registration there
- `packages/pi-extension-api-behavior-audit/README.md` for new tool examples if user-facing help changes

## Design notes

### Registry lifetime

The registry should live in extension runtime memory. It owns live Node HTTP server handles through the existing recording proxy handles. On `session_shutdown`, call a best-effort `stopAllActiveCaptures()` so recorders do not survive reload/exit.

A stopped session can remain summarized in memory for the current runtime so repeated stop calls or final agent reporting are deterministic.

### Reuse existing recorder contracts

Prefer reusing `resolveTargetCapturePlan` and `startTargetRecordingProxy`. Avoid duplicating target validation, local URL checks, allow-host behavior, and manifest metadata creation.

### Workspace path discipline

Registered tools must continue resolving path-like params at the tool boundary using `ctx.cwd`, as v0.1.1 established.

### Compatibility aliases

The canonical result is target-based. Old/new aliases are convenience fields derived from target id, side, or variant. They should not become the internal model.

## AC

- An agent can call `api_audit_start_capture` for a configured read-only scenario and receive proxy URLs/run dirs without any browser opening or UI confirmation.
- While the session is live, `api_audit_list_active_captures` shows the session and target recorder URLs.
- After traffic is sent through the recorder proxies, `api_audit_stop_capture` stops all recorders and returns final manifest paths and exchange counts.
- Stopped manifests include `finishedAt` and final `exchangeCount` values consistent with `exchanges.ndjson`.
- Calling stop twice for the same known session does not throw because handles were already closed; it returns final stopped summary.
- Existing manual tools keep their current confirmation behavior.
- Tests prove start-only does not call browser/page-action dependencies.

Verification:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Manual smoke after implementation:

1. Start a local test upstream server.
2. Call `api_audit_start_capture` for old/new or a target group.
3. Send `curl` requests through each returned proxy URL.
4. Call `api_audit_stop_capture`.
5. Validate each returned run with `api_audit_validate_run`.

## Status tracking

At start:

- Mark `v0.2.0 M1` as `In progress` in `versions/0.2.0/milestones.md`.
- Append a start entry to `versions/0.2.0/log.md`.

At completion:

- Run the verification commands above.
- Mark `v0.2.0 M1` as `Done`.
- Add completion notes here.
- Append completion notes with verification evidence to `versions/0.2.0/log.md`.

## Completion notes

Implemented a recorder-only programmatic capture lifecycle for target-based capture plans. Added `CaptureSessionRegistry` with start/list/stop/stop-all behavior, old/new compatibility aliases, zero-exchange warnings, idempotent stopped summaries, and best-effort shutdown cleanup through the extension `session_shutdown` hook.

Registered new natural-language tools:

- `api_audit_start_capture`
- `api_audit_stop_capture`
- `api_audit_list_active_captures`

The start tool resolves the same workspace/profile/scenario/target inputs as target capture, starts upstream recorders only, and does not open browsers, wait for manual done, modify app config, or mutate scenario SOT. The stop tool finalizes manifests through existing recording proxy handles and reports final exchange counts and artifact paths.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Additional smoke verified real recording proxies with a temporary local upstream server: start capture, send one request through old/new proxy URLs, stop capture, and validate both returned run dirs with schema-backed loaders. Smoke result: `capture-smoke` recorded one exchange for `old` and one exchange for `new`.
