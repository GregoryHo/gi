# v0.3.0 M3 — Original task preview cleanup

## Status

Done.

## SPEC

Preserve and display the user's original delegated task separately from profile/system-prompt-expanded worker prompts.

Problem:

v0.2.0 status/history/widget surfaces often show previews such as `System prompt: You are a review worker...`, which hides the actual user task and makes worker cards difficult to scan.

Scope:

- Add an explicit original task preview field to worker request/run/result/history data where needed.
- Keep resolved task/prompt behavior unchanged for worker process execution.
- Update compact status/history/widget summaries to prefer the original user task preview.
- Preserve backward compatibility for old history entries that only have `taskPreview`.

Candidate field names:

- `originalTaskPreview`
- `resolvedTaskPreview` only if needed internally; avoid exposing it by default.

Surfaces to evaluate/update:

- `WorkerRequest` / `ResolvedWorkerRequest`
- `WorkerRun`
- `WorkerResult`
- `WorkerRunHistoryEntry`
- `workerResultFromRun`
- `workerRunSummary`
- `formatWorkerRunLines`
- `formatWorkerHistoryEntryLines`
- widget rendering

Non-goals:

- No profile prompt redesign.
- No change to what is sent to worker CLIs.
- No UI redesign beyond preview content fixes.

## AC

- Profile-backed worker runs execute with the same resolved prompt as before.
- Status/history/tool/widget summaries display the user's original task preview when available.
- Backward-compatible history entries without original task metadata still render safely.
- Tests cover profile runs where resolved task begins with `System prompt:` but displayed preview uses the original task.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual UI smoke should include a reviewer/verifier/profile-backed run and confirm the widget/status no longer foregrounds the injected system prompt.

## Status tracking

At start:

- Mark `v0.3.0 M3` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M3` as `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.3.0/log.md`.

## Completion notes

Implemented original task preview metadata for new runs:

- `AgentWorkerService.start()` now passes a preview of the user's original task separately from the resolved worker prompt.
- Profile-backed workers still execute the profile/system-prompt-expanded task.
- `WorkerRun`, `WorkerRunHistoryEntry`, and `WorkerResult` can carry `originalTaskPreview`.
- `taskPreview` for newly service-started runs now reflects the user's original delegated task, so status/history/widget surfaces no longer foreground `System prompt: ...` for new profile runs.
- Existing historical runs from before v0.3.0 may still show their old stored task preview because raw logs are not reparsed or migrated.
