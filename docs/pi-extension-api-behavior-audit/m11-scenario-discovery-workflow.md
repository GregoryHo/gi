# M11 — Scenario discovery evidence collection workflow

## Status

Done.

## SPEC

### Scope

Make it easy to collect clean discovery evidence for candidate scenarios from real target-based website behavior without directly mutating the scenario dictionary source of truth.

M11 is now focused on evidence collection, not candidate generation. Candidate generation and validation move to M12.

M11 goals:

1. Keep discovery proxy sessions alive across multiple recordings.
2. Separate proxy lifecycle, browser lifecycle, and recording lifecycle.
3. Let users decide exactly when recording starts and finishes.
4. Preserve Layer A page/browser context and Layer B upstream evidence for later M12 analysis.
5. Avoid login/setup noise in scenario recording windows where practical.
6. Bind related old/new target runs with comparison grouping instead of merging their exchanges.

### Design conclusion — Layer A/B roles

The final product goal is still a backend API audit report, but Layer A should not be treated as disposable. The current agreed model is:

```text
Layer A = scenario/provenance anchor
Layer B = backend behavior evidence
recordingWindow = semantic boundary for the user's intended action
comparisonRunId = grouping key for old/new target evidence from the same attempt
```

Layer B upstream exchanges remain the primary audit evidence. Layer A page context and browser-visible observations explain which page/flow/action caused those backend calls. Without Layer A, a report would only show a backend trace without business context.

### Revised discovery workflow

Target workflow:

```text
create discovery session
-> open target browser
-> user logs in / navigates / prepares without recording
-> set candidate scenario id
-> start recording window
-> user performs scenario action
-> finish recording window
-> repeat for another target or scenario
-> stop discovery session
-> M12 analyzes captured artifacts into candidate scenario entries
```

### Why M11 changed

The first discovery flow used `/api-audit discover ...` subcommands and combined too many concerns:

```text
proxy session lifecycle + browser lifecycle + recording window lifecycle
```

That created user friction and artifact risk:

- Many flags/subcommands under one `/api-audit` command increased cognitive load.
- Browser-assisted capture opened a fresh browser inside the recording window, so login/setup APIs could become scenario noise.
- Multi-target capture originally began all recording windows before opening browsers, risking cross-target noise.
- Candidate generation cannot be reliable until the collection workflow captures clean Layer A context and Layer B evidence.

### M11.1 — Persistent discovery proxy lifecycle

Status: implemented for compatibility slash commands and in-memory session lifecycle.

Existing compatibility commands:

```bash
/api-audit discover start --profile uat --target candidate
/api-audit discover start --profile uat --group candidate-only
/api-audit discover status
/api-audit discover stop --session discovery-abc123
```

Behavior:

- Starts passthrough recorders for selected targets.
- Keeps recorders alive until explicitly stopped.
- Does not record exchanges by default.
- Returns a discovery session id.
- Shows per-target recorder URLs so local apps can be configured once.
- Does not modify scenario dictionary SOT.

### M11.2 — Isolated capture windows

Status: implemented for compatibility commands and recording-proxy window artifacts.

Existing compatibility command:

```bash
/api-audit discover capture \
  --session discovery-abc123 \
  --scenario-id account-activity-basic \
  --candidate-page-path /account/activity
```

Behavior:

- Uses an existing persistent discovery session.
- Arms recording only for a capture window.
- Keeps proxy session alive after the window.
- Produces one clean run artifact per capture window.
- Browser-assisted multi-target capture now records targets sequentially:

```text
begin old -> open/operate old browser -> finish old
begin new -> open/operate new browser -> finish new
```

Artifact metadata includes provenance such as:

```json
{
  "purpose": "scenario-discovery",
  "candidateScenarioId": "account-activity-basic",
  "discoverySessionId": "discovery-abc123",
  "recordingWindow": {
    "startedAt": "...",
    "finishedAt": "..."
  },
  "candidatePage": {
    "url": "http://localhost:8008/account/activity",
    "path": "/account/activity",
    "source": "playwright-page-url"
  }
}
```

