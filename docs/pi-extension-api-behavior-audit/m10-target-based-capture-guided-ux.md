# M10 — Target-based capture model and guided UX

## Status

Done.

## SPEC

### Problem

The current model still uses old/new terminology and a fixed two-target capture rhythm:

```text
old frontend + old backend target
new frontend + new backend target
```

That was useful for MVP validation, but it creates three product problems:

1. `old`/`new` are too narrow for generic API audit workflows.
2. Users may configure more than two environments or implementations, then choose only a subset for a given audit.
3. Commands are becoming too long and flag-heavy; common usage should be guided by pi widgets rather than memorized command strings.

### Scope

Introduce a target-based capture model and guided UX while keeping backward-compatible old/new wrappers during migration.

Implementation is staged to reduce risk:

1. Target-based profile/scenario resolution and target listing/prepare tools. — Done
2. Widget-friendly `/api-audit setup` and `/api-audit capture` preparation entrypoints. — Done
3. N-target capture execution helpers. — Done
4. Target-aware artifact metadata and recording proxy integration. — Done for v1-compatible metadata and real recorder defaults
5. Target-based run entrypoints. — Done
6. Dashboard widget summary. — Done
7. Full custom overlay wizard UX. — Deferred

M10 should move the conceptual model from:

```text
scenarioId + old/new pair
```

to:

```text
scenarioId + profileName + selected target ids
```

### Proposed profile model

Move environment profiles toward target collections:

```json
{
  "version": 2,
  "profiles": {
    "uat": {
      "targets": {
        "baseline": {
          "variant": "baseline",
          "frontendUrl": "http://localhost:8080",
          "upstreamTargetUrl": "http://old-api.example.test",
          "recorderPort": 18080,
          "allowHosts": ["old-api.example.test"]
        },
        "candidate": {
          "variant": "candidate",
          "frontendUrl": "http://localhost:8008",
          "upstreamTargetUrl": "https://new-api.example.test",
          "recorderPort": 18081,
          "allowHosts": ["new-api.example.test"]
        }
      },
      "groups": {
        "default": ["baseline", "candidate"],
        "all": ["baseline", "candidate"],
        "candidate-only": ["candidate"]
      }
    }
  },
  "defaultProfile": "uat"
}
```

M9 v1 profiles should be migrated or treated as compatibility input:

```text
oldUrl/newUrl -> target ids baseline/candidate or old/new compatibility aliases
oldTargetUrl/newTargetUrl -> target upstreamTargetUrl values
oldProxyPort/newProxyPort -> target recorderPort values
```

### Proposed scenario dictionary model

Move scenario dictionary from old/new paths to variant-specific behavior:

```json
{
  "id": "account-activity-basic",
  "variants": {
    "baseline": {
      "pagePath": "/account/activity",
      "browserApiAllowlist": ["/apis/account/activity"],
      "upstreamApiCandidates": ["/v1/account/activity"]
    },
    "candidate": {
      "pagePath": "/account/activity",
      "browserApiAllowlist": ["/gateway/apis/account/activity"],
      "upstreamApiCandidates": ["/apis/account/activity"]
    }
  }
}
```

A target references a scenario variant. Multiple targets can share one variant.

Examples:

```text
baseline-uat -> variant baseline
candidate-uat -> variant candidate
candidate-local-experiment -> variant candidate
```

### Proposed artifact model

Introduce artifact v2 fields while maintaining compatibility readers for v1:

```json
{
  "targetId": "baseline",
  "variant": "baseline"
}
```

The old `side: "old" | "new"` field becomes compatibility-only for v1 artifacts.

### Capture rhythm

A capture session should be defined by:

```text
scenarioId + profileName + selectedTargetIds
```

Flow:

1. Load profile and scenario dictionary.
2. Resolve selected target ids from explicit selection or profile group.
3. Show a widget summary of targets, variants, frontend URLs, recorder ports, and upstream targets.
4. Start recorders only for selected targets.
5. Show app config instructions per selected target.
6. Confirm readiness.
7. Run Playwright page actions for each selected target.
8. Stop recorders.
9. Validate artifacts.
10. Show a target-based summary widget.

### Implemented commands

Keep advanced flags available, but make common commands short:

```text
/api-audit
/api-audit setup
/api-audit capture
```

- `/api-audit` shows a dashboard widget with profiles, scenarios, recent runs, and available actions.
- `/api-audit setup` shows widget-friendly setup guidance.
- `/api-audit capture` supports scenario/profile/target selection through flags:
  - choose profile with `--profile`,
  - choose scenario with `--scenario-id`,
  - choose target group or individual targets with `--group` / `--target`,
  - prepare by default or run with `--run`.

Existing verbose commands remain compatibility/advanced paths.

### Proposed tools

Potential target-based tools:

- `api_audit_list_targets`
- `api_audit_prepare_target_capture`
- `api_audit_run_target_capture`

Existing old/new tools remain as wrappers during migration.

### Non-goals

- No scenario discovery in M10.
- No audit report generation.
- No destructive/write API flows.
- No automatic app config mutation.
- No removal of existing old/new commands until compatibility is proven.

## Progress notes

First implementation slice completed:

- `src/target-capture.ts` resolves target-based capture plans.
- Supports profile config v2 target collections for planning.
- Supports v1 old/new profile + scenario compatibility mapping.
- Supports selected target ids and target groups.
- Adds natural-language tools:
  - `api_audit_list_targets`
  - `api_audit_prepare_target_capture`
- Adds widget-friendly commands:
  - `/api-audit setup`
  - `/api-audit capture --scenario-id <id> --profile <name> [--target <id> | --group <name>]`

- Adds N-target execution helper:
  - `runTargetCapture`
  - starts all selected target recorders through injected deps
  - runs page actions for each selected target
  - stops recorders in `finally`
  - reports no-exchange warnings per target

- Adds v1-compatible target artifact metadata:
  - `targetId` / `variant` optional fields on exchanges
  - `recordingProxy.targetId` / `recordingProxy.variant` optional fields on manifests
  - recording proxy writes the metadata when supplied

- Adds target-based run entrypoints:
  - `api_audit_run_target_capture`
  - `/api-audit capture --run --scenario-id <id> --profile <name> [--target <id> | --group <name>]`
- `runTargetCapture` now has default real recording proxy and Playwright page-action dependencies while preserving injectable test deps.

- Adds `/api-audit` dashboard widget summary:
  - profiles and default profile
  - built-in scenario ids
  - recent local artifact runs
  - recommended setup/capture/run actions

M10 completion notes:

- Manual testing accepted by user.
- Full custom overlay wizard UX is deferred.
- The current setWidget dashboard/setup/capture flow is the M10 MVP.

## AC draft

- Profile loader supports target-based profile shape.
- Scenario dictionary loader supports variant-based scenario shape.
- v1 old/new profiles and scenarios remain readable through compatibility mapping.
- Capture can run one target, two targets, or N selected targets from a profile.
- Capture can select a group such as `default`, `all`, or a custom group.
- Artifact writer records `targetId` and `variant` for target-based captures.
- `/api-audit` dashboard widget summarizes profiles/scenarios/actions.
- `/api-audit setup` provides widget-friendly profile/target setup guidance.
- `/api-audit capture` provides widget-friendly scenario/profile/target selection and run preparation via flags.
- Existing M9 profile commands and M8 generic tools remain compatible.
