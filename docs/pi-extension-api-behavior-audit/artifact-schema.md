# API behavior audit artifact schema

This document explains the artifact contract for `pi-extension-api-behavior-audit`.

For end-to-end pipeline semantics and deterministic analysis/suggestion rules, see `evidence-pipeline.md`.

The machine-readable source of truth is the package JSON Schema set:

```text
packages/pi-extension-api-behavior-audit/schemas/manifest.v1.schema.json
packages/pi-extension-api-behavior-audit/schemas/exchange.v1.schema.json
packages/pi-extension-api-behavior-audit/schemas/comparison-run.v1.schema.json
```

Runtime loaders in `src/artifact-schema.ts` validate artifacts against those schemas. This markdown file is the human-readable explanation, not the source of truth.

The current schema version is:

```json
"artifactVersion": 1
```

Artifacts are local, sanitized evidence. They are not intended to be committed to git.

## Model

- A run artifact is an atomic evidence unit for one target recording window.
- A comparison artifact groups multiple target run artifacts that should be analyzed together.
- Scenario dictionary entries remain the reviewed long-term source of truth for scenario interpretation.

MVP discovery uses one comparison artifact to bind an old run and a new run while keeping each target's exchanges separate.

## Run directory layout

Each capture run writes a directory under the configured artifact root, normally `.pi-api-audit-runs`:

```text
.pi-api-audit-runs/<run-id>/
├── manifest.json
└── exchanges.ndjson
```

Roles:

- `manifest.json` — run-level metadata, provenance, scope, and redaction policy.
- `exchanges.ndjson` — request/response evidence; one API exchange per line.

Comparison grouping artifacts are written separately:

```text
.pi-api-audit-runs/comparisons/<comparison-run-id>.json
```

A report generator must read artifacts through the validated loaders, not by direct `JSON.parse`:

```ts
loadCaptureManifest(path)
loadApiExchanges(path)
loadValidatedRun(runDir, { verifyExchangeCount: true })
loadComparisonRun(path)
```

The loader reads `manifest.json` first to understand context, then reads `exchanges.ndjson` for evidence. For comparison analysis, load the comparison artifact first, then load each referenced run.

## `manifest.json`

### Purpose

`manifest.json` answers:

- What produced this run?
- Which layer was captured?
- Which scenario(s) does it claim to cover?
- Which side (`old` or `new`) does it represent when applicable?
- How many exchanges were captured?
- Which redaction policy was applied?

### Required fields

```ts
interface CaptureManifestV1 {
  runId: string;
  createdAt: string;
  artifactVersion: 1;
  redaction: {
    marker: string;
    policy: string;
  };
  scenarios: string[];
}
```

Field rules:

- `runId` must match the run directory name.
- `createdAt` must be an ISO timestamp.
- `artifactVersion` is currently `1`.
- `redaction.marker` is currently `[REDACTED]`.
- `redaction.policy` is currently `default-v1`.
- `scenarios` lists scenario ids, not full scenario definitions.

### Common optional fields

```ts
interface CaptureManifestV1Optional {
  layer?: "browser-visible" | "upstream";
  startedAt?: string;
  finishedAt?: string;
  exchangeCount?: number;
  comparisonRunId?: string;
  notes?: string[];
}
```

Rules:

- `layer` should be present for all capture runs.
- `exchangeCount` should equal the number of non-empty lines in `exchanges.ndjson` after the run is complete.
- Active long-running proxy runs may update `exchangeCount` incrementally.
- `notes` must not contain secrets or raw payloads.

### Layer A fields

Browser-visible runs may include:

```ts
interface BrowserVisibleManifestFields {
  targets?: {
    oldBaseUrl: string;
    newBaseUrl: string;
  };
  scenarioSnapshots?: CaptureScenario[];
}
```

Layer A meaning:

```text
old browser page -> old browser-visible API
new browser page -> new browser-visible API
```

Layer A is validation evidence only. It must not be presented as final backend parity evidence.

### Layer B fields

Recording proxy runs may include:

```ts
interface RecordingProxyManifestFields {
  recordingProxy?: {
    side: "old" | "new";
    listenUrl: string;
    targetBaseUrl: string;
    scenarioId: string;
  };
}
```

Layer B meaning:

