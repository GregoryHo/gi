# API behavior audit v0.2.0 planning index

## Status

- Version: `0.2.0`
- Package: `packages/pi-extension-api-behavior-audit`
- Status: Released / sealed local package release
- Branch: `feature/api-behavior-audit-0.2.0-programmatic-capture`

## Theme

Programmatic capture lifecycle for agent-operated audits.

v0.2.0 removes the current hard dependency on human-in-the-loop capture completion for safe, read-only audit flows. The extension should let a pi agent start recorders, run or delegate deterministic browser automation, and stop/finalize capture artifacts without waiting for a human to press done.

The main product change is a first-class capture session lifecycle:

```text
start capture -> operate target apps via script/agent -> stop/finalize capture
```

Manual guided capture remains supported, but it is no longer the only runnable path.

## Problem

Current `run_*capture` tools bundle several concerns into one HITL flow:

- resolve scenario/profile/targets,
- start upstream recording proxies,
- open Playwright browsers,
- ask the user to log in / operate / confirm done,
- stop recorders in `finally`,
- return completed artifact paths.

That shape is safe for manual testing, but blocks the intended workflow where a pi agent assists a human by programmatically controlling the audit lifecycle. The missing abstraction is a reusable live capture session handle that survives across separate tool calls in the same pi extension runtime.

## Desired capabilities

### 1. Start-only recorder lifecycle

Add a tool equivalent to:

```text
api_audit_start_capture(...)
```

It starts selected upstream recorders only. It does not open a browser and does not wait for manual completion.

Minimum old/new-compatible output should include:

```json
{
  "captureSessionId": "capture-...",
  "oldRunDir": "...",
  "newRunDir": "...",
  "oldProxyUrl": "http://127.0.0.1:18080",
  "newProxyUrl": "http://127.0.0.1:18081"
}
```

The canonical shape should also support target-based/N-target captures with a `targets[]` array.

### 2. Stop/finalize lifecycle

Add a tool equivalent to:

```text
api_audit_stop_capture({ captureSessionId: "..." })
```

It stops live recorders, flushes exchanges, writes final manifest state, updates `finishedAt`, reports `exchangeCount`, and returns run paths/details.

### 3. Headless/no-browser operation

Add capture execution options such as:

```json
{
  "headless": true,
  "openBrowser": false
}
```

`openBrowser: false` means the tool only manages recorders. The agent can run an external Playwright script with normal coding tools or a dedicated automation hook.

### 4. Bounded auto-stop behavior

Add non-HITL stopping options such as:

```json
{
  "stopOnNetworkIdleMs": 5000,
  "maxDurationMs": 120000
}
```

These are safety bounds, not parity judgments. `maxDurationMs` must always cap autonomous capture duration when automation is running.

### 5. Automation hook

Add an optional automation runner:

```json
{
  "automationScript": ".pi-api-audit-runs/deposit-probe.mjs"
}
```

After recorders are listening, the extension runs the workspace script with recorder/session metadata available, waits for completion or timeout, then stops/finalizes capture automatically.

## Milestones

- `M1 — Programmatic capture lifecycle` — `m1-programmatic-capture-lifecycle.md`
- `M2 — Headless automation runner` — `m2-headless-automation-runner.md`
- `M3 — v0.2.0 release prep` — `m3-release-prep.md`

See `milestones.md` for the active tracker.

## Design direction

### Capture session model

Introduce a runtime capture session registry in the extension process. A capture session owns:

- `captureSessionId`,
- resolved workspace/artifact path context,
- scenario/profile/target plan snapshot,
- live recorder handles,
- run ids/directories/proxy URLs,
- created/start timestamps,
- stopped/finalized status,
- warning/error summaries.

The session registry is intentionally in-memory for live process handles. Artifact manifests remain the durable evidence. On extension shutdown/reload, live sessions must be best-effort stopped.

### Target-based first, old/new-compatible output

Implementation should reuse the target-based capture plan resolver where possible, because v0.1.x already moved beyond hard-coded old/new pairs. For compatibility and ergonomics, if selected targets contain `old` and `new`, the result may expose `oldRunDir`, `newRunDir`, `oldProxyUrl`, and `newProxyUrl` as aliases.

### Tool boundaries

Expected new tools:

- `api_audit_start_capture`
- `api_audit_stop_capture`
- `api_audit_list_active_captures`
- `api_audit_run_automated_capture` or an extended run tool that composes start + automation + stop

Existing manual tools should remain available and keep their explicit confirmation behavior.

### Safety defaults

- Start-only capture must not modify app config.
- Default URLs remain local-only unless `allowHosts` explicitly allows non-local upstream hosts.
- Autonomous automation is limited to scenarios marked read-only unless a future milestone defines explicit state-changing approval semantics.
- Automation scripts must resolve under the workspace root, must be existing files, and must not be package assets.
- `maxDurationMs` is required or defaulted for automation runs.
- Tool output must summarize paths/counts, not raw captured payloads.

## Non-goals

- No automatic scenario dictionary SOT mutation.
- No new parity/pass-fail judgment.
- No production/staging capture defaults.
- No durable cross-process stop of recorders after the pi process has exited; live handles are in-process only.
- No automatic app config rewrites in v0.2.0.
