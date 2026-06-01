# API behavior audit pi extension

pi package for collecting and auditing baseline versus candidate backend API behavior.

## Status

v0.2.2 is the current local release. It adds programmatic capture lifecycle, bounded automation, review guidance, persistent proxy/window tools, and path-based passthrough routes for legacy local services whose frontend/static paths must not be sent to the API upstream recorder. Roadmap and milestone docs live in [`../../docs/pi-extension-api-behavior-audit`](../../docs/pi-extension-api-behavior-audit).

## Goal

The long-term goal is backend API behavior comparison:

```text
old browser page -> old Go web API/proxy -> baseline backend API
new browser page -> candidate web/API gateway -> backend API gateway
```

The first runnable iterations may validate collection at the browser-visible API layer, but the product direction remains backend/upstream behavior evidence.

## Load or install

Load temporarily while developing:

```bash
pi -e ./packages/pi-extension-api-behavior-audit
```

Install as a local pi package:

```bash
pi install ./packages/pi-extension-api-behavior-audit
```

## Tools and commands

The extension registers natural-language-callable pi tools:

- `api_audit_list_scenarios` — list scenario dictionary entries.
- `api_audit_validate_run` — validate a run directory with schema-backed loaders.
- `api_audit_review_capture` — build or queue review slash commands and point users to the local `review.html` viewer.
- `api_audit_prepare_account_history_upstream_capture` — prepare recorder/app configuration guidance for account-activity.
- `api_audit_run_account_history_upstream_capture` — run the interactive account-activity upstream capture flow.
- `api_audit_prepare_upstream_capture` — prepare recorder/app guidance for any known scenario id.
- `api_audit_run_upstream_capture` — run interactive upstream capture for any known scenario id.
- `api_audit_show_environment_profiles` — show saved local environment profiles.
- `api_audit_save_environment_profile` — save reusable non-secret old/new frontend/backend URLs.
- `api_audit_clear_environment_profile` — remove a saved local environment profile.
- `api_audit_list_targets` — list target-based capture targets for a scenario/profile/group.
- `api_audit_prepare_target_capture` — prepare target-based capture instructions without starting proxies/browsers.
- `api_audit_run_target_capture` — run target-based capture with recorders and Playwright manual-auth flow.
- `api_audit_start_capture` — start selected upstream recorders only and return a `captureSessionId`, run dirs, and proxy URLs.
- `api_audit_stop_capture` — stop/finalize a live capture session and report final exchange counts/manifest paths.
- `api_audit_list_active_captures` — list live programmatic capture sessions in the current pi extension runtime.
- `api_audit_run_automated_capture` — start recorders, run a bounded workspace `automationScript`, then stop/finalize artifacts automatically.
- `api_audit_start_proxy_session` / `api_audit_start_recording_window` / `api_audit_stop_recording_window` / `api_audit_stop_proxy_session` / `api_audit_list_proxy_sessions` — keep proxy sockets alive while rotating clean recording windows.

It also keeps slash commands for precise manual invocation:

- `/api-audit` — show a dashboard widget with profiles, scenarios, recent runs, and next actions.
- `/api-audit setup` — show widget-friendly setup guidance for profiles and target capture preparation.
- `/api-audit capture --scenario-id account-activity-basic --profile uat [--target new | --group default]` — show target-based capture preparation in the widget without starting proxies/browsers.
- `/api-audit capture --run --scenario-id account-activity-basic --profile uat [--target new | --group default]` — run target-based capture with recorders and Playwright manual-auth flow.
- `/api-audit account-activity --old-url http://localhost:8080 --new-url http://localhost:8008` — run the Layer A local browser-visible capture POC for `/account/activity` using the built-in scenario manifest.
- `/api-audit account-activity --manifest ./api-audit.scenarios.json --old-url http://localhost:8080 --new-url http://localhost:8008` — run with a compatible custom scenario manifest.
- `/api-audit proxy --side old --listen-port 18080 --target-url http://localhost:19080` — start the M4 local Layer B recording proxy spike.
- `/api-audit account-activity-upstream --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --old-proxy-port 18080 --new-proxy-port 18081` — start old/new Layer B recorders, prompt for manual app reconfiguration, then run account-activity page actions.
- `/api-audit profile show` — show saved local environment profiles.
- `/api-audit profile save uat --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://127.0.0.1:19080 --new-target-url http://127.0.0.1:19081 --default` — save a reusable non-secret profile.
- `/api-audit profile default uat` — make an existing profile the default.
- `/api-audit profile clear uat` — remove a saved profile.

The account-activity command opens a headed Playwright browser and asks for manual-auth confirmation for old and new local sites. Layer A artifacts are validation-only and are not final backend behavior evidence.

