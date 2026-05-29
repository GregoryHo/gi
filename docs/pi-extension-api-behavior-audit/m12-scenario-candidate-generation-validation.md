# M12 — Scenario candidate generation and validation

## Status

Done.

## SPEC

### Scope

Analyze already captured discovery artifacts and generate reviewable scenario dictionary candidates without directly modifying the scenario dictionary source of truth.

M12 starts only after M11 can collect sufficiently clean discovery evidence:

```text
comparison artifact
-> Layer A page/browser provenance + Layer B upstream evidence runs
-> deterministic new-scenario candidate or existing-scenario patch suggestion
-> deterministic candidate validation
-> human review
-> explicit code change to scenario dictionary SOT
```

### Problem

A discovery recording by itself is not a scenario dictionary entry. Artifacts contain evidence, but users still need a structured candidate or patch that answers:

- What candidate scenario id was recorded?
- Which target/variant produced the evidence?
- What page context anchored the recording?
- Which browser-visible APIs were observed, if available?
- Which upstream/backend API candidates were observed?
- Is this a 0 -> 1 new scenario proposal, or a 1 -> N evidence patch for an existing scenario?
- Which fields are uncertain or missing?

This must not become an LLM-only inference step. The generator should summarize observed evidence deterministically and mark uncertainty explicitly.

### Proposed commands/tools

Potential top-level command:

```bash
/api-discovery-suggest --comparison .pi-api-audit-runs/comparisons/<comparison-run-id>.json
```

Loose `--run-dir` inputs can remain an advanced/debug path, but the primary M12 input should be a comparison artifact so grouping is deterministic.

Potential validation command:

```bash
/api-discovery-validate-candidate --candidate .pi-api-audit-runs/candidates/<candidate>.json
```

Potential natural-language tools:

- `api_audit_suggest_scenario_dictionary_entry`
- `api_audit_validate_scenario_dictionary_entry`

### M12.1 — Deterministic comparison analysis

Status: implemented.

Command:

```bash
/api-discovery-analyze --comparison .pi-api-audit-runs/comparisons/<comparison-run-id>.json
```

Behavior:

- Reads a validated comparison artifact.
- Loads referenced target runs.
- Summarizes upstream endpoint method/path/count/status distribution/response top-level keys.
- Summarizes browser-visible endpoint method/path/count/status distribution.
- Adds deterministic classification hints such as:
  - `matches-known-upstream-candidate`,
  - `matches-known-browser-api`,
  - `high-frequency-background-candidate`.
- Writes an analysis artifact under:

```text
.pi-api-audit-runs/analysis/<comparison-run-id>.json
```

This is intentionally not an audit report. It is an intermediate artifact that helps humans and LLMs reason from structured evidence instead of raw traffic dumps.

### M12.2 — Scenario suggestion artifacts

Status: implemented as deterministic suggestion generation.

Command:

```bash
/api-discovery-suggest --analysis .pi-api-audit-runs/analysis/<comparison-run-id>.json
```

Behavior:

- Reads a comparison analysis artifact.
- If the scenario id exists in the dictionary, writes an `existing-scenario-patch` suggestion.
- If the scenario id does not exist, writes a `new-scenario-candidate` suggestion.
- Includes observed page paths, known candidate matches, possible additional upstream endpoints, background candidates, and evidence comparison run ids.
- Writes suggestion JSON under:

```text
.pi-api-audit-runs/candidates/<scenario-id>-<comparison-run-id>.json
```

The suggestion artifact is review input only. It never updates `packages/pi-extension-api-behavior-audit/scenarios/default.scenarios.json` automatically.

### Candidate generation behavior

- Read a validated comparison artifact.
- Load and validate each referenced discovery run artifact.
- Treat Layer A as scenario/provenance anchor and Layer B as backend behavior evidence.
- Require or warn about Layer A anchor fields:
  - `candidatePage.url`
  - `candidatePage.path`
  - `candidatePage.source`
