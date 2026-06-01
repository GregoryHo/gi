# v0.2.1 M1 — Persistent proxy/window lifecycle

## Status

In progress.

## SPEC

Separate persistent proxy process lifecycle from recording artifact window lifecycle.

Add agent-facing tools:

- `api_audit_start_proxy_session`
- `api_audit_start_recording_window`
- `api_audit_stop_recording_window`
- `api_audit_stop_proxy_session`
- `api_audit_list_proxy_sessions`

Behavior:

- Starting a proxy session opens target recorder sockets in paused passthrough mode.
- Starting a recording window creates fresh run dirs for each target and begins recording.
- Stopping a recording window finalizes manifests/exchange counts but keeps proxy sockets listening.
- Stopping a proxy session closes sockets and also finalizes any active window.
- Existing v0.2.0 `api_audit_start_capture` / `api_audit_stop_capture` remain as compatibility wrappers for one-shot capture.

## AC

- A proxy session can stay active after a recording window is stopped.
- A second recording window can be started on the same proxy session with new run ids.
- Overlapping recording windows on one proxy session are rejected.
- Shutdown cleanup closes active persistent proxy sessions.
- Tools are exposed to pi agents and require no HITL browser/manual-done flow.

## Verification

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit -- src/core/proxy-session-lifecycle.test.ts
npm test --workspace @gregho/pi-extension-api-behavior-audit -- src/tools/index.test.ts
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
```

## Notes

Initial implementation reuses the existing recording proxy's paused passthrough and `beginRecordingWindow()` support from scenario discovery.