### M11.3 — Top-level discovery commands

Status: implemented as MVP top-level pi commands.

Replace the primary UX for discovery with intent-specific top-level pi commands while keeping `/api-audit discover ...` as compatibility/advanced commands.

Proposed commands:

```bash
/api-discovery-create --profile uat [--target old --target new | --group default]
/api-discovery-status
/api-discovery-scenario forward-game-transfer
/api-discovery-open old
/api-discovery-record
/api-discovery-finish
/api-discovery-stop
```

Recommended user flow:

```bash
/api-discovery-create --profile uat
/api-discovery-scenario forward-game-transfer

/api-discovery-open old
# user logs in, navigates, prepares; no recording yet
/api-discovery-record
# user performs scenario action
/api-discovery-finish

/api-discovery-open new
# user logs in, navigates, prepares; no recording yet
/api-discovery-record
# user performs scenario action
/api-discovery-finish

/api-discovery-stop
```

MVP constraints:

- One active discovery session per pi process.
- One active browser target at a time.
- One active recording window at a time.
- If future multi-session support is needed, commands can add explicit session selection later.

Implemented commands:

- `/api-discovery-create`
- `/api-discovery-status`
- `/api-discovery-scenario`
- `/api-discovery-open`
- `/api-discovery-record`
- `/api-discovery-finish`
- `/api-discovery-stop`

### M11.4 — Stateful browser lifecycle

Status: planned.

Browser lifecycle should live outside recording windows:

```text
open browser -> login/navigation/preparation -> record -> scenario action -> finish
```

This reduces login/setup noise in scenario artifacts and gives users explicit control over recording boundaries.

Browser-assisted mode should preserve page context from the active browser at finish time.

### M11.5 — Browser-visible API evidence

Status: implemented for top-level `/api-discovery-record` to `/api-discovery-finish` windows.

During `/api-discovery-record` to `/api-discovery-finish`, capture Layer A browser-visible API evidence from the active Playwright page/context when available.

The MVP records sanitized response observations for `fetch`/`xhr` browser responses only:

- method,
- sanitized URL,
- path,
- status,
- source.

Current implementation note: these observations are captured as browser context alongside the upstream recording window, not as full independent Layer A `exchanges.ndjson` run artifacts. This is acceptable for the backend-report MVP because the immediate need is provenance and API-candidate anchoring, not browser-visible parity judgment.

This should provide M12 with:

- page URL/path context,
- browser-visible API candidates,
- upstream/backend API candidates from Layer B proxy artifacts.

### M11.6 — Comparison grouping artifact

Status: implemented as old/new MVP grouping.

Discovery keeps each target recording as an atomic run artifact, then binds related target runs with a comparison artifact:

```text
.pi-api-audit-runs/<run-id>/manifest.json
.pi-api-audit-runs/<run-id>/exchanges.ndjson
.pi-api-audit-runs/comparisons/<comparison-run-id>.json
```

Each target run manifest includes:

```json
{
  "comparisonRunId": "comparison-..."
}
```

The comparison artifact lists the target runs that should be analyzed together:

```json
{
  "version": 1,
  "kind": "api-behavior-comparison-run",
  "comparisonRunId": "comparison-...",
  "candidateScenarioId": "forward-game-transfer",
  "discoverySessionId": "discovery-...",
  "targets": {
    "old": {
      "targetId": "old",
      "side": "old",
      "runId": "2026-...",
      "manifestPath": ".pi-api-audit-runs/2026-.../manifest.json"
    },
    "new": {
      "targetId": "new",
      "side": "new",
      "runId": "2026-...",
      "manifestPath": ".pi-api-audit-runs/2026-.../manifest.json"
    }
  }
}
```

MVP constraints:

- One comparison run per discovery session.
- One old run and one new run are the intended complete pair.
- Re-recording should start a new discovery session for now.
- N-target grouping remains a future extension of the same comparison artifact model.

