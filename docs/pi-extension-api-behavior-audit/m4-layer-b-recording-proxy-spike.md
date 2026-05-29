# M4 — Layer B recording proxy spike

## Status

Done.

## SPEC

### Scope

Prototype a local recording proxy that captures upstream/backend request/response exchanges without changing product code.

This is the first Layer B milestone. It should prove the recorder shape with curl/local upstream services before integrating it with old/new apps in M5.

Deliverables:

- Recording proxy config parser.
- Local-only safety checks for listen port and target URL.
- Node HTTP recording proxy that forwards requests to a target base URL.
- Sanitized Layer B `ApiExchange` artifacts using M1 redaction/artifact primitives.
- Minimal `/api-audit proxy` command to start a recorder from pi.
- Automated tests using a local upstream HTTP server.

### Target command shape

```text
/api-audit proxy --side old --listen-port 18080 --target-url http://localhost:19080 --artifact-dir .pi-api-audit-runs
```

Required flags:

- `--side old|new`
- `--listen-port <port>`
- `--target-url <local-url>`

Optional flags:

- `--artifact-dir <dir>` defaults to `.pi-api-audit-runs`
- `--scenario-id <id>` defaults to `recording-proxy-spike`
- `--allow-host <hostname>` may explicitly allow a non-local target host for later dev/test use, but local targets remain the default and preferred M4 path.

### Spike verification shape

Use a local upstream echo/test server first:

```text
curl http://localhost:18080/v1/server-time
```

Expected output:

- Request is forwarded to `target-url + /v1/server-time`.
- Response is returned to curl.
- A sanitized upstream exchange is appended to `exchanges.ndjson`.
- The exchange uses `layer: "upstream"` and `provenance.source: "recording-proxy"`.

### Non-goals

- No Playwright integration.
- No old/new app config mutation.
- No automatic Go/Vite process management.
- No production target defaults.
- No TLS MITM interception.
- No WebSocket/SSE support.
- No streaming response optimization beyond the minimal spike.
- No audit/parity report generation.

### Design notes

The proxy should intentionally stay small and testable. M4 exists to prove the upstream recorder artifact mechanics before M5 connects it to account-activity page actions.

Safety defaults:

- Listen only on loopback host.
- Require explicit local target URL by default.
- If a non-local target is needed later, require `--allow-host <hostname>` and record that host in command/docs; do not make remote capture implicit.
- Redact before writing artifacts.
- Do not print raw request/response bodies into pi UI.

Initial artifact layout may reuse M1 run layout:

```text
.pi-api-audit-runs/<run-id>/
├── manifest.json
└── exchanges.ndjson
```

The manifest should record Layer B/proxy metadata such as side, target URL, listen URL, started timestamp, and scenario id.

### Expected files

Likely package files:

- `packages/pi-extension-api-behavior-audit/src/proxy-config.ts`
- `packages/pi-extension-api-behavior-audit/src/proxy-config.test.ts`
- `packages/pi-extension-api-behavior-audit/src/recording-proxy.ts`
- `packages/pi-extension-api-behavior-audit/src/recording-proxy.test.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/commands.ts`
- Updates to `packages/pi-extension-api-behavior-audit/src/types.ts`
- README / CHANGELOG updates

## AC

Acceptance criteria:

- `/api-audit proxy` can start a local recording proxy.
- Proxy forwards method, path, query, selected headers, and body to the target URL.
- Proxy returns upstream status, headers, and body to the caller.
- Proxy writes sanitized Layer B exchanges to `exchanges.ndjson`.
- Exchange metadata includes side, scenario id, layer `upstream`, source `recording-proxy`, request URL, response status, and timing.
- Command refuses non-local target URLs unless `--allow-host <hostname>` explicitly matches the target host.
- Command refuses invalid listen ports.
- Tests prove forwarding, artifact writing, and redaction against a local upstream server.
- Pi UI output reports artifact paths/counts only, not raw payloads.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

Manual verification, once implemented:

1. Start a local upstream test server.
2. Start recorder via `/api-audit proxy ...`.
3. `curl` the recorder.
4. Confirm response is proxied and artifact is sanitized.

## Status tracking

At start:

1. Confirm M3 is `Done`.
2. Change M4 status in `milestones.md` from `Proposed` to `In progress`.
3. Append a start entry to `log.md`.
4. Commit the plan/status/log update before code work.

At completion:

1. Run automated verification.
2. Run manual curl proxy smoke if practical.
3. Change M4 status to `Done`.
4. Append verification evidence and any manual-capture caveats to `log.md`.
5. Commit docs and implementation together.

## Completion notes

Implemented:

- `/api-audit proxy` Layer B recording proxy command.
- Local/allowlisted target URL validation and listen port validation.
- Loopback HTTP forwarding proxy for method, path, query, headers, and body.
- Sanitized upstream `ApiExchange` artifacts with `layer: "upstream"` and `provenance.source: "recording-proxy"`.
- Proxy manifest metadata for side, listen URL, target base URL, scenario id, and live exchange count.
- Automated local upstream HTTP server test covering forwarding, artifact writing, and redaction.
- Redaction hardening for sensitive query parameters embedded in URL-like or JSON-like body strings.

Manual smoke passed:

```text
.pi-api-audit-runs/2026-05-25T06-07-45-944Z/
├── manifest.json
└── exchanges.ndjson
```

Observed:

- `manifest.json` records `layer: "upstream"`, `exchangeCount: 1`, side `old`, listen URL `http://127.0.0.1:18081`, and target URL `http://127.0.0.1:19080`.
- `exchanges.ndjson` contains one POST exchange for `/v1/server-time` with status `201`.
- Request token query, authorization header, request password, echoed response body password, and response `nextToken` were redacted.
- Pi UI exposed artifact paths/counts only, not raw payloads.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```