The programmatic lifecycle tools manage recorder processes only. They do not open browsers, wait for manual done, modify app config, or mutate the scenario dictionary. Use `api_audit_stop_capture` after the agent or a separate script finishes sending traffic through the returned proxy URLs.

For legacy apps that need stable proxy URLs, use persistent proxy sessions: start `api_audit_start_proxy_session` once, then call `api_audit_start_recording_window` and `api_audit_stop_recording_window` around each audited action. Stopping a recording window finalizes run artifacts, writes a comparison artifact under `<artifactDir>/comparisons/<comparisonRunId>.json`, and keeps proxy sockets open; call `api_audit_stop_proxy_session` only when finished.

If routing a legacy local service through the recorder causes frontend/static files like `/includes/js/...` to return API `404 text/plain` responses, add target-profile `passthroughRoutes` for those path prefixes. Passthrough routes forward matching requests to the configured frontend/static service and do not record them as upstream API exchanges.

Example target profile snippet:

```json
{
  "version": 2,
  "profiles": {
    "local-old": {
      "targets": {
        "old": {
          "variant": "old",
          "side": "old",
          "frontendUrl": "http://localhost:8080",
          "upstreamTargetUrl": "http://127.0.0.1:19080",
          "recorderPort": 18080,
          "passthroughRoutes": [
            { "pathPrefix": "/includes/js/", "targetBaseUrl": "http://localhost:8080" },
            { "pathPrefix": "/assets/", "targetBaseUrl": "http://localhost:8080" }
          ]
        }
      }
    }
  }
}
```

For review, `api_audit_review_capture` can queue existing slash-command review steps for the agent, including `/api-discovery-analyze`, `/api-discovery-suggest`, and `/api-discovery-validate-suggestion`. It also reminds the agent/user that the local human review viewer is `.pi-api-audit-runs/review.html` after running `tools/build-viewer.py`. The viewer build guidance uses `python3`, an absolute path to the package's bundled `tools/build-viewer.py`, and the workspace SOT path (`--sot .pi-api-audit-runs/scenarios.local.json`), so it works when pi is launched from a target workspace rather than this extension repo.

For one-shot automation, use `api_audit_run_automated_capture` with a workspace-local Node/Playwright script:

```json
{
  "scenarioId": "account-activity-basic",
  "profileName": "uat",
  "automationScript": ".pi-api-audit-runs/probe.mjs",
  "openBrowser": false,
  "headless": true,
  "maxDurationMs": 120000
}
```

The script receives a metadata file path as its first CLI argument and in `API_AUDIT_AUTOMATION_METADATA_PATH`. Metadata includes `captureSessionId`, target frontend/page paths, proxy URLs, run dirs, and `headless`. M2 implements script-completion and max-duration cleanup; `stopOnNetworkIdleMs` is preserved as metadata for scripts but is not yet an internal recorder idle detector.

The proxy command listens on loopback, forwards requests to a local or explicitly allowlisted target, and writes sanitized upstream `exchanges.ndjson` artifacts. It does not print raw payloads to the pi UI.

### Path defaults

When commands/tools run inside pi, mutable local paths resolve from the active pi workspace: Git root from `ctx.cwd` when available, otherwise `ctx.cwd`. For example, the default artifact/profile directory is `<workspace-root>/.pi-api-audit-runs`, not the installed extension package directory. Absolute path overrides remain absolute; relative overrides such as `--artifact-dir tmp-runs` or `--scenario-dictionary scenarios/local.json` are workspace-root-relative.

## Implemented primitives

- Layer-neutral sanitized API exchange and manifest types.
- Default redaction for sensitive headers, query parameters, and JSON-like body keys.
- Local run artifact helpers for `manifest.json` and `exchanges.ndjson`.
- Built-in account-activity scenario manifest plus optional custom manifest loading.
- Machine-readable artifact and scenario JSON schemas under `schemas/`.
- Workspace-local scenario dictionary loading; package scenarios are examples only and are never used as runtime fallback.
- Example scenario dictionary at `examples/account-activity.scenarios.json`.
- Runtime validators/loaders for manifests, exchanges, and scenario dictionaries.
- Local Layer B recording proxy primitives and `/api-audit proxy` command.
- M5 account-activity upstream integration command that combines old/new recorders with Playwright page actions.
- M7 pi tools for natural-language scenario listing, run validation, capture preparation, and account-activity upstream capture.
- M8 generic scenario-id-driven upstream capture tools.
- M9 gitignored local environment profiles shared by commands and tools.
- M10 target-based capture planning and run helpers for selected targets/groups, plus widget-friendly dashboard/setup/capture commands.
- M11 scenario discovery evidence collection with comparison grouping and browser context.
- M12 deterministic comparison analysis, scenario suggestions/validation, reviewed comparison evidence, evidence pipeline docs, and local viewers.
- v0.1.1 workspace-aware command/tool path resolution for mutable local artifacts and profile config.
- v0.2.0 M1 programmatic capture lifecycle primitives for starting, listing, and stopping recorder-only capture sessions.
- v0.2.0 M2 bounded `automationScript` runner that composes start → script → stop/finalize with timeout cleanup and metadata handoff.
- v0.2.0 review helper tool that can queue existing `/api-discovery-*` slash-command review steps and points users to the local `review.html` viewer.

