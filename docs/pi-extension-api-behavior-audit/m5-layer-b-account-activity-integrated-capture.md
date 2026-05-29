# M5 — Layer B account-activity integrated capture

## Status

Done.

## SPEC

### Scope

Integrate M2 Playwright account-activity page actions with M4 Layer B recording proxies so the primary artifact is upstream/backend API behavior evidence.

M5 is still local-only and read-only. It should prove the flow for one account-activity scenario without automatically mutating old/new app configuration.

### Target flow

1. User provides local old/new page base URLs.
2. User provides old/new backend target URLs for the recording proxies.
3. Extension starts two local Layer B recorders:
   - old recorder, usually `http://127.0.0.1:18080`
   - new recorder, usually `http://127.0.0.1:18081`
4. Extension displays explicit instructions for the user to point local apps at the recorder URLs:
   - old Go app `[api].host` should point to old recorder listen URL.
   - new Vite/API proxy target should point to new recorder listen URL.
5. User confirms local apps have been configured/restarted.
6. Extension uses headed Playwright manual-auth flow and navigates account-activity pages.
7. Recorder artifacts capture upstream/backend exchanges.
8. Run manifest records both recorder runs and scenario/page provenance.

### Command shape

Proposed command:

```text
/api-audit account-activity-upstream \
  --old-url http://localhost:8080 \
  --new-url http://localhost:8008 \
  --old-target-url http://127.0.0.1:19080 \
  --new-target-url http://127.0.0.1:19081 \
  --old-proxy-port 18080 \
  --new-proxy-port 18081
```

Optional:

- `--artifact-dir <dir>` defaults to `.pi-api-audit-runs`
- `--manifest <path>` reuses M3 scenario manifest loading
- `--allow-host <hostname>` explicitly allows non-local backend target hosts

### Non-goals

- No automatic editing of old Go `app.conf`.
- No automatic editing of new `.env`, Vite config, or process environment.
- No process management for old/new apps.
- No production target defaults.
- No write/destructive flows.
- No audit report generation.
- No generic multi-scenario orchestration beyond account-activity.

### Safety notes

M5 can point recorders at backend-like targets. Defaults must remain local. Any non-local target must require explicit `--allow-host` and should be visible in pi UI instructions.

Raw upstream artifacts remain local and gitignored. Pi UI output should show recorder URLs, artifact paths, counts, and warnings only — no raw payload bodies.

### Expected implementation approach

Keep the integration small:

- Add config parser for `account-activity-upstream`.
- Add an integrated capture helper that starts old/new recorders, prompts for app reconfiguration/auth, runs account-activity page navigation, then returns recorder artifact paths/counts.
- Reuse M3 scenario manifest for account-activity paths.
- Reuse M4 `startRecordingProxy` rather than duplicating proxy logic.
- Add unit tests for config and instruction/message generation.
- Add integration-style tests with local fake apps only if they stay small and deterministic.

### Expected files

Likely package files:

- `packages/pi-extension-api-behavior-audit/src/upstream-account-activity.ts`
- `packages/pi-extension-api-behavior-audit/src/upstream-account-activity.test.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/commands.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/proxy-config.ts` if shared parsing helpers are needed
- README / CHANGELOG updates

## AC

Acceptance criteria:

- `/api-audit account-activity-upstream` starts old/new recording proxies with distinct listen ports.
- Command refuses non-local old/new page URLs and non-local backend target URLs unless explicitly allowlisted.
- Pi UI clearly instructs the user which app config values should point to which recorder URL before page capture starts.
- User confirmation is required before Playwright navigation begins.
- Manual-auth flow still works for old/new pages.
- Recorder artifacts contain upstream `layer: "upstream"` exchanges for the account-activity scenario when local apps are configured correctly.
- Integrated result reports artifact paths and exchange counts only.
- If no upstream exchanges are recorded, command reports an actionable warning that app proxy configuration may not be pointing at the recorder.
- Existing Layer A `account-activity` command continues to work.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Manual verification, once implemented:

1. Start old/new target backends or local upstream test servers.
2. Run `/api-audit account-activity-upstream ...`.
3. Point local old/new apps to recorder listen URLs and restart as needed.
4. Confirm in pi, authenticate manually, and run account-activity capture.
5. Confirm old/new upstream artifacts contain sanitized exchanges.

## Status tracking

At start:

1. Confirm M4 is `Done`.
2. Change M5 status in `milestones.md` from `Proposed` to `In progress`.
3. Append a start entry to `log.md`.
4. Commit the plan/status/log update before code work.

At completion:

1. Run automated verification.
2. Run manual integrated capture if local old/new app configuration is available.
3. Change M5 status to `Done`.
4. Append verification evidence and any manual-capture caveats to `log.md`.
5. Commit docs and implementation together.

## Completion notes

Implemented:

- `/api-audit account-activity-upstream` command.
- Old/new Layer B recorder startup around account-activity Playwright page actions.
- Explicit user confirmation step for manual old/new app reconfiguration before browser navigation.
- Local/default safety checks with `--allow-host` for UAT backend targets.
- Warning when either recorder captures zero upstream exchanges.
- Artifact-only UI output with counts and manifest paths, not raw payloads.

Manual integrated smoke passed:

```text
old: .pi-api-audit-runs/2026-05-25T06-58-22-572Z/
new: .pi-api-audit-runs/2026-05-25T06-58-22-580Z/
```

Observed:

- Old recorder captured `129` upstream exchanges against `http://old-api.example.test`.
- New recorder captured `33` upstream exchanges against `https://new-api.example.test`.
- Old account-activity equivalent endpoint appears as:
  - `GET /v1/account/activity?...time=d&type=period&typecodes=&pi=1&ps=25&po=...`
- New account-activity endpoint appears as:
  - `GET /apis/account/activity?...pi=1&ps=25&po=desc`
- Both account-activity responses have top-level `Items`, `Others`, and `Pager` keys.
- Smoke revealed an empty `x-ps-device-token` header on old requests; no value leaked, and follow-up hardening now redacts token-like header names.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
