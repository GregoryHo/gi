# Agent Lens

Agent Lens is a pi extension package for observing how pi agent runs are composed and executed.

Planned focus areas:

- agent run and turn timelines
- context composition snapshots
- provider payload inspection with safe redaction
- tool call/result flow
- memory compression inputs and resulting summaries
- HTML reports for learning and debugging agent behavior

## Status

0.1.0 implemented read-only JSONL lifecycle traces with redacted summaries and local live-updating HTML reports. 0.2.0 added project-local configuration, retention cleanup, and a multi-trace index. 0.3.0 added observable-log report navigation, trace summary cards, and a session/compaction explorer. 0.4.0 adds a metadata-only memory-flow explorer with static links between compaction flow cards and observable-log records.

## Commands

```text
/agent-lens
```

Shows the active trace file path, raw-capture status, live-report status, latest report path, config source, capture profile, config warnings, and any last Agent Lens write error.

```text
/agent-lens report
```

Writes a local HTML report next to the active JSONL trace and updates `.pi-agent-lens/latest.html`. The command notification shows both paths. After the command runs, the report is refreshed on later trace events and the HTML auto-refreshes in the browser. The report shows its source trace path and generation time, trace summary cards, a memory-flow explorer with static links to related observable-log records, plus an observable log with category chips, local filter/search controls, backlinks, highlights, and expandable record details.

```text
/agent-lens traces
```

Lists local JSONL traces with record counts, file size, modified time, and last observed event to help disambiguate multiple pi sessions. The active trace for the current extension instance is marked with `*`.

```text
/agent-lens index
```

Writes `.pi-agent-lens/index.html`, a multi-trace index with trace metadata, active marker, and links to generated per-trace reports.

```text
/agent-lens clean --dry-run
```

Shows which Agent Lens trace/report files would be deleted by the configured retention policy. Does not delete files.

```text
/agent-lens clean --confirm
```

Deletes only the files selected by the configured retention policy. The active trace and its active report are protected.

## Configuration

Agent Lens reads optional project-local config from:

```text
.pi-agent-lens/config.json
```

Supported config fields:

```json
{
  "artifactRoot": ".pi-agent-lens",
  "liveReportRefreshSeconds": 2,
  "captureProfile": "redacted",
  "retention": {
    "maxTraceFiles": null,
    "maxAgeDays": null
  }
}
```

Only the `redacted` capture profile is supported. Unsupported capture profiles fall back to `redacted` and appear as `/agent-lens` status warnings.

Retention cleanup is opt-in via explicit commands. If `maxTraceFiles` and `maxAgeDays` are both `null`, cleanup reports that nothing is selected.

## Development

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
```

## Safety default

Agent Lens is read-only with respect to pi agent behavior. It writes local trace artifacts to `.pi-agent-lens/` by default, or to a configured local artifact root. Raw message and provider payload capture is not enabled by default.
