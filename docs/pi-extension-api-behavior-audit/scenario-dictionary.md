# API behavior audit scenario dictionary

The scenario dictionary defines the QA/page scenarios that anchor capture runs and reports.

For the full raw run → comparison → analysis → suggestion → validation → accepted evidence pipeline, see `evidence-pipeline.md`.

The source of truth is workspace/repo-owned scenario dictionary JSON. The conventional local path used by runtime commands/tools is:

```text
<workspace-root>/.pi-api-audit-runs/scenarios.local.json
```

The package does not provide a runtime default scenario dictionary. Package scenario files, if any, are examples or tests only and must not be used as fallback business context.

The machine-readable schema is:

```text
packages/pi-extension-api-behavior-audit/schemas/scenario-dictionary.v1.schema.json
```

Runtime loaders in `src/scenario-dictionary.ts` validate caller/workspace-provided dictionaries against that schema and derive capture manifests from `browserApiAllowlist`. This markdown file is the human-readable explanation, not the source of truth.

It answers:

- Which user-facing scenario is being audited?
- Which old/new pages trigger it?
- Which browser-visible APIs are expected?
- Which upstream/backend API candidates have been observed?
- Which evidence supports the mapping?

## Why this exists

Without a scenario dictionary, report generation would have to infer intent from raw API traffic. That is unsafe because page loads include many unrelated initialization calls.

The dictionary lets us connect evidence to a scenario:

```text
scenario -> page action -> browser-visible API -> upstream/backend API candidates -> evidence runs
```

## Current dictionary shape

Example:

```json
{
  "version": 1,
  "scenarios": [
    {
      "id": "account-activity-basic",
      "feature": "Account activity",
      "description": "查詢Account activity列表",
      "type": "read-only",
      "page": {
        "oldPath": "/account/activity",
        "newPath": "/account/activity"
      },
      "browserApiAllowlist": {
        "old": ["/apis/account/activity"],
        "new": ["/gateway/apis/account/activity"]
      },
      "upstreamApiCandidates": {
        "old": ["/v1/account/activity"],
        "new": ["/apis/account/activity"]
      },
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
      },
      "notes": [
        "Layer B endpoint mapping is observed from reviewed comparison evidence.",
        "Do not claim full parity from this scenario alone."
      ]
    }
  ]
}
```

## Required scenario fields

```ts
interface ScenarioDictionaryEntryV1 {
  id: string;
  feature: string;
  description: string;
  type: "read-only";
  page: {
    oldPath: string;
    newPath: string;
  };
  browserApiAllowlist: {
    old: string[];
    new: string[];
  };
  upstreamApiCandidates?: {
    old: string[];
    new: string[];
  };
  evidence?: {
    comparisons: Array<{
      comparisonRunId: string;
      targets: {
        old: string;
        new: string;
      };
      acceptedAt?: string;
      notes?: string[];
    }>;
  };
  notes?: string[];
}
```

Rules:

- `id` must be stable and unique.
- `feature` should use the QA/product name when known.
- `description` should describe user intent, not implementation.
- `type` is currently `read-only`; write/destructive flows need explicit new safety rules before support.
- `page.oldPath` and `page.newPath` identify page navigation targets.
- `browserApiAllowlist` identifies browser-visible APIs for Layer A capture.
- `upstreamApiCandidates` identifies observed backend/upstream endpoint candidates for Layer B audit.
- `evidence.comparisons` records reviewed old/new comparison evidence that supports the scenario definition.
- `notes` must include uncertainty and safety caveats.

## How `account-activity-basic` was derived

### 1. Product/QA choice

The first scenario was chosen manually:

```text
/account/activity — Account activity
```

Reasoning:

- read-only,
- low destructive risk,
- valuable for QA,
- likely to expose date range, pagination, sort, and transaction type differences.

### 2. Layer A evidence

Layer A browser-visible capture observed:

```text
old: /apis/account/activity
new: /gateway/apis/account/activity
```

In the current dictionary evidence model, accepted lineage is stored through reviewed comparison ids rather than standalone Layer A run labels. Layer A page/browser context lives in the referenced comparison artifact and anchors the backend evidence to the page/flow.

### 3. Layer B evidence

Layer B discovery capture observed:

```text
old upstream: /v1/account/activity
new upstream: /apis/account/activity
```

Accepted comparison evidence:

```text
comparison: comparison-2026-05-26T06-53-01-380Z
old run: 2026-05-26T06-54-31-301Z
new run: 2026-05-26T06-55-18-846Z
```

Both target responses exposed top-level fields:

```text
Items, Others, Pager
```

Observed request differences include:

- old uses `time=d`, `type=period`, `typecodes=`, and an empty `po` in this smoke.
- new uses `po=desc` in this smoke.
- both use date range and pagination parameters (`starttime`, `endtime`, `pi`, `ps`).

## Maintenance rules

### Adding a scenario

1. Start from a QA/page scenario, not from a random endpoint.
2. Prefer read-only scenarios first.
3. Add page paths.
4. Add Layer A browser-visible allowlists only after observation or code inspection.
5. Add Layer B upstream candidates only after recording proxy evidence.
6. Record accepted comparison ids and old/new run ids in `evidence.comparisons` after review.
7. Add notes explaining uncertainty.

### Updating endpoint candidates

Endpoint candidates may change as more evidence is collected.

When updating `upstreamApiCandidates`:

- Keep the old candidate in notes if it was superseded.
- Add the new supporting comparison evidence.
- Do not silently remove evidence lineage.
- Do not mark mappings as authoritative unless product/backend owners confirm.

### Evidence comparisons

Use reviewed comparison evidence entries:

```json
{
  "comparisonRunId": "comparison-2026-05-26T06-53-01-380Z",
  "targets": {
    "old": "2026-05-26T06-54-31-301Z",
    "new": "2026-05-26T06-55-18-846Z"
  },
  "notes": ["Accepted from scenario suggestion review."]
}
```

The comparison artifact contains Layer A browser context and Layer B upstream run references. The scenario dictionary only records reviewed evidence lineage; raw artifacts stay under `.pi-api-audit-runs/`.

### Report generator expectations

A report generator should:

- Use `src/scenario-dictionary.ts` validated loaders rather than raw JSON parsing.
- Use `upstreamApiCandidates` to locate target exchanges.
- Fall back to evidence discovery only with an explicit warning.
- Prefer Layer B evidence over Layer A evidence.
- Include the scenario dictionary entry or a snapshot in the report.
- Treat mappings as candidates unless confirmed.
- Include unknowns and missing coverage.

## Known limitations of `account-activity-basic`

Current evidence is enough for a preliminary report, but not full parity:

- only one scenario,
- default date range,
- default pagination,
- no transaction type filter variants,
- no non-empty transaction item schema comparison if `Items` is empty/null,
- no error or unauthorized cases,
- no product-owner-confirmed endpoint mapping.
