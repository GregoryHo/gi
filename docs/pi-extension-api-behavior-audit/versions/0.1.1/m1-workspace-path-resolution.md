# v0.1.1 M1 — Workspace path resolution

## Status

Done.

## Problem

v0.1.0 uses relative defaults such as `.pi-api-audit-runs` across tools, commands, profile config, dashboard, capture, discovery, analysis, and suggestion helpers. Those paths can resolve against the extension package/project process directory instead of the user's active pi workspace.

This makes the extension non-portable: using the package from another project may still read/write artifacts and profiles in the extension development repo.

## SPEC

Add a small workspace path foundation and apply it to all API-audit runtime paths.

Scope:

- Add a path resolver module, likely `src/workspace-paths.ts`, that:
  - accepts pi `ctx.cwd` as the runtime cwd,
  - discovers Git root from that cwd when possible,
  - falls back to normalized cwd when Git root discovery fails,
  - resolves absolute paths unchanged,
  - resolves API-audit relative paths under the workspace root,
  - exposes resolved `workspaceRoot`, original `cwd`, optional `gitRoot`, and resolved path strings for display/tests.
- Update command handlers to resolve path-like parsed args before calling runtime helpers:
  - `artifactDir`, `scenarioDictionaryPath`, `manifestPath`, `comparisonPath`, `analysisPath`, `suggestionPath`, and run directories where applicable.
- Update registered pi tools to use tool execution `ctx.cwd` instead of relying on process cwd:
  - profile show/save/clear,
  - scenario listing with custom dictionary path,
  - run validation,
  - account-activity and generic upstream prepare/run,
  - target list/prepare/run,
  - scenario discovery prepare/run.
- Keep package assets package-relative:
  - JSON schemas,
  - package examples.
- Do not use package example/default scenarios as runtime fallback; scenario context is workspace/repo-owned.
- Show resolved workspace/path context in user-visible preparation/status output where it prevents accidental writes.
- Preserve absolute path behavior for advanced/manual workflows.

Non-goals:

- No artifact schema changes.
- No automatic moving, copying, or migration of existing artifacts/profiles.
- No change to Layer A/B capture behavior or evidence interpretation.
- No scenario dictionary SOT mutation behavior changes.
- No new global config location.

Expected files:

- `packages/pi-extension-api-behavior-audit/src/workspace-paths.ts`
- `packages/pi-extension-api-behavior-audit/src/workspace-paths.test.ts`
- Targeted updates in existing modules that currently default to `.pi-api-audit-runs` or accept path-like params:
  - `src/tools.ts`
  - `src/commands.ts`
  - `src/config.ts`
  - `src/proxy-config.ts`
  - `src/environment-profiles.ts`
  - `src/target-capture.ts`
  - `src/discovery.ts`
  - `src/dashboard.ts`
  - `src/comparison-analysis.ts`
  - `src/scenario-suggestion.ts`
  - `src/scenarios.ts` / `src/scenario-dictionary.ts` only where custom local paths are loaded
- Existing focused tests updated where expected relative paths become absolute workspace paths.
- README/help text updated only if command examples or default path descriptions become misleading.

## Design notes

### Default artifact directory

`DEFAULT_ARTIFACT_DIR` may remain the label `.pi-api-audit-runs`, but runtime code should convert it to:

```text
<workspaceRoot>/.pi-api-audit-runs
```

where `workspaceRoot = gitRoot(ctx.cwd) ?? ctx.cwd`.

### Relative local paths

Resolve these as workspace-root-relative when not absolute:

```text
.pi-api-audit-runs
custom-runs
scenarios/local.scenarios.json
.pi-api-audit-runs/comparisons/<id>.json
.pi-api-audit-runs/analysis/<id>.json
.pi-api-audit-runs/candidates/<id>.json
```

This favors stable workspace behavior over subdirectory-dependent behavior.

### Git root discovery

Use a testable helper. Implementation may call Git, but failures must be non-fatal:

- `git -C <ctx.cwd> rev-parse --show-toplevel` succeeds → use that path.
- Git command missing, cwd outside a repo, or command failure → fallback to normalized `ctx.cwd`.

### Testing strategy

Prefer deterministic unit tests with injectable Git-root discovery over shelling out in most tests. Add one integration-style test only if useful and reliable.

Key test cases:

- Git root is preferred over cwd subdirectory.
- Fallback cwd is used outside Git.
- Absolute user paths are unchanged.
- Relative artifact and custom dictionary paths resolve under workspace root.
- Tool executors receive/pass a workspace context from registered tool `ctx.cwd`.
- Command handlers do not rely on process cwd for default artifact/profile paths.

## AC

- Running `/api-audit profile show` from a target project reads:

```text
<target-git-root>/.pi-api-audit-runs/config.local.json
```

not this extension repo's `.pi-api-audit-runs/config.local.json`.

- Running `api_audit_prepare_target_capture` or `/api-audit capture ...` without `artifactDir` reports a resolved artifact dir under the target workspace root.
- Custom relative paths such as `--scenario-dictionary scenarios/local.scenarios.json` resolve under the target workspace root.
- Absolute paths retain current behavior.
- Package scenarios are not used as runtime fallback when no workspace/custom dictionary is provided.
- Tests prove the path behavior without requiring real API captures.

Verification:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Manual smoke after implementation:

```bash
# From a separate target git repo, not this monorepo:
pi -e /absolute/path/to/packages/pi-extension-api-behavior-audit --no-session -p "/api-audit profile show"
```

Expected output should mention the target repo's `.pi-api-audit-runs/config.local.json`.

## Status tracking

At start:

- Mark `v0.1.1 M1` as `In progress` in `versions/0.1.1/milestones.md`.
- Append a start entry to `versions/0.1.1/log.md`.

At completion:

- Run the verification commands above.
- Mark `v0.1.1 M1` as `Done`.
- Add completion notes here.
- Append completion notes with verification evidence to `versions/0.1.1/log.md`.

## Completion notes

Implemented a small workspace path resolver in `src/workspace-paths.ts` that accepts pi `ctx.cwd`, prefers Git root, and falls back to cwd. Registered pi tools and slash commands now resolve mutable local paths at the command/tool boundary, including default `artifactDir`, workspace scenario dictionary path, profile config, custom scenario/manifest paths, run validation paths, comparison/analysis/suggestion paths, and proxy/capture artifact paths.

Package assets remain package-relative where appropriate, but package scenarios are examples only and are not used as runtime fallback. Target capture preparation now displays the resolved artifact directory, and README documents workspace-root-relative path defaults.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
