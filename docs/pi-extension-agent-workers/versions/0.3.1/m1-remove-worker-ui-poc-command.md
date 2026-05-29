# v0.3.1 M1 — Remove worker-ui-poc command, stale historical running display, and patch release

## Status

Done.

## SPEC

Remove the temporary Worker UI PoC command surface now that the accepted compact card widget direction has been implemented as the default `agent-workers` widget. Also fix stale historical active runs left behind by interrupted/reloaded sessions so history/widget displays do not show them as indefinitely running.

Scope:

- Remove `/worker-ui-poc` command registration from `src/commands.ts`.
- Remove `/worker-ui-poc` from help output and README command docs.
- Remove PoC-only parser/helper code, command tests, `src/ui-poc.ts`, and package file list entry.
- Add/adjust tests that assert the command is no longer exposed.
- Normalize historical active runs from the artifact index to stale failed history with `statusReason: stale_historical`.
- Update the `/agent-workers` command description to remove stale `M1 commands` wording.
- Bump package metadata to `0.3.1` and add changelog/release docs.

Non-goals:

- No production widget layout, refresh cadence, or config behavior changes beyond receiving normalized stale historical run status from history.
- No replacement cockpit/sidepanel command in this patch.
- No npm publish or git tag unless explicitly requested.
- No changes to historical v0.3.0 PoC planning docs beyond archiving/indexing v0.3.1.

## AC

- `/worker-ui-poc` is not registered by `registerAgentWorkerCommands`.
- `/agent-workers` help no longer lists `/worker-ui-poc`.
- README command list no longer documents `/worker-ui-poc`.
- `src/ui-poc.ts` is not present in the package `files` manifest.
- Historical active runs read from the artifact index are shown as `failed` with `statusReason: stale_historical` rather than `running`.
- The `/agent-workers` command description no longer mentions `M1 commands`.
- Package metadata reports version `0.3.1`.
- Full verification passes.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

The dry-run pack output should show `@gregho/pi-extension-agent-workers@0.3.1` and no `src/ui-poc.ts` entry.

## Status tracking

At start:

- Create `versions/0.3.1/` docs and mark M1 `In progress`.
- Append a start entry to `versions/0.3.1/log.md`.

At completion:

- Mark M1 `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.3.1/log.md` and root `log.md`.
- Update root `index.md`, `archive.md`, release policy, package README, and package changelog.

## Completion notes

Completed local patch prep for `@gregho/pi-extension-agent-workers@0.3.1`:

- Removed `/worker-ui-poc` from command registration and help output.
- Removed PoC-only command parser/helpers/tests and deleted `src/ui-poc.ts` from packaged source.
- Added tests asserting `/worker-ui-poc` is not listed or registered.
- Added stale historical active-run normalization in the artifact index so history/widget displays show interrupted/reloaded runs as `failed` with `statusReason: stale_historical` instead of indefinitely `running`.
- Updated the `/agent-workers` command description to remove stale `M1 commands` wording.
- Updated package version, README, changelog, root docs, archive, and release policy.
- Did not publish to npm or create a git tag.

Verification evidence:

- `npm test --workspace @gregho/pi-extension-agent-workers` — passed, 119 tests.
- `npm run typecheck --workspace @gregho/pi-extension-agent-workers` — passed.
- `npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers` — passed; reported `@gregho/pi-extension-agent-workers@0.3.1`, `gregho-pi-extension-agent-workers-0.3.1.tgz`, and no `src/ui-poc.ts` tarball entry.
- `npm run typecheck` — passed across workspaces.
- `pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"` — exited successfully.