```text
local app/proxy -> recording proxy -> upstream/backend target
```

Layer B artifacts are the primary evidence surface for backend behavior audit.

## Comparison artifact

Comparison artifacts answer:

- Which target run artifacts should be analyzed together?
- Which candidate scenario does the group represent?
- Which discovery session produced the group?

Shape:

```ts
interface ComparisonRunArtifactV1 {
  version: 1;
  kind: "api-behavior-comparison-run";
  comparisonRunId: string;
  candidateScenarioId: string;
  discoverySessionId?: string;
  createdAt: string;
  updatedAt?: string;
  targets: Record<string, {
    targetId: string;
    side: "old" | "new";
    variant?: string;
    runId: string;
    manifestPath: string;
    exchangesPath?: string;
    browserContext?: {
      page?: CandidatePageContext;
      browserVisibleRequests?: BrowserVisibleApiObservation[];
    };
  }>;
}
```

Rules:

- `comparisonRunId` binds related target runs without merging their exchanges.
- Each referenced target run manifest should include the same `comparisonRunId`.
- `runId` / `manifestPath` / `exchangesPath` point to the target's formal upstream evidence run in the current discovery MVP.
- `browserContext` is the first-class Layer A scenario/provenance anchor for that target.
- MVP discovery expects `old` and `new` target keys for a complete comparison.
- Future N-target comparison can add more target keys without changing the atomic run model.

## `exchanges.ndjson`

### Purpose

`exchanges.ndjson` answers:

- Which API calls actually happened?
- What request was sent?
- What response was received?
- How long did it take?
- Which capture source observed it?

Each non-empty line is a complete JSON object conforming to `ApiExchangeV1`.

### Required exchange fields

```ts
interface ApiExchangeV1 {
  runId: string;
  layer: "browser-visible" | "upstream";
  side: "old" | "new";
  scenarioId: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, unknown>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, unknown>;
    body: unknown;
  };
  timing: {
    startedAt: string;
    durationMs: number;
  };
  provenance: {
    source: "playwright" | "recording-proxy";
    pageUrl?: string;
  };
}
```

Rules:

- `runId` must match the containing manifest.
- `layer` must match the manifest layer.
- `side` identifies old/new behavior.
- `scenarioId` must correspond to a known scenario dictionary entry.
- `request.url` is the observed URL after redaction.
- `response.body` should preserve structure where possible.
- `provenance.source` identifies the collector.
- `provenance.pageUrl` is expected for Playwright browser-visible exchanges.

## Redaction requirements

All artifacts must be sanitized before writing to disk.

Required redaction categories:

- Headers named or containing sensitive concepts:
  - `authorization`
  - `cookie`
  - `set-cookie`
  - `x-csrf-token`
  - `x-xsrf-token`
  - header names containing `token`, `session`, `csrf`, `password`, `passwd`, `authorization`, `cookie`, or `secret`
- Query parameters whose names contain:
  - `password`, `passwd`, `token`, `secret`, `cookie`, `session`, `authorization`, `csrf`
- JSON-like body keys containing the same sensitive terms.
- URL-like string values with sensitive query parameters.
- JSON-like string values containing nested sensitive fields.

The stable redaction marker is:

```text
[REDACTED]
```

## Versioning policy

Current artifact version:

```text
artifactVersion: 1
```

Backward-compatible changes within v1:

- Adding optional fields.
- Adding notes.
- Adding additional provenance metadata.
- Adding more aggressive redaction.

Requires a new artifact version:

- Removing required fields.
- Renaming required fields.
- Changing `exchanges.ndjson` from one exchange per line.
- Changing the meaning of `layer`, `side`, or `scenarioId`.
- Writing unsanitized payloads by design.

## Report generator expectations

A report generator must:

1. Use `src/artifact-schema.ts` validated loaders rather than direct raw JSON parsing.
2. Load `manifest.json`.
3. Verify `artifactVersion` is supported.
4. Verify `redaction.policy` is present.
5. Load `exchanges.ndjson` line-by-line.
6. Verify `exchangeCount` when requested for completed runs.
7. Prefer Layer B evidence when available.
8. Treat Layer A evidence as supporting context only.
9. Never claim full parity from a single scenario or partial evidence.
10. Include unknowns and provenance in generated reports.
