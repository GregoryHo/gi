# API behavior audit extension log

Append-only product/change history.

## 2026-05-24

- Chose extension/package name `pi-extension-api-behavior-audit` to emphasize backend API behavior comparison as the final goal.
- Created initial docs and package scaffolding on branch `feature/api-behavior-audit-extension`.
- Recorded Layer A as an MVP validation layer and Layer B as the final audit target.
- Completed M0 scaffold verification: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck`, and `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`.
- Selected `/account/activity` as the first read-only capture scenario.
- Drafted M1 artifact/redaction primitives plan and M2 Layer A account-activity capture POC plan. M1/M2 are not started yet.
- Started M1 artifact/redaction primitives implementation. Scope is limited to layer-neutral sanitized exchange types, redaction helpers, and deterministic artifact writers.
- Completed M1 artifact/redaction primitives. Verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M2 Layer A account-activity local capture POC. Scope is limited to local Playwright browser-visible capture for `/account/activity`; Layer A remains validation-only and not final backend audit evidence.

## 2026-05-25

- Completed M2 Layer A account-activity local capture POC.
- Manual smoke run `2026-05-25T01-41-13-308Z` produced `manifest.json` and `exchanges.ndjson` with two exchanges: old `/apis/account/activity` and new `/gateway/apis/account/activity`.
- Artifact redaction check found no raw cookie, authorization, password/passwd, token/session/csrf values; new authorization was `[REDACTED]`.
- Verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M3 scenario/page manifest. Scope is limited to a minimal manifest schema/loader, a built-in account-activity scenario, and preserving existing M2 capture behavior.
- Completed M3 scenario/page manifest. Built-in manifest smoke run `2026-05-25T03-10-21-200Z` and custom manifest smoke run `2026-05-25T03-16-22-781Z` both produced two account-activity exchanges with scenario snapshots and sanitized headers.
- M3 verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M4 Layer B recording proxy spike. Scope is limited to a local loopback recording proxy, curl/local-upstream verification, sanitized upstream exchanges, and no Playwright/app integration yet.
- Completed M4 Layer B recording proxy spike. Manual curl smoke run `2026-05-25T06-07-45-944Z` recorded one sanitized upstream POST exchange with `manifest.exchangeCount: 1`.
- M4 redaction check found no raw request token, request password, response token, cookie, authorization, password/passwd, token/session/csrf values.
- M4 verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M5 Layer B account-activity integrated capture. Scope is limited to starting old/new recorders, prompting explicit manual app reconfiguration, then running account-activity page actions to collect upstream artifacts.
- Completed M5 Layer B account-activity integrated capture. Manual smoke runs old `2026-05-25T06-58-22-572Z` and new `2026-05-25T06-58-22-580Z` captured upstream account-activity evidence after manual app reconfiguration.
- Old upstream account-activity equivalent was `GET /v1/account/activity`; new upstream account-activity was `GET /apis/account/activity`. Both responses exposed `Items`, `Others`, and `Pager` top-level keys.
- M5 smoke found an empty `x-ps-device-token` request header on old exchanges; no value leaked, and token-like header redaction was hardened in package code.
- M5 verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M6 artifact schema and scenario dictionary governance. Report generation is deferred to M7 until `manifest.json`, `exchanges.ndjson`, and scenario dictionary maintenance rules are documented.
- Completed M6 artifact schema and scenario dictionary governance. Added `artifact-schema.md`, `scenario-dictionary.md`, and package example `examples/account-activity.scenarios.json` documenting account-activity lineage from product choice through Layer A and Layer B evidence.
- M6 verification passed: `python3 -m json.tool packages/pi-extension-api-behavior-audit/examples/account-activity.scenarios.json`, `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Reopened M6 after deciding that docs are not sufficient: versioned JSON Schema files and scenario dictionary JSON must be the source of truth, runtime loaders must validate artifacts deterministically, and M7 must consume validated loaders instead of raw JSON parsing.
- Completed reopened M6. Added versioned JSON Schema files, `scenarios/default.scenarios.json` as scenario SOT, deterministic artifact/scenario loaders, write-time manifest/exchange validation, and tests for invalid artifacts/dictionaries.
- Validated existing M5 artifacts through schema-backed loaders: old `2026-05-25T06-58-22-572Z` with 129 exchanges and new `2026-05-25T06-58-22-580Z` with 33 exchanges.
- Reopened M6 verification passed: JSON schema/dictionary syntax checks, `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M7 tool-based guided comparison workflow. Removed audit report artifact generation from the active milestone path and shifted focus to natural-language-triggerable pi tools for scenario listing, run validation, preparation guidance, and account-activity upstream capture.
- Completed M7 tool-based guided comparison workflow. Added `api_audit_list_scenarios`, `api_audit_validate_run`, `api_audit_prepare_account_history_upstream_capture`, and `api_audit_run_account_history_upstream_capture` while preserving `/api-audit` slash commands.
- M7 verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Started M8 generic scenario upstream capture tools. Scope is to add scenario-id-driven prepare/run tools that read page paths and endpoint candidates from the scenario dictionary SOT while preserving account-activity wrappers.
- Proposed M9 scenario discovery workflow to help derive future scenario dictionary entries from real old/new site behavior without automatically mutating the scenario dictionary SOT.
- Completed M8 generic scenario upstream capture tools. Added `api_audit_prepare_upstream_capture` and `api_audit_run_upstream_capture`, both driven by `scenarioId` and scenario dictionary SOT while preserving account-activity-specific wrappers.
- M8 verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Planned M9 environment profile config so old/new frontend/backend URLs can be stored in explicit gitignored local profiles rather than relying on prompt/session memory. Scenario discovery moved to M10.
- Updated M9 plan to require both slash commands and natural-language tools for environment profiles, sharing the same underlying profile loader/writer.
- Completed M9 environment profile config. Added deterministic profile loader/writer, `/api-audit profile show/save/default/clear`, environment profile tools, and profile resolution for generic upstream capture tools.
- M9 verification passed: `npm test --workspace @gregho/pi-extension-api-behavior-audit`, `npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit`, `npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit`, and `npm run typecheck`.
- Planned M10 target-based capture model and guided UX. Scope is to move beyond old/new pair assumptions toward named targets, selected target groups, N-target capture, and widget-guided setup/capture flows. Scenario discovery moved to M11.
- Started M10 target-based capture model and guided UX. First implementation slice focuses on target-based profile/scenario resolution and target list/prepare tools before full widget wizard.
- Completed first M10 implementation slice: added target-based capture plan resolver, v2 target profile/scenario support for planning, v1 old/new compatibility mapping, and `api_audit_list_targets` / `api_audit_prepare_target_capture` tools. Full N-target execution and widget wizard remain in progress.
- Added M10 widget-friendly command entrypoints: `/api-audit setup` now shows setup guidance, and `/api-audit capture --scenario-id <id> --profile <name> [--target <id> | --group <name>]` renders target capture preparation to the widget without starting proxies/browsers.
- Added M10 N-target execution helper `runTargetCapture` with tested orchestration for starting selected target recorders, running target page actions, stopping recorders in `finally`, and reporting per-target no-exchange warnings. Recording proxy target metadata integration remains pending.
- Added v1-compatible target artifact metadata. Recording proxy now writes optional `targetId` and `variant` fields to manifest `recordingProxy` metadata and each upstream exchange when supplied.
- Added target-based run entrypoints: `api_audit_run_target_capture` and `/api-audit capture --run --scenario-id <id> --profile <name> [--target <id> | --group <name>]`. `runTargetCapture` now defaults to real recording proxy and Playwright page-action deps, while tests can inject fakes.
- Added `/api-audit` dashboard widget summary for profiles, scenarios, recent artifact runs, and recommended next actions. Full custom overlay wizard UX is deferred; setWidget dashboard/setup/capture flow is the M10 MVP.
- Marked M10 done after user manual testing acceptance. Deferred full custom overlay setup/capture wizard UX out of M10 scope.
- Re-scoped M11 to scenario discovery evidence collection and moved candidate generation/validation to proposed M12. M11 next focuses on top-level discovery commands and stateful browser/recording lifecycle.
- Added MVP top-level discovery commands: `/api-discovery-create`, `/api-discovery-status`, `/api-discovery-scenario`, `/api-discovery-open`, `/api-discovery-record`, `/api-discovery-finish`, and `/api-discovery-stop`.
- Added browser-visible API observations for top-level discovery recording windows; fetch/xhr response method, sanitized URL/path, status, and source are stored in discovery manifests.
- Added M11.6 comparison grouping: target recordings remain atomic runs, each manifest gets `comparisonRunId`, and `.pi-api-audit-runs/comparisons/<comparison-run-id>.json` binds old/new runs for deterministic analysis.
- Documented the agreed Layer A/B interpretation: Layer A is scenario/provenance anchor, Layer B is backend behavior evidence, recording windows are semantic action boundaries, and comparison artifacts bind old/new evidence. Deferred full formal Layer A run artifacts, LLM-driven recording boundaries, multiple attempts per session, and N-target comparison beyond the current MVP.
- Implemented M11.7 minimal first-class browser context in comparison artifacts: each comparison target can include `browserContext.page` and `browserContext.browserVisibleRequests` alongside the upstream run reference.
- Completed M11 after manual `account-activity-basic` smoke validation. Comparison `comparison-2026-05-26T06-53-01-380Z` bound old run `2026-05-26T06-54-31-301Z` and new run `2026-05-26T06-55-18-846Z`; both validated with schema-backed loaders and included expected upstream candidates. M12 moved to in progress.
- Implemented M12.1 deterministic comparison analysis: `/api-discovery-analyze --comparison <path>` loads comparison artifacts, summarizes upstream and browser-visible endpoints, marks deterministic hints, and writes `.pi-api-audit-runs/analysis/<comparison-run-id>.json`.
- Implemented M12.2 scenario suggestion artifacts: `/api-discovery-suggest --analysis <path>` writes either `existing-scenario-patch` or `new-scenario-candidate` JSON under `.pi-api-audit-runs/candidates/` without modifying scenario dictionary SOT.
- Implemented M12.3 scenario suggestion validation: `/api-discovery-validate-suggestion --suggestion <path>` validates suggestion shape, source analysis linkage, evidence run ids, existing/new scenario mode constraints, and background-candidate exclusions without mutating SOT.
- Implemented M12.4 scenario dictionary comparison evidence schema: default scenario SOT now stores reviewed evidence as `evidence.comparisons[]` with `comparisonRunId` and old/new run ids; baseline `layerA`/`layerB` evidence labels are no longer accepted.
- Implemented M12.5 evidence pipeline documentation and drift guardrails: added `evidence-pipeline.md`, cross-linked artifact/scenario docs, updated docs/package governance, and added a docs presence test for core pipeline concepts and classification hints.
- Implemented M12.6 local report and suggestion review viewers: `tools/build-viewer.py` builds `.pi-api-audit-runs/index.html` and `.pi-api-audit-runs/review.html` from the scenario SOT and local artifacts without mutating SOT.
- Completed M12 and prepared the v0.1.0 release baseline after rebasing `feature/api-behavior-audit-extension` onto `main`. Scaffolding/version-iteration check passed: package/docs 1:1 naming is preserved, package metadata includes pi extension manifest and publish files, governance docs cover future pipeline drift, runtime artifacts remain gitignored, and future versions can extend milestones after the v0.1.0 baseline.
- Started M11 scenario discovery workflow. First slice is manual-assisted discovery recording: candidate scenario ids do not need to exist in the scenario dictionary; user manually operates the browser and confirms done before recorders stop.
- Implemented M11.1 manual-assisted discovery MVP with `/api-audit discover`, `api_audit_prepare_scenario_discovery`, and `api_audit_run_scenario_discovery`. Discovery writes sanitized recording proxy artifacts and does not modify scenario dictionary SOT.
- Refined M11 discovery to avoid setup/login noise: `/api-audit discover --scenario-id ...` now starts paused passthrough recorders, and `/api-audit discover --run --session <id>` arms recording only for the manual operation window.

## 2026-05-29

- Started v0.1.1 path-fix planning. Active planning moved to `versions/0.1.1/`; the patch goal is resolving mutable API audit paths from the user's pi workspace (`ctx.cwd` with Git-root preference) instead of accidentally defaulting to this extension monorepo.
- Completed v0.1.1 M1 workspace path resolution. Commands/tools now resolve mutable API-audit paths from pi `ctx.cwd` with Git-root preference; package assets remain package-relative. Verification passed: package test/typecheck/pack dry run and root typecheck.
- Completed and sealed v0.1.1 local package release. Package version/changelog updated to `0.1.1`, version docs archived, release policy updated, and verification passed: package version check, package test/typecheck/pack dry run, and root typecheck. No publish or tag was created.
- Added a v0.1.1 follow-up to remove package scenario fallback from runtime flows. Scenario dictionaries are workspace/repo-owned; package scenario data is example-only, so using the extension from a business repo no longer lists package `account-activity-basic` by default.

## 2026-06-01

- Started v0.2.0 planning on branch `feature/api-behavior-audit-0.2.0-programmatic-capture`. Active version docs live under `versions/0.2.0/`.
- v0.2.0 product goal: add programmatic start/stop/finalize capture lifecycle and bounded automation hooks so a pi agent can operate safe read-only capture flows without mandatory HITL done confirmation.
- Completed and sealed v0.2.0 local package release. Added programmatic capture lifecycle tools, bounded automation-script capture, an agent-facing review helper tool for slash-command review steps/local viewer guidance, package/changelog/README updates, and verification evidence. No publish or tag was created.
- Completed and sealed v0.2.1 local package release. Added persistent proxy/window lifecycle tools and comparison artifact generation on recording-window finalization. No publish or tag was created.
- Completed and sealed v0.2.2 local package release. Added path-based passthrough routes so local legacy frontend/static paths can bypass API upstream recording while API paths remain recorded. No publish or tag was created.
