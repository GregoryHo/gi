# M9 — Environment profile config

## Status

Done.

## SPEC

### Problem

M8 generic tools can derive page paths and expected endpoint candidates from the scenario dictionary, but they still require users or the LLM to provide environment URLs each time:

- old frontend base URL,
- new frontend base URL,
- old backend/upstream target URL,
- new backend/upstream target URL,
- allow-host entries for non-local backends,
- recorder ports.

Today those values are either defaults or inferred from conversation context. That is convenient in one session, but it is not deterministic extension state and can be lost or hallucinated.

### Scope

Add explicit local environment profiles for API audit tools.

Profiles should let users store non-secret local/dev/UAT endpoint configuration in a gitignored local file and reuse it from both slash commands and natural-language tools.

### Proposed storage

Use a gitignored local config file under the artifact root:

```text
.pi-api-audit-runs/config.local.json
```

Draft shape:

```json
{
  "version": 1,
  "profiles": {
    "uat": {
      "oldUrl": "http://localhost:8080",
      "newUrl": "http://localhost:8008",
      "oldTargetUrl": "http://old-api.example.test",
      "newTargetUrl": "https://new-api.example.test",
      "oldProxyPort": 18080,
      "newProxyPort": 18081,
      "allowHosts": [
        "old-api.example.test",
        "new-api.example.test"
      ]
    }
  },
  "defaultProfile": "uat"
}
```

### Proposed commands

Add profile subcommands under the existing `/api-audit` command:

```text
/api-audit profile show
/api-audit profile save <name> \
  --old-url <url> \
  --new-url <url> \
  --old-target-url <url> \
  --new-target-url <url> \
  [--old-proxy-port <port>] \
  [--new-proxy-port <port>] \
  [--allow-host <host> ...] \
  [--default]
/api-audit profile default <name>
/api-audit profile clear <name>
```

The command layer and tool layer must share the same parser/loader/writer implementation.

### Proposed tools

- `api_audit_show_environment_profiles`
  - Read-only.
  - Lists configured profile names and safe endpoint values.
- `api_audit_save_environment_profile`
  - Writes/updates one profile after explicit user intent.
  - Should reject credential-like fields and sensitive query strings.
- `api_audit_clear_environment_profile`
  - Removes one profile or clears default selection.
- Existing prepare/run tools and future command wrappers accept:
  - `profileName?: string`
  - `/api-audit ... --profile <name>`
  - explicit args still override profile values.

### Safety rules

- Config file must remain gitignored.
- Profiles must not store cookies, tokens, auth headers, passwords, or request bodies.
- Reject URLs with sensitive query params such as `token`, `session`, `password`, `auth`, `secret`.
- Non-local backend targets still require allow-host entries, even when loaded from a profile.
- Tool outputs must avoid printing secrets; profiles should not contain secrets by design.
- Do not auto-detect or persist values just because they appeared in prompt text; saving requires explicit user request.

### Interaction examples

```text
記住這組 API audit UAT 環境設定，profile 叫 uat。
用 uat profile 準備 account-activity-basic 的 upstream capture。
顯示目前有哪些 API audit environment profiles。
清掉 uat profile。
/api-audit profile show
/api-audit profile save uat --old-url http://localhost:8080 --new-url http://localhost:8008 --old-target-url http://old-api.example.test --new-target-url https://new-api.example.test --allow-host old-api.example.test --allow-host new-api.example.test --default
```

### Non-goals

- No credential storage.
- No automatic app config mutation.
- No global OS keychain integration.
- No production profiles by default.
- No implicit persistence from conversation context.

## Completion notes

Implemented:

- Profile loader/writer at `src/environment-profiles.ts`.
- Gitignored local storage at `.pi-api-audit-runs/config.local.json`.
- Slash commands:
  - `/api-audit profile show`
  - `/api-audit profile save <name> ... [--default]`
  - `/api-audit profile default <name>`
  - `/api-audit profile clear <name>`
- Natural-language tools:
  - `api_audit_show_environment_profiles`
  - `api_audit_save_environment_profile`
  - `api_audit_clear_environment_profile`
- Generic prepare/run tools can resolve URLs from `profileName`.
- Explicit tool args override profile values.
- Sensitive query params and unallowlisted remote backend targets are rejected.

Verification passed on 2026-05-25:

```bash
npm test --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck --workspace @gregho/pi-extension-api-behavior-audit
npm run pack:dry-run --workspace @gregho/pi-extension-api-behavior-audit
npm run typecheck
```

## AC

- Profile file loader/writer is deterministic and tested.
- Missing config file is treated as no profiles, not an error.
- Saving profile creates parent artifact directory if needed.
- `/api-audit profile show/save/default/clear` commands are implemented and tested.
- Profile commands and profile tools share implementation.
- Existing generic prepare/run tools can resolve URLs from `profileName`.
- Existing command flows can resolve URLs from `--profile` when applicable.
- Explicit tool args and command flags override profile values.
- Sensitive URL/query values are rejected.
- Pack dry-run does not include local config artifacts.
