# M2 — Retention metadata and explicit cleanup commands

## Status

Done.

## SPEC

Add safe artifact retention tooling so long-running Agent Lens usage does not accumulate unmanaged JSONL/HTML files.

### Scope

- Extend trace discovery summaries with file size and modified time.
- Add cleanup planning with dry-run output.
- Add explicit cleanup execution command requiring clear intent.
- Consume retention config from M1 if available.
- Keep cleanup local to Agent Lens artifact files only.

### Candidate commands

Exact syntax may change before implementation, but likely commands:

```text
/agent-lens clean --dry-run
/agent-lens clean --confirm
```

Possible status/listing enhancement:

```text
/agent-lens traces
```

should include size/age metadata after M2.

### Expected files

Likely package files:

- `src/cleanup.ts`
- `src/cleanup.test.ts`
- `src/traces.ts`
- `src/traces.test.ts`
- `src/commands.ts`
- `src/commands.test.ts`
- `src/index.ts`
- README/CHANGELOG updates

Likely docs files:

- `versions/0.2.0/milestones.md`
- `versions/0.2.0/log.md`
- this plan

### Safety notes

Cleanup is a write/destructive operation and must be explicit. It must not delete:

- files outside the configured Agent Lens artifact root;
- non-Agent-Lens files;
- currently active trace file;
- current `latest.html` if it points at the active report, unless explicitly safe to regenerate.

Prefer dry-run first and require `--confirm` for actual deletion.

## Non-goals

- Automatic cleanup without user action.
- Cross-project/global cleanup.
- Deleting raw pi session files.
- Cleanup of unrelated `.pi-agent-lens` files that are not recognized Agent Lens artifacts.

## Acceptance criteria

- `/agent-lens traces` includes size and modified time/age metadata.
- Cleanup dry-run lists exactly what would be deleted and why.
- Cleanup confirm deletes only eligible Agent Lens artifacts.
- Active trace is never selected for deletion.
- Tests cover dry-run, confirm, malformed files, active trace protection, and artifact root boundary safety.

## Verification

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

Manual smoke before Done:

1. Create several test traces/reports.
2. Run dry-run and inspect candidate list.
3. Run confirm and verify only eligible artifacts are deleted.
4. Confirm active trace remains intact.

## Completion notes

Completed on 2026-06-07.

Implemented:

- Trace discovery summaries now include file size and modified time.
- `/agent-lens clean --dry-run` reports files selected by configured retention without deleting.
- `/agent-lens clean --confirm` deletes selected Agent Lens artifacts.
- Cleanup supports `maxTraceFiles` and `maxAgeDays` retention settings from M1 config.
- Cleanup selects adjacent per-trace HTML reports with deleted JSONL traces.
- Active trace and its active report are protected from deletion.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-agent-lens
npm run typecheck --workspace @gregho/pi-extension-agent-lens
npm run pack:dry-run --workspace @gregho/pi-extension-agent-lens
npm run typecheck
```

