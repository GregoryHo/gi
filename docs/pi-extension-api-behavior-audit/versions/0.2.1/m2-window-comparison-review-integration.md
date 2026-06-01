# v0.2.1 M2 — Window comparison/review integration

## Status

Done.

## SPEC

Connect persistent recording windows to the existing comparison/review artifact pipeline.

When `api_audit_stop_recording_window` finalizes a window, it should write a comparison artifact:

```text
<artifactDir>/comparisons/<comparisonRunId>.json
```

The artifact uses the existing `api-behavior-comparison-run` v1 format and includes each window target's run id, manifest path, exchanges path, side, target id, and variant.

## AC

- Stopping a recording window writes a schema-valid comparison artifact.
- The stop result returns `comparisonPath`.
- Tool output displays the comparison artifact path so agents can queue `/api-discovery-analyze` through `api_audit_review_capture`.
- Existing local viewer/review flow can consume the comparison artifact once the scenario dictionary SOT records reviewed evidence for that comparison.
- Proxy sockets remain alive after comparison artifact creation.

## Completion notes

Implemented comparison artifact creation in `ProxySessionRegistry.stopRecordingWindow()`. `RecordingWindowSummary` now includes `comparisonPath`, and `executeStopRecordingWindowTool` prints `Comparison artifact: ...` when present.

Focused verification passed:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit -- src/core/proxy-session-lifecycle.test.ts
npm test --workspace @gregho/pi-extension-api-behavior-audit -- src/tools/index.test.ts
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
```