## Local viewers

After collecting comparison evidence, build two single-file HTML viewers from
a workspace-owned scenario dictionary plus the accompanying artifacts under
`.pi-api-audit-runs/`. The package does not ship a runtime default scenario
SOT; use a repo-specific dictionary such as `.pi-api-audit-runs/scenarios.local.json`.

```bash
python3 /absolute/path/to/packages/pi-extension-api-behavior-audit/tools/build-viewer.py \
  --sot .pi-api-audit-runs/scenarios.local.json \
  --runs-dir .pi-api-audit-runs
open .pi-api-audit-runs/index.html   # report viewer (macOS)
open .pi-api-audit-runs/review.html  # suggestion review (macOS)
```

Both outputs are self-contained `file://` artifacts — share them as
attachments. They inherit the gitignore covering the runs directory.

### `index.html` — comparison report

Driven by each scenario's `evidence.comparisons[]`. For the selected
scenario + comparison the viewer shows:

- **Scenario header**: feature, description, type, `oldPath` / `newPath`
- **Coverage chips**: `browser-visible A/B · C/D` and
  `upstream E/F · G/H` (matched-vs-total allowlist coverage), background
  noise count, raw exchange counts
- **Browser-visible context**: per side, page URL plus the
  `browserContext.browserVisibleRequests` grouped by `(method, pathname)`
  with `✓ in-allowlist`, `🛇 third-party`, `⊘ background`, or
  `◯ unlisted` chips
- **Upstream endpoint summary**: per side, table from
  `analysis.targets.<side>.upstream.endpointSummary[]` sorted by count,
  with classification chip and a "show background noise" toggle
- **Timeline tab**: chronological OLD/NEW lanes (raw exchanges)
- **Path catalog tab**: presence badges (`both` / `old-only` / `new-only`)
- **Manual pair builder**: pin `●` on any OLD + NEW exchange to compare a
  renamed endpoint across the migration
- **Detail drawer**: URL meta diff, headers diff with added/changed/removed
  counts, JSON deep-diff for response bodies, side-by-side string body diff

Switch scenarios or comparisons via the top-bar dropdowns; the URL hash
(`#scenario=…&comparison=…`) preserves the selection on reload.

### `review.html` — suggestion review (handback)

Driven by suggestion artifacts under `.pi-api-audit-runs/candidates/`.
Browse each suggestion, toggle which observed endpoints should join the
scenario allowlist / upstream candidates (matches-known endpoints are
checked by default; background candidates are dimmed and unchecked), then
hand back the curated decisions as:

- **Markdown** (YAML frontmatter + `## Add to …` / `## Exclude as background`
  / `## Append evidence comparison` / `## Notes`) — paste back into a
  scenario-dictionary edit conversation
- **JSON patch** (`scenario-dictionary-patch` v1 — mirrors the
  field-named pattern in `src/scenario-suggestion.ts`, not RFC 6902)
- **Download .md** — produces `<scenarioId>-<comparisonRunId>.md`

The export preview re-renders live as you toggle checkboxes or type into
the notes field. The top-right "open in report →" link opens the matching
comparison in `index.html`.

### CLI flags

| Flag | Effect |
|---|---|
| `--sot <path>` | Scenario dictionary SOT path (use a workspace-owned file such as `.pi-api-audit-runs/scenarios.local.json`) |
| `--runs-dir <path>` | Override artifacts root (default: `.pi-api-audit-runs`) |
| `--scenario <id>` | Filter to one scenario; repeatable |
| `--report-output <path>` / `--review-output <path>` | Override output locations |
| `--include <runId>` | **Deprecated** — was a raw-run filter; emits a warning and is ignored |

Missing artifacts degrade gracefully: a missing analysis JSON replaces the
coverage chips and upstream summary with placeholders but leaves the
timeline/catalog/drawer functional; a missing raw-run directory shows
`(run not on disk: …)` in the affected lane.

## Safety boundaries

- Default to local services and explicit host allowlists.
- Do not commit captured API payloads, cookies, auth headers, tokens, passwords, or production data.
- Raw capture artifacts must live in gitignored local artifact directories when implemented.
- Destructive scenarios and write APIs require explicit user approval before they are supported.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
```

If Playwright reports that Chromium is missing, install it once:

```bash
npx playwright install chromium
```