### M11.7 — First-class browser context in comparison artifact

Status: implemented as minimal comparison `browserContext` fields.

M11.6 introduced comparison grouping, but the comparison artifact primarily referenced upstream target runs. M11.7 promotes Layer A context to an explicit place in the comparison artifact while keeping Layer B as formal upstream run evidence.

```json
{
  "comparisonRunId": "comparison-...",
  "targets": {
    "old": {
      "runId": "2026-...",
      "manifestPath": ".pi-api-audit-runs/2026-.../manifest.json",
      "exchangesPath": ".pi-api-audit-runs/2026-.../exchanges.ndjson",
      "browserContext": {
        "page": {
          "url": "http://localhost:8080/account/activity",
          "path": "/account/activity",
          "source": "playwright-page-url"
        },
        "browserVisibleRequests": []
      }
    }
  }
}
```

This preserves the agreed roles:

- Layer A context is first-class report provenance.
- Layer B upstream runs remain the primary backend behavior evidence.
- Old/new exchanges are not merged into one run.

Implementation note: the current comparison target keeps upstream run fields flat (`runId`, `manifestPath`, `exchangesPath`) and adds optional `browserContext`. A nested `upstream` object can be revisited later if needed, but is not required for the current MVP.

### Deferred beyond M11 MVP

The following are intentionally deferred and should not block the current backend-report MVP:

- Full formal Layer A run artifacts with their own `manifest.json` and `exchanges.ndjson` for every discovery target.
- Browser-visible request/response body capture for parity analysis.
- LLM-driven automatic decision of when to start/finish recording; current commands let the user decide explicitly.
- Multiple comparison attempts inside one active discovery session.
- N-target comparison UI and analysis beyond old/new MVP.

### Compatibility baseline

Existing commands/tools remain for now:

- `/api-audit discover start/status/stop/capture`
- `/api-audit discover --scenario-id ...`
- `/api-audit discover --run --session ...`
- `api_audit_prepare_scenario_discovery`
- `api_audit_run_scenario_discovery`

They are compatibility/advanced paths. New top-level commands should become the recommended user workflow.

### Non-goals

- No automatic writes to `scenarios/default.scenarios.json`.
- No auto-commit of scenario dictionary changes.
- No write/destructive user flows.
- No LLM-only endpoint mapping decisions.
- No candidate generation in M11; that is M12.
- No single huge mixed artifact file for a long-lived proxy session.

## AC

- Discovery sessions can be created, listed, and stopped explicitly.
- Discovery proxies remain alive across multiple recording windows.
- Browser lifecycle can be opened before recording starts.
- Users can start and finish recording windows explicitly.
- Each recording window creates isolated sanitized artifacts.
- Recording artifacts include discovery session, comparison run, target, candidate scenario, recording window, page context, and browser-visible API observations when available.
- A comparison artifact binds related old/new target runs without merging their exchanges.
- Browser-assisted multi-target capture does not cross-record targets.
- Scenario dictionary SOT is modified only through explicit code/file review, not directly by discovery tools.

## Completion notes

M11 completed after manual smoke validation of the default `account-activity-basic` scenario using the top-level discovery flow.

Validated comparison artifact:

```text
.pi-api-audit-runs/comparisons/comparison-2026-05-26T06-53-01-380Z.json
```

Referenced target runs:

```text
old: .pi-api-audit-runs/2026-05-26T06-54-31-301Z/
new: .pi-api-audit-runs/2026-05-26T06-55-18-846Z/
```

Observed:

- Both target runs share `comparisonRunId: comparison-2026-05-26T06-53-01-380Z`.
- Both target browser contexts reported page path `/account/activity`.
- Old upstream run captured 106 exchanges and included expected candidate `/v1/account/activity`.
- New upstream run captured 11 exchanges and included expected candidate `/apis/account/activity`.
- Schema-backed validation passed for the comparison artifact and both referenced runs with exchange-count verification.

Verification commands passed during M11 implementation:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