- Summarize Layer B upstream exchanges deterministically:
  - method
  - normalized path
  - count
  - status distribution
  - optional response top-level keys
- Include browser-visible API candidates only when M11 captures browser-visible evidence.
- Include evidence run ids, comparison run id, target metadata, and Layer A page/browser context.
- Write candidate JSON or patch JSON under gitignored artifacts, or print it in a widget/tool result.
- Never modify `packages/pi-extension-api-behavior-audit/scenarios/default.scenarios.json`.

Example partial candidate:

```json
{
  "version": 1,
  "kind": "scenario-dictionary-candidate",
  "candidateScenarioId": "account-activity-basic",
  "generatedAt": "...",
  "comparisonRunId": "comparison-...",
  "sourceRunIds": ["2026-..."],
  "variants": {
    "candidate": {
      "targetIds": ["new"],
      "pagePath": "/account/activity",
      "browserApiAllowlist": [],
      "upstreamApiCandidates": ["/apis/account/activity"],
      "evidence": {
        "observedUpstreamRequests": [
          {
            "method": "GET",
            "path": "/apis/account/activity",
            "count": 1,
            "statuses": { "200": 1 },
            "responseTopLevelKeys": ["Items", "Others", "Pager"]
          }
        ]
      },
      "notes": [
        "Generated from scenario discovery artifacts; requires human review.",
        "browserApiAllowlist is empty because browser-visible request evidence was not captured."
      ]
    }
  }
}
```

### Existing scenario iteration model

M12 should support both scenario creation and scenario iteration:

```text
0 -> 1: comparison evidence suggests a new scenario dictionary entry
1 -> N: comparison evidence suggests a patch to an existing scenario entry
```

For existing scenarios, each new capture should produce a new `comparisonRunId`. The scenario id remains stable; accepted comparison evidence accumulates after human review.

Implemented scenario dictionary evidence shape:

```json
{
  "evidence": {
    "comparisons": [
      {
        "comparisonRunId": "comparison-2026-05-26T06-53-01-380Z",
        "targets": {
          "old": "2026-05-26T06-54-31-301Z",
          "new": "2026-05-26T06-55-18-846Z"
        },
        "notes": ["Accepted from M12 scenario suggestion review."]
      }
    ]
  }
}
```

The comparison artifact contains Layer A browser context and Layer B upstream run references. The scenario dictionary stores reviewed comparison lineage without duplicating raw artifact contents.

### M12.3 — Scenario suggestion validation

Status: implemented as deterministic suggestion validation.

Command:

```bash
/api-discovery-validate-suggestion --suggestion .pi-api-audit-runs/candidates/<suggestion>.json
```

Behavior:

- Validates suggestion JSON shape and mode.
- Loads the referenced source analysis artifact when available.
- Verifies suggestion `scenarioId` and `comparisonRunId` match the source analysis.
- Verifies old/new evidence run ids match the source analysis targets.
- Verifies existing-scenario patch suggestions refer to an existing dictionary scenario.
- Verifies new-scenario candidates include page paths and upstream API candidates.
- Rejects background candidates if they are included as new-scenario upstream candidates.
- Returns errors and warnings only; it does not mutate scenario dictionary SOT.

### M12.4 — Scenario dictionary comparison evidence schema

Status: implemented.

The scenario dictionary SOT now stores reviewed evidence through structured comparison entries instead of baseline `evidence.layerA` / `evidence.layerB` string labels:

```json
{
  "evidence": {
    "comparisons": [
      {
        "comparisonRunId": "comparison-2026-05-26T06-53-01-380Z",
        "targets": {
          "old": "2026-05-26T06-54-31-301Z",
          "new": "2026-05-26T06-55-18-846Z"
        },
        "notes": ["Accepted from M12 scenario suggestion review."]
      }
    ]
  }
}
```

No migration path is implemented because the package is still pre-release and the previous dictionary contents were development scaffolding. No auto-apply is implemented; humans still review suggestion artifacts and update the SOT explicitly.

