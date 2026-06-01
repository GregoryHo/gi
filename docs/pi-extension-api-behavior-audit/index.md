# API behavior audit extension docs index

## Current stable version

- Version: `0.2.0`
- Package: `packages/pi-extension-api-behavior-audit`
- Status: Release prep complete; local package release sealed in docs.
- Version docs: `versions/0.2.0/` is indexed in `archive.md`.
- Current package version: `0.2.0`

## Active planning version

- Version: `0.2.1`
- Status: In progress
- Version docs: `versions/0.2.1/index.md`

## Navigation

- `roadmap.md` — broad product direction and Layer A/B framing.
- `milestones.md` — sealed MVP milestone tracker for v0.1.0.
- `versions/README.md` — versioned planning convention.
- `versions/0.2.1/index.md` — active v0.2.1 persistent proxy/window lifecycle planning index.
- `versions/0.2.1/milestones.md` — active v0.2.1 milestone tracker.
- `versions/0.2.0/index.md` — sealed v0.2.0 programmatic capture lifecycle and automation release index.
- `versions/0.2.0/milestones.md` — sealed v0.2.0 milestone tracker.
- `versions/0.1.1/index.md` — sealed v0.1.1 path-fix planning/release index.
- `versions/0.1.1/milestones.md` — sealed v0.1.1 milestone tracker.
- `artifact-schema.md` — artifact layout and schema contract for `manifest.json` and `exchanges.ndjson`.
- `scenario-dictionary.md` — scenario dictionary schema, account-activity lineage, and maintenance rules.
- `evidence-pipeline.md` — raw run → comparison → analysis → suggestion → validation → SOT semantics and drift guardrails.
- `m1-artifact-redaction-primitives.md` — first implementation milestone plan.
- `m2-layer-a-account-activity-capture.md` — first runnable capture POC plan.
- `m3-scenario-page-manifest.md` — completed scenario/page manifest plan.
- `m4-layer-b-recording-proxy-spike.md` — completed Layer B recording proxy spike plan.
- `m5-layer-b-account-activity-integrated-capture.md` — completed Layer B account-activity integration plan.
- `m6-artifact-schema-scenario-dictionary.md` — completed artifact schema, scenario dictionary SOT, and runtime validator plan.
- `m7-tool-based-guided-comparison-workflow.md` — completed natural-language tool UX plan.
- `m8-generic-scenario-upstream-capture-tools.md` — completed generic scenario upstream capture tools plan.
- `m9-environment-profile-config.md` — completed local environment profile config plan.
- `m10-target-based-capture-guided-ux.md` — completed target-based capture model and guided UX plan.
- `m11-scenario-discovery-workflow.md` — completed scenario discovery evidence collection workflow plan.
- `m12-scenario-candidate-generation-validation.md` — completed candidate generation, validation, evidence schema, pipeline docs, and local viewer plan.
- `m10-scenario-discovery-workflow.md` — superseded placeholder pointing to M11.
- `m9-scenario-discovery-workflow.md` — superseded placeholder pointing to M10.
- `log.md` — append-only product/change log.
- `archive.md` — completed/superseded docs index.
- `AGENTS.md` — docs governance and workflow.

## Naming

Chosen package/doc name: `pi-extension-api-behavior-audit`.

Rationale:

- The final goal is backend API behavior comparison, not only HAR capture or OpenAPI contract checks.
- The name leaves room for early browser-visible Playwright capture while preserving the Layer B direction.
- It follows the existing package naming style used by `pi-extension-jira-board`.

## Current scope

M10 completed the target-based capture model, N-target planning/run, target metadata artifacts, and widget-friendly dashboard/setup/capture MVP. Full custom overlay setup/capture wizard UX is deferred. M11 completed clean scenario discovery evidence collection with comparison grouping and browser context. M12 completed deterministic comparison analysis, candidate dictionary suggestion/validation, reviewed scenario comparison evidence, evidence pipeline drift guardrails, and local report/review viewers.

v0.1.1 delivered a patch-level workspace path fix: mutable API audit paths resolve from the user's active pi workspace root (`ctx.cwd` → Git root fallback model), not from the extension development repo.

v0.2.0 delivered programmatic capture lifecycle tools, bounded automation-script capture, and an agent-facing review helper so agents can start/stop/finalize safe read-only recorder flows and queue review slash-command steps without mandatory HITL done confirmation.

v0.2.1 is active and separates persistent proxy sockets from clean recording windows so legacy apps can keep stable local proxy URLs while agents finalize run artifacts independently.
