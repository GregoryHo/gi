# API behavior audit evidence pipeline

This document defines the current evidence pipeline semantics for `pi-extension-api-behavior-audit`.

It is the maintenance guide for how raw recording artifacts become deterministic analysis, review suggestions, accepted scenario dictionary evidence, and later audit reports.

## Scope

The pipeline is:

```text
raw run
-> comparison
-> analysis
-> suggestion
-> validation
-> reviewed scenario dictionary evidence
-> audit report / review output
```

This document explains what each stage means and which deterministic rules currently exist. It does not replace the machine-readable JSON schemas.

## Source-of-truth hierarchy

Use this order when resolving conflicts:

1. JSON schemas under `packages/pi-extension-api-behavior-audit/schemas/` define artifact and dictionary shape.
2. Runtime validators/loaders in `src/artifact-schema.ts` and `src/scenario-dictionary.ts` enforce supported shape.
3. Deterministic pipeline code in `src/comparison-analysis.ts` and `src/scenario-suggestion.ts` defines analysis and suggestion behavior.
4. The workspace/repo-owned scenario dictionary, conventionally `<workspace-root>/.pi-api-audit-runs/scenarios.local.json`, is the reviewed scenario dictionary SOT.
5. Markdown docs explain semantics and maintenance rules for humans.

LLMs may read and explain artifacts, but LLM output is not source of truth unless a human explicitly edits and reviews the SOT files.

## Artifact responsibilities

| Stage | Path | Produced by | Answers |
| --- | --- | --- | --- |
| raw run | `.pi-api-audit-runs/<runId>/manifest.json` + `exchanges.ndjson` | recording proxy / capture flow | What sanitized API exchanges happened in one target recording window? |
| comparison | `.pi-api-audit-runs/comparisons/<comparisonRunId>.json` | `/api-discovery-finish` | Which old/new raw runs belong to the same comparison attempt, and what Layer A browser context anchors them? |
| analysis | `.pi-api-audit-runs/analysis/<comparisonRunId>.json` | `/api-discovery-analyze` | What deterministic endpoint patterns were observed in the comparison? |
| suggestion | `.pi-api-audit-runs/candidates/<scenarioId>-<comparisonRunId>.json` | `/api-discovery-suggest` | What reviewable scenario dictionary update is suggested by the analysis? |
| validation result | command/widget output from `/api-discovery-validate-suggestion` | deterministic validator | Is the suggestion structurally consistent with the source analysis and dictionary mode? |
| scenario dictionary | `<workspace-root>/.pi-api-audit-runs/scenarios.local.json` or explicit `--scenario-dictionary` / `--sot` path | human/code review | What scenario definitions and evidence have been accepted for this repo/workspace? |

## Layer roles

The final audit goal is backend API behavior review.

Layer roles are:

```text
Layer A = scenario/provenance anchor
Layer B = backend behavior evidence
```

Layer A browser context explains which page/flow caused backend traffic. Layer B upstream exchanges are the primary behavior evidence.

A comparison artifact ties these together:

```text
comparisonRunId
  -> old upstream run + old browserContext
  -> new upstream run + new browserContext
```

## Comparison semantics

A comparison artifact is a grouping artifact. It does not analyze traffic.

It records:

- `comparisonRunId`
- `candidateScenarioId`
- optional discovery session id
- old/new target references
- each target's `runId`, `manifestPath`, and `exchangesPath`
- each target's optional `browserContext`

The current MVP expects old/new target entries. Do not merge old/new exchanges into one run.

## Analysis semantics

Analysis is deterministic code in `src/comparison-analysis.ts`.

`/api-discovery-analyze --comparison <path>` does the following:

1. Loads and validates the comparison artifact.
2. Loads the default scenario dictionary, if the scenario exists.
3. For each target, loads the referenced `exchanges.ndjson`.
4. Normalizes each endpoint by HTTP method and URL pathname.
5. Groups exchanges by `method + path`.
6. Counts occurrences.
7. Summarizes status distribution.
8. Collects response top-level keys when the response body is a JSON object.
9. Summarizes browser-visible observations from comparison `browserContext.browserVisibleRequests`.
10. Adds deterministic classification hints.

### Endpoint normalization

Current rule:

```text
GET https://example.test/apis/account/activity?pi=1&ps=25
-> method: GET
-> path: /apis/account/activity
```

Query strings are ignored for endpoint grouping. Request parameter parity is not analyzed by the current M12 pipeline.

### Classification hints

Current hints are deterministic and intentionally simple.

#### `matches-known-upstream-candidate`

Applied when an upstream endpoint path is listed in the scenario dictionary:

```json
"upstreamApiCandidates": {
  "old": ["/v1/account/activity"],
  "new": ["/apis/account/activity"]
}
```

#### `matches-known-browser-api`

Applied when a browser-visible endpoint path is listed in the scenario dictionary:

```json
"browserApiAllowlist": {
  "old": ["/apis/account/activity"],
  "new": ["/gateway/apis/account/activity"]
}
```

#### `high-frequency-background-candidate`

Applied when:

```text
count >= 10
and endpoint is not a known upstream candidate
```

This is a review hint, not proof. It means the endpoint is likely initialization, config, polling, or page background traffic.

Example from `account-activity-basic`:

```text
GET /v1/file-srv/domain x40 -> high-frequency-background-candidate
```

## Suggestion semantics

Suggestion generation is deterministic code in `src/scenario-suggestion.ts`.

`/api-discovery-suggest --analysis <path>` does the following:

1. Loads the comparison analysis artifact.
2. Checks whether `candidateScenarioId` exists in the scenario dictionary.
3. Produces either:
   - `existing-scenario-patch`, or
   - `new-scenario-candidate`.
4. Writes a review artifact under `.pi-api-audit-runs/candidates/`.
5. Does not modify the scenario dictionary SOT.

### `candidateMatches`

Suggestion `candidateMatches` are copied from analysis endpoints with known-match hints:

- `matches-known-upstream-candidate`
- `matches-known-browser-api`

These mean the recorded comparison hit endpoints already listed by the reviewed scenario dictionary.

### `possibleAdditionalUpstream`

`possibleAdditionalUpstream` includes upstream endpoint paths with no classification hints.

This does **not** mean they should be added to the scenario dictionary automatically. It means deterministic code observed them but cannot classify them as core or background.

Humans and LLMs may use this list for review questions such as:

- Is this endpoint part of the scenario action?
- Is it page setup or shared account layout data?
- Does it appear across unrelated scenarios?

### `backgroundCandidates`

`backgroundCandidates` includes endpoints with `high-frequency-background-candidate`.

These should not be promoted to core scenario candidates without explicit review rationale.

### Existing scenario suggestions

If the scenario already exists, suggestion mode is:

```json
"mode": "existing-scenario-patch"
```

The suggestion recommends appending reviewed comparison evidence:

```json
"suggestedPatch": {
  "scenarioId": "account-activity-basic",
  "appendEvidenceComparison": {
    "comparisonRunId": "comparison-2026-05-26T06-53-01-380Z",
    "targets": {
      "old": "2026-05-26T06-54-31-301Z",
      "new": "2026-05-26T06-55-18-846Z"
    }
  }
}
```

### New scenario suggestions

If the scenario does not exist, suggestion mode is:

```json
"mode": "new-scenario-candidate"
```

The current deterministic candidate selection is intentionally broad:

- browser allowlist uses observed browser-visible endpoint summary paths,
- upstream candidates use upstream endpoints except `high-frequency-background-candidate` endpoints.

New scenario suggestions require human review before SOT edits.

## Validation semantics

`/api-discovery-validate-suggestion --suggestion <path>` checks:

- suggestion shape and mode,
- source analysis path is readable when available,
- suggestion `scenarioId` matches analysis `candidateScenarioId`,
- suggestion `comparisonRunId` matches analysis `comparisonRunId`,
- old/new evidence run ids match analysis targets,
- existing-scenario patches refer to an existing dictionary scenario,
- new-scenario candidates include page paths and upstream candidates,
- background candidates are not included as new-scenario upstream candidates.

Validation returns errors and warnings only. It does not apply suggestions.

## Scenario dictionary evidence

The scenario dictionary SOT stores reviewed evidence as comparison entries:

```json
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
```

Do not support baseline `evidence.layerA` / `evidence.layerB` formats. The package is pre-release, and the SOT uses the comparison evidence model directly.

## Review workflow

`review.html` is a candidate endpoint curation / handback viewer. It reads all suggestion artifacts under `.pi-api-audit-runs/candidates/`, including suggestions whose comparison evidence has not yet been accepted into the scenario dictionary SOT. Its old/new endpoint tables are for deciding what to add to `browserApiAllowlist.old/new` and `upstreamApiCandidates.old/new`; they are not old/new behavior-diff tables. Use `index.html` report mode for behavior comparison.

Recommended human/LLM review order:

1. Review the suggestion artifact first.
2. Inspect the analysis artifact to understand endpoint summaries and hints.
3. Inspect the comparison artifact to confirm old/new grouping and browser page context.
4. Inspect raw run manifests/exchanges only when the summary is suspicious or body-level review is required.
5. If accepted, update the workspace/repo-owned scenario dictionary explicitly through normal review.

Review questions:

- Does the page path match the intended scenario?
- Do `candidateMatches` align with expected browser/upstream APIs?
- Are `possibleAdditionalUpstream` endpoints core scenario behavior or surrounding page traffic?
- Are `backgroundCandidates` correctly excluded from core candidates?
- Does the evidence support adding a comparison lineage entry to the scenario dictionary?
- In `review.html`, should each observed old/new endpoint be kept as a scenario dictionary candidate, or excluded as background/noise?

## Report guidance

A report/review implementation should:

- start from the workspace/repo-owned scenario dictionary,
- read `evidence.comparisons[]`,
- load each comparison artifact,
- load matching analysis artifacts when available,
- use Layer A browser context for page/flow provenance,
- use Layer B upstream exchanges and analysis summaries for backend behavior evidence,
- treat classification hints as deterministic hints, not semantic proof,
- not infer parity solely from endpoint names,
- not read archived pre-comparison artifacts unless explicitly asked.

## Drift guardrails

Update this document whenever changing any of the following:

- comparison artifact shape,
- analysis artifact shape,
- endpoint normalization rules,
- classification hint names or thresholds,
- suggestion generation logic,
- suggestion validation logic,
- scenario dictionary evidence shape,
- report assumptions about Layer A/B or artifact responsibilities.

Also update related files as needed:

- `artifact-schema.md` for artifact shape changes,
- `scenario-dictionary.md` for SOT shape changes,
- active milestone docs for scope/status changes,
- tests for deterministic behavior changes.

Behavior tests such as `comparison-analysis.test.ts`, `scenario-suggestion.test.ts`, `scenario-suggestion-validation.test.ts`, and `scenario-dictionary.test.ts` are the primary drift guards. The docs presence test ensures this file keeps naming the core pipeline concepts and hints.
