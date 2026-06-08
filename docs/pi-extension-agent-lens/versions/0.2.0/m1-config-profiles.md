# M1 — Config profiles and status visibility

## Status

Done.

## SPEC

Add a small configuration layer so Agent Lens behavior can be adjusted without code changes while preserving 0.1.0 safe defaults.

### Scope

- Define package-local config loading behavior.
- Support safe operational settings:
  - artifact root override;
  - live report refresh interval;
  - report/latest alias behavior if needed;
  - retention policy values for M2 to consume;
  - capture profile name, initially safe/redacted only.
- Surface active config in `/agent-lens` status.
- Keep invalid config non-fatal: report a status warning and fall back to defaults.

### Expected files

Likely package files:

- `src/config.ts`
- `src/config.test.ts`
- `src/index.ts`
- `src/commands.ts`
- `src/commands.test.ts`
- README/CHANGELOG updates

Likely docs files:

- `versions/0.2.0/milestones.md`
- `versions/0.2.0/log.md`
- this plan

### Design notes

Initial config should be intentionally small. Prefer project-local config first, such as:

```text
.pi-agent-lens/config.json
```

or another clearly documented local path. The exact path should be finalized before implementation.

Suggested defaults:

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

Raw capture should not be implemented in this milestone. If a config field names capture profile, unsupported unsafe values should produce a warning and remain redacted.

## Non-goals

- Raw prompt/provider payload capture.
- Runtime config editing commands.
- Global/user-level config precedence unless explicitly decided before implementation.
- Schema migration system.
- Any behavioral mutation of pi agent runs.

## Acceptance criteria

- Agent Lens runs with no config file and preserves 0.1.0 behavior.
- A valid config can change live report refresh interval and/or artifact root.
- Invalid config falls back to defaults and appears in `/agent-lens` status as a warning/error.
- `/agent-lens` status shows config source and active capture profile.
- Tests cover defaults, valid config, invalid config fallback, and status formatting.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke before Done:

1. Run with no config and confirm current behavior remains unchanged.
2. Add local config changing refresh interval and confirm generated HTML meta refresh changes.
3. Add malformed config and confirm agent continues while `/agent-lens` shows warning.

## Completion notes

Completed on 2026-06-07.

Implemented:

- Project-local config loading from `.pi-agent-lens/config.json`.
- Safe defaults when no config exists.
- Configurable artifact root and live report refresh interval.
- Retention config groundwork (`maxTraceFiles`, `maxAgeDays`) for M2.
- Redacted-only capture profile validation; unsupported profiles fall back to `redacted` with a warning.
- `/agent-lens` status visibility for config source, capture profile, and config warning.
- Invalid/malformed config fallback with warning status.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

