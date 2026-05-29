# API behavior audit pi extension roadmap

## Goal

Build a reusable pi package that helps collect, sanitize, and organize old-versus-new API behavior evidence for QA-oriented audits.

The final audit target is backend/upstream API behavior, not just frontend mock validation.

## Layer model

### Layer A — browser-visible capture

Capture requests/responses observed by Playwright in the browser:

```text
old page -> /apis/... response
new page -> /moapi/... response
```

Layer A is the scenario/provenance anchor: it explains which page, user flow, and browser-visible API activity caused the backend traffic. It is required for meaningful audit reports because a raw backend trace alone does not explain the business context that produced it.

Layer A does not by itself prove backend behavior parity, but it should be preserved as structured evidence or context for report generation.

### Layer B — backend/upstream capture

Capture the server-side upstream calls made behind the browser-visible layer:

```text
old Go web API/proxy -> baseline backend /v1/...
new candidate web/proxy -> API gateway/backend ...
```

This is the long-term audit surface because the QA question is backend API behavior parity.

Layer B is the primary behavior evidence for the final backend API audit report. Layer A and Layer B should be tied together by explicit recording windows and comparison grouping so reports can say both what was operated and what backend behavior occurred.

## Assumptions

- Old `web/base` + `web/sc` can be run locally, normally on `http://localhost:8080`.
- New `candidate-web-audit` can be run locally through Vite/preview, normally on `http://localhost:8008`.
- Playwright is available in the new project and can provide scenario/page anchors.
- Existing mock-based E2E tests are useful references but must not be treated as real backend evidence.
- Captured data may contain secrets or private data and must be sanitized before storage or LLM use.

## Directional milestones

### M0 — Initial docs and package scaffold

Completed. Establish package naming, docs governance, and minimal loadable extension scaffold.

### M1 — Artifact and redaction primitives

Create the shared sanitized exchange model and artifact writer used by both Layer A and Layer B.

Plan: `m1-artifact-redaction-primitives.md`.

### M2 — Layer A account-activity local capture POC

Use Playwright to collect browser-visible old/new API request/response artifacts for:

```text
/account/activity — Account activity
```

This milestone validates capture workflow only. It is not the final backend behavior audit surface.

Plan: `m2-layer-a-account-activity-capture.md`.

### M3 — Scenario/page manifest

Completed. Introduces a minimal built-in/custom scenario manifest with account-activity page/API allowlists and capture provenance snapshots.

Plan: `m3-scenario-page-manifest.md`.

### M4 — Layer B recording proxy spike

Completed. Proves a loopback Layer B recording proxy with sanitized upstream artifacts and curl/local-upstream smoke.

Plan: `m4-layer-b-recording-proxy-spike.md`.

Expected old-side direction:

```text
old Go app.conf [api].host -> local recorder -> baseline backend ApiHost
```

Expected new-side direction:

```text
new VITE_API_URL -> local recorder -> API gateway/backend
```

### M5 — Layer B account-activity integrated capture

Completed. Uses Playwright account-activity page actions while treating upstream recorder artifacts as the primary audit evidence after manual app reconfiguration.

Plan: `m5-layer-b-account-activity-integrated-capture.md`.

### M6 — Artifact schema and scenario dictionary governance

Completed. Formalizes artifact contracts, scenario dictionary source of truth, and deterministic runtime validators before report generation.

Plan: `m6-artifact-schema-scenario-dictionary.md`.

### M7 — Tool-based guided comparison workflow

Completed. Registers natural-language-triggerable pi tools for scenario listing, artifact validation, preparation guidance, and account-activity upstream capture.

Plan: `m7-tool-based-guided-comparison-workflow.md`.

Audit report artifact generation is intentionally removed from the active milestone path for now; the priority is making evidence collection and validation easy to use.

### M8 — Generic scenario upstream capture tools

Completed. Generalizes account-activity-specific capture tools into `scenarioId`-driven tools that read page paths and candidates from the scenario dictionary SOT.

Plan: `m8-generic-scenario-upstream-capture-tools.md`.

### M9 — Environment profile config

Completed. Stores reusable old/new frontend/backend URLs in explicit gitignored local profiles so generic tools do not rely on prompt/session memory.

Plan: `m9-environment-profile-config.md`.

### M10 — Target-based capture model and guided UX

Completed. Replaces old/new pair assumptions with target-based profiles, N-target capture, target metadata artifacts, and widget-friendly dashboard/setup/capture commands. Full custom overlay setup/capture wizard UX is deferred.

Plan: `m10-target-based-capture-guided-ux.md`.

### M11 — Scenario discovery evidence collection workflow

Completed. Collects clean Layer A/B discovery evidence from real target-based site behavior without automatic writes to the scenario dictionary SOT. Includes persistent proxy sessions, stateful browser lifecycle, explicit recording windows, low-cognitive-load discovery commands, comparison grouping, and first-class browser context in comparison artifacts.

M11's collection model is: Layer B upstream exchanges are formal atomic run artifacts; Layer A browser/page context is captured during the same semantic recording window and preserved as first-class comparison context for report provenance.

Plan: `m11-scenario-discovery-workflow.md`.

### M12 — Scenario candidate generation and validation

Completed for v0.1.0. Generates deterministic comparison analysis artifacts, reviewable scenario dictionary suggestions, deterministic suggestion validation, reviewed `evidence.comparisons[]` scenario lineage, evidence pipeline drift guardrails, and local report/review viewers. Candidate generation and review tooling never mutates the scenario dictionary SOT automatically.

Plan: `m12-scenario-candidate-generation-validation.md`.

## Non-goals for the first runnable MVP

- No production or staging capture by default.
- No automatic destructive flows.
- No full parity judgment without explicit artifacts and provenance.
- No replacement of existing E2E mock coverage.
