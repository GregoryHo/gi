# M6 — Artifact schema and scenario dictionary governance

## Status

Done.

## SPEC

### Scope

Formalize the data contracts and maintenance rules for the artifacts produced by this extension before adding report generation.

M6 was reopened after review because docs alone are not enough: machine-readable schemas and the scenario dictionary must be sources of truth that runtime loaders validate against.

M6 exists to make M7 audit report generation depend on documented and validated evidence contracts instead of implicit code-shaped assumptions.

Deliverables:

- Versioned JSON Schema files as machine-readable source of truth:
  - `schemas/manifest.v1.schema.json`
  - `schemas/exchange.v1.schema.json`
  - `schemas/scenario-dictionary.v1.schema.json`
- Default scenario dictionary JSON as scenario source of truth:
  - `scenarios/default.scenarios.json`
- Deterministic runtime loaders/validators for manifests, exchanges, and scenario dictionaries.
- `artifact-schema.md` documenting:
  - run directory layout,
  - `manifest.json` schema,
  - `exchanges.ndjson` / `ApiExchange` schema,
  - Layer A vs Layer B field expectations,
  - redaction requirements,
  - artifact versioning policy.
- `scenario-dictionary.md` documenting:
  - scenario dictionary purpose,
  - `account-activity-basic` origin and evidence lineage,
  - scenario fields and maintenance rules,
  - browser-visible vs upstream API mapping candidates,
  - how future scenarios should be added.
- Example scenario dictionary file for account-activity.
- Milestone/roadmap/index updates that move report generation to M7.

### Non-goals

- No report generator implementation.
- No new capture commands.
- No changes to artifact runtime format unless the documentation or validators expose a critical safety issue.
- No complete OpenAPI/schema validator.
- No LLM-assisted validation; validation must be deterministic code.
- No parity decisions.

### Source-of-truth decision

```text
JSON Schema files = machine-readable SOT
scenario dictionary JSON = scenario SOT
TypeScript types = implementation mirror
Markdown docs = human explanation
```

M7 report generation must consume schema-backed loaders, not raw `JSON.parse` results.

### Design notes

The docs and validators should be precise enough that a deterministic report generator can later read artifacts and know:

- which fields are required,
- which fields are layer-specific,
- how to find provenance,
- how to interpret scenario mappings,
- what must be treated as unknown.

M6 should keep the current `artifactVersion: 1` format and define a backward-compatible policy for additions.

### Expected files

Docs:

- `docs/pi-extension-api-behavior-audit/artifact-schema.md`
- `docs/pi-extension-api-behavior-audit/scenario-dictionary.md`
- `docs/pi-extension-api-behavior-audit/m6-artifact-schema-scenario-dictionary.md`

Examples/data:

- `packages/pi-extension-api-behavior-audit/examples/account-activity.scenarios.json`
- `packages/pi-extension-api-behavior-audit/scenarios/default.scenarios.json`
- `packages/pi-extension-api-behavior-audit/schemas/manifest.v1.schema.json`
- `packages/pi-extension-api-behavior-audit/schemas/exchange.v1.schema.json`
- `packages/pi-extension-api-behavior-audit/schemas/scenario-dictionary.v1.schema.json`

Runtime:

- `packages/pi-extension-api-behavior-audit/src/schema-validation.ts`
- `packages/pi-extension-api-behavior-audit/src/artifact-schema.ts`
- `packages/pi-extension-api-behavior-audit/src/scenario-dictionary.ts`

## AC

Acceptance criteria:

- Artifact schema docs distinguish `manifest.json` from `exchanges.ndjson` and explain each role.
- Required and optional manifest fields are documented.
- Required `ApiExchange` fields are documented.
- Layer A-only and Layer B-only expectations are documented.
- Redaction and security requirements are explicit.
- Scenario dictionary docs explain how `account-activity-basic` was derived from product choice, Layer A evidence, and Layer B evidence.
- Scenario dictionary docs include the observed endpoint mapping:
  - old upstream candidate `/v1/account/activity`
  - new upstream candidate `/apis/account/activity`
- Future scenario maintenance rules are documented.
- M7 report generation is explicitly deferred until after M6.
- Machine-readable JSON Schema files are included in the package.
- Runtime loaders validate `manifest.json`, `exchanges.ndjson`, and scenario dictionaries deterministically.
- Runtime loaders reject unsupported artifact/schema versions.
- Runtime loaders verify `manifest.exchangeCount` matches `exchanges.ndjson` line count for completed runs when requested.
- Default `account-activity-basic` is derived from the default scenario dictionary SOT, not maintained as a separate hand-coded copy.
- Existing M5 artifacts can be loaded by validators.
- Invalid manifest/exchange/scenario dictionary tests fail for the expected reasons.
- M7 must be documented as depending on these validated loaders.

Verification commands:

```bash
python3 -m json.tool packages/pi-extension-api-behavior-audit/examples/account-activity.scenarios.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/scenarios/default.scenarios.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/schemas/manifest.v1.schema.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/schemas/exchange.v1.schema.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/schemas/scenario-dictionary.v1.schema.json >/dev/null
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

## Status tracking

At completion:

1. Run verification commands.
2. Change M6 status to `Done`.
3. Append verification evidence to `log.md`.
4. Commit docs, schemas, examples, and validators together.

## Completion notes

Implemented after reopening:

- Versioned JSON Schema files:
  - `schemas/manifest.v1.schema.json`
  - `schemas/exchange.v1.schema.json`
  - `schemas/scenario-dictionary.v1.schema.json`
- Default scenario dictionary SOT:
  - `scenarios/default.scenarios.json`
- Deterministic schema-backed runtime loaders:
  - `src/artifact-schema.ts`
  - `src/scenario-dictionary.ts`
  - `src/schema-validation.ts`
- Write-time artifact validation in `writeManifest` and `appendExchange`.
- Default `account-activity-basic` capture manifest is derived from the default scenario dictionary SOT.
- Existing M5 artifacts were validated with `loadValidatedRun(..., { verifyExchangeCount: true })`:
  - old `2026-05-25T06-58-22-572Z`: 129 exchanges
  - new `2026-05-25T06-58-22-580Z`: 33 exchanges

Verification passed on 2026-05-25:

```bash
python3 -m json.tool packages/pi-extension-api-behavior-audit/examples/account-activity.scenarios.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/scenarios/default.scenarios.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/schemas/manifest.v1.schema.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/schemas/exchange.v1.schema.json >/dev/null
python3 -m json.tool packages/pi-extension-api-behavior-audit/schemas/scenario-dictionary.v1.schema.json >/dev/null
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Previous completion notes

Implemented before reopening:

- `artifact-schema.md` defining run layout, `manifest.json`, `exchanges.ndjson`, Layer A/B expectations, redaction requirements, and artifact versioning policy.
- `scenario-dictionary.md` defining scenario dictionary shape, maintenance rules, and the lineage of `account-activity-basic`.
- `packages/pi-extension-api-behavior-audit/examples/account-activity.scenarios.json` as a concrete example with observed Layer A and Layer B evidence.
- Milestone roadmap updated so audit report generation is M7.

Previous verification passed on 2026-05-25:

```bash
python3 -m json.tool packages/pi-extension-api-behavior-audit/examples/account-activity.scenarios.json >/dev/null
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