### M12.5 — Evidence pipeline documentation and drift guardrails

Status: implemented.

The evidence pipeline is now documented in:

```text
docs/pi-extension-api-behavior-audit/evidence-pipeline.md
```

The document defines:

- raw run / comparison / analysis / suggestion / validation / scenario SOT responsibilities,
- Layer A and Layer B roles,
- current deterministic endpoint normalization and classification hints,
- `possibleAdditionalUpstream` and `backgroundCandidates` semantics,
- review order,
- report guidance,
- drift guardrails for future changes.

Governance files now require updates to this document whenever evidence pipeline semantics change. A lightweight package test checks that the document continues to mention the core pipeline concepts and hint names.

### M12.6 — Local report and suggestion review viewers

Status: implemented.

A local SOT-driven viewer builder is available at:

```bash
python packages/pi-extension-api-behavior-audit/tools/build-viewer.py
```

It writes self-contained `file://` HTML artifacts under `.pi-api-audit-runs/`:

```text
.pi-api-audit-runs/index.html   # comparison report viewer
.pi-api-audit-runs/review.html  # suggestion review / handback viewer
```

The report viewer starts from `scenarios/default.scenarios.json`, follows `evidence.comparisons[]`, loads comparison/analysis/raw run artifacts, and renders scenario coverage, browser-visible context, upstream summaries, raw timelines, path catalog, manual old/new pair comparison, and response/header/body diffs.

The review viewer starts from suggestion artifacts under `.pi-api-audit-runs/candidates/`, lets a reviewer toggle observed endpoints for inclusion/exclusion, and exports Markdown or a field-named `scenario-dictionary-patch` v1 handback. It does not mutate the scenario dictionary SOT.

### Candidate validation behavior

- Validate candidate JSON shape deterministically.
- Verify referenced run artifacts exist and are valid when paths are available.
- Verify target run manifests share the comparison artifact's `comparisonRunId` when present.
- Distinguish partial discovery candidates from final scenario dictionary entries.
- Report missing page context or browser-visible evidence as validation warnings, not silent assumptions.

### Deferred beyond M12 MVP

- Automatic mutation of `default.scenarios.json`.
- Full formal Layer A run generation and browser-visible body parity analysis.
- LLM-only judgment of endpoint equivalence or recording boundaries.

### Non-goals

- No automatic scenario dictionary mutation.
- No auto-commit.
- No endpoint semantic equivalence judgment.
- No audit report generation.
- No LLM-only endpoint mapping decisions.

## AC

- Candidate generation reads validated discovery artifacts.
- Candidate generation uses Layer A page context when present.
- Candidate generation summarizes upstream API candidates deterministically.
- Candidate output includes evidence run ids, target ids, variants, and uncertainty notes.
- Candidate validation is deterministic and separates errors from warnings.
- Scenario dictionary SOT is modified only through explicit human/code review.
- Scenario dictionary SOT stores reviewed comparison evidence under `evidence.comparisons[]`.
- Evidence pipeline semantics are documented and protected by governance guardrails.
- Local report/review viewers can be built from SOT and local artifacts.

## Completion notes

Completed for the v0.1.0 MVP baseline:

- `/api-discovery-analyze --comparison <path>` writes deterministic comparison analysis artifacts.
- `/api-discovery-suggest --analysis <path>` writes reviewable suggestion artifacts.
- `/api-discovery-validate-suggestion --suggestion <path>` validates suggestions without mutating SOT.
- Scenario dictionary evidence uses reviewed `evidence.comparisons[]` entries.
- `docs/pi-extension-api-behavior-audit/evidence-pipeline.md` documents pipeline semantics and drift guardrails.
- `tools/build-viewer.py` builds local `index.html` and `review.html` viewers from SOT and local artifacts.

Verification passed before release prep:

```bash
python3 packages/pi-extension-api-behavior-audit/tools/build-viewer.py --scenario account-activity-basic
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
