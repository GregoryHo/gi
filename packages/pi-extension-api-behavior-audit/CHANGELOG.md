# Changelog

## Unreleased

### Changed

- Clarified the local `review.html` viewer as candidate endpoint curation rather than old/new behavior diff.
- `review.html` now includes all suggestion artifacts under `.pi-api-audit-runs/candidates/`, even before matching comparison evidence is accepted into the scenario dictionary SOT.

## 0.2.2 - 2026-06-01

### Fixed

- Added path-based passthrough routes for the Node recording proxy so frontend/static paths such as `/includes/js/...` can be forwarded to their real frontend service instead of the API upstream.
- Target profile v2 entries can now declare `passthroughRoutes` for local or explicitly allowlisted auxiliary frontend/static services; passthrough responses are not recorded as upstream API exchanges.

### Notes

- This patch supports local legacy server-side services where routing the whole service through the recorder caused static assets to return API 404/text responses.
- No npm publish or git tag was created by this local release prep.

## 0.2.1 - 2026-06-01

### Added

- Persistent proxy/window lifecycle tools so agents can keep recorder proxy sockets alive while starting and stopping clean recording windows independently.
- Recording window finalization now writes comparison artifacts and returns `comparisonPath` for analyze/suggest/review follow-up.

### Notes

- Existing one-shot capture tools remain available for compatibility.
- No npm publish or git tag was created by this local release prep.

## 0.2.0 - 2026-06-01

### Added

- Programmatic capture lifecycle tools: `api_audit_start_capture`, `api_audit_stop_capture`, and `api_audit_list_active_captures`.
- In-memory capture session registry for recorder-only start/list/stop workflows with old/new compatibility aliases and final exchange summaries.
- Best-effort shutdown cleanup for active programmatic capture sessions.
- Bounded automation runner tool: `api_audit_run_automated_capture` starts recorders, writes metadata, runs a workspace-local `automationScript`, and stops/finalizes artifacts automatically.
- Automation metadata handoff for capture session id, target frontend/page paths, recorder proxy URLs, run dirs, `headless`, and timeout hints.
- Review helper tool: `api_audit_review_capture` can queue supported `/api-discovery-*` slash-command review steps and points users to the local `review.html` viewer using `python3`, the package's absolute bundled viewer-builder path, and the workspace scenario dictionary SOT path.

### Changed

- README now documents programmatic capture and automation-script workflows.
- Package file list now includes the new capture lifecycle and automation runtime modules.

### Notes

- M2 supports `automationScript` with `openBrowser: false`; built-in browser automation remains deferred.
- `stopOnNetworkIdleMs` is passed through automation metadata for scripts, but internal recorder-idle detection is deferred.
- No npm publish or git tag was created by this local release prep.

## 0.1.1 - 2026-05-29

### Fixed

- Resolve mutable API audit paths from the active pi workspace (`ctx.cwd` with Git-root preference) instead of the installed extension package directory.
- Remove package scenario fallback from runtime flows; scenario dictionaries are workspace/repo-owned and package scenarios are examples only.
- Keep bundled schemas package-relative while making artifact/profile/scenario/custom path overrides workspace-root-relative.

## 0.1.0 - 2026-05-26

### Added

- Initial package scaffold for the API behavior audit pi extension.
- Layer-neutral API exchange and capture manifest types.
- Default redaction helpers for headers, query parameters, and JSON-like bodies.
- Run artifact helpers for `manifest.json` and `exchanges.ndjson`.
- M2 `/api-audit account-activity` command for local Layer A browser-visible capture POC.
- Built-in scenario manifest and optional `--manifest` loading for account-activity capture.
- M4 local Layer B recording proxy spike via `/api-audit proxy`.
- Redaction for sensitive query parameters embedded inside URL-like and JSON-like body strings.
- M5 `/api-audit account-activity-upstream` command for Layer B account-activity integrated capture.
- Artifact schema and scenario dictionary documentation plus account-activity scenario example.
- Versioned JSON Schema files, default scenario dictionary SOT, and deterministic runtime loaders/validators.
- Natural-language-callable pi tools for scenario listing, run validation, account-activity capture preparation, and account-activity upstream capture.
- Generic scenario-id-driven upstream capture preparation and run tools.
- Gitignored local environment profiles with shared command/tool support.
- Initial target-based capture plan resolver and target list/prepare tools.
- Widget-friendly `/api-audit setup` and `/api-audit capture` preparation commands.
- N-target capture execution helper with injectable recorder/page-action dependencies.
- V1-compatible optional `targetId` / `variant` metadata on recording proxy manifests and exchanges.
- `api_audit_run_target_capture` and `/api-audit capture --run` target-based capture execution entrypoints.
- `/api-audit` dashboard widget summarizing profiles, scenarios, recent runs, and next actions.
- Persistent scenario discovery proxy lifecycle commands: `/api-audit discover start/status/stop`.
- Scenario discovery capture windows can create isolated run artifacts without stopping the persistent proxy session.
- Browser-assisted scenario discovery capture (`/api-audit discover capture --browser`) records candidate page URL/path context and captures multi-target sessions sequentially.
- MVP top-level discovery commands for lower-cognitive-load evidence collection: `/api-discovery-create/status/scenario/open/record/finish/stop`.
- Browser-visible API observations are captured during top-level discovery recording windows and persisted to discovery manifests.
- Discovery recordings now include `comparisonRunId` and write comparison grouping artifacts under `.pi-api-audit-runs/comparisons/`.
- Comparison artifacts now include first-class browser context per target for report provenance.
- Added `/api-discovery-analyze --comparison <path>` to write deterministic comparison analysis artifacts.
- Added `/api-discovery-suggest --analysis <path>` to write reviewable scenario suggestion artifacts.
- Added `/api-discovery-validate-suggestion --suggestion <path>` for deterministic suggestion validation.
- Updated scenario dictionary evidence to reviewed `evidence.comparisons[]` entries keyed by `comparisonRunId`.
- Added local report/review viewer builder under `tools/` for self-contained `.pi-api-audit-runs/index.html` and `review.html` artifacts.
- Manual-assisted scenario discovery MVP with `/api-audit discover`, `api_audit_prepare_scenario_discovery`, and `api_audit_run_scenario_discovery`.
- Paused passthrough discovery sessions so setup/login traffic is forwarded but not recorded until `/api-audit discover --run --session <id>`.
