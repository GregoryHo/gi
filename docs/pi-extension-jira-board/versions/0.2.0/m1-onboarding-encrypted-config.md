# M1 implementation plan — Onboarding and encrypted local config

## Status

Done.

## Completion notes

Implemented:

- `/jira-onboarding` command.
- Masked secret input component.
- Encrypted local credential storage using AES-256-GCM.
- Local `master.key` generation with owner-only file mode where supported.
- `config.json` / `secrets.json` separation so password/token is not stored in plaintext config.
- Local encrypted config fallback when env credentials are absent.
- Env credential precedence when complete env config is present.
- README and changelog notes for onboarding and local encrypted storage.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Latest automated result: 58 tests passed; package and root typecheck passed; pack dry-run included 18 files.

Manual Jira smoke test: `/jira-onboarding` was tested by the user and reported working.

## Objective

Add `/jira-onboarding` so users can configure Jira from the pi UI without editing shell environment variables, while ensuring password/token values are never saved in plaintext local config files.

## SPEC

### Scope

M1 includes:

1. Local Jira config loading and saving.
2. Env var precedence over local config.
3. Encrypted local secret storage using Node built-in `crypto`.
4. Local `master.key` generation for reversible encryption.
5. `/jira-onboarding` command.
6. Masked password/token entry via custom UI.
7. `/jira-status` and existing tools/commands working with local encrypted config.
8. Tests for config precedence, encryption/decryption, corrupt/missing local config, and sanitized summaries.

### Non-goals

M1 does not include:

- OS-specific secret stores such as macOS Keychain, Linux Secret Service, or Windows Credential Manager.
- Enterprise vault integration.
- Plaintext secret storage.
- Project/issue browser UI.
- Widget card layout changes.
- Jira issue creation, assignment, label mutation, or new write actions.
- LLM-facing write tools.

### Local storage model

Use the pi agent directory for local config:

```text
~/.pi/agent/jira-board/
├── config.json
├── secrets.json
└── master.key
```

Expected contents:

```json
// config.json
{
  "baseUrl": "https://jira.example.com",
  "user": "alice",
  "authType": "token",
  "project": "PROJ",
  "boardId": 123,
  "secretRef": "default"
}
```

```json
// secrets.json
{
  "default": {
    "algorithm": "aes-256-gcm",
    "iv": "base64...",
    "tag": "base64...",
    "ciphertext": "base64..."
  }
}
```

`master.key` stores random key material and should be created with owner-only permissions where supported. The implementation should avoid printing file contents or secret values.

### Config precedence

Configuration resolution should be:

```text
env vars > encrypted local config > missing config error
```

Rules:

- If required env vars are present, use env config exactly as v0.1.0 did.
- If required env vars are missing, try local encrypted config.
- Optional env vars may override local optional values only when env config is otherwise being used. Keep M1 simple; do not merge partial env credentials with local credentials.
- Missing config errors should mention `/jira-onboarding` as the recommended setup path.

### Encryption design

Use Node `crypto`:

- Algorithm: `aes-256-gcm`.
- Key: 32 random bytes stored in `master.key`.
- IV: random per encryption operation.
- Store `iv`, `tag`, and `ciphertext` in base64.

Security note for docs and comments: this avoids plaintext-at-rest accidental exposure but does not protect against an attacker who can read both `master.key` and `secrets.json`.

### `/jira-onboarding` command

Behavior:

1. Require interactive UI (`ctx.hasUI`). Refuse clearly otherwise.
2. Ask for Jira base URL.
3. Ask for username/email.
4. Ask auth type: token or password.
5. Ask for secret using masked input.
6. Optionally ask for default project.
7. Optionally ask for board id.
8. Validate connectivity using the entered config.
9. Preview non-secret summary.
10. Save `config.json`, encrypted `secrets.json`, and `master.key` only after confirmation.

Keep M1 simple: project and board values may be manual inputs. Project/board query pickers are deferred to M2/M3.

### Masked input

Use `ctx.ui.custom()` with a small custom component or helper so typed secret characters are rendered as bullets. The returned value is used only to encrypt and validate. Do not send secret values to the LLM or pi session entries.

### Expected file changes

Likely package source files:

```text
packages/pi-extension-jira-board/src/config.ts
packages/pi-extension-jira-board/src/local-config.ts
packages/pi-extension-jira-board/src/secret-store.ts
packages/pi-extension-jira-board/src/jira-onboarding.ts
packages/pi-extension-jira-board/src/index.ts
```

Likely tests:

```text
packages/pi-extension-jira-board/src/local-config.test.ts
packages/pi-extension-jira-board/src/secret-store.test.ts
packages/pi-extension-jira-board/src/config.test.ts
```

Docs/package files updated in M1 if needed:

```text
packages/pi-extension-jira-board/README.md
packages/pi-extension-jira-board/.env.example
```

## AC

M1 is complete when all criteria below are true:

1. `/jira-onboarding` is registered.
2. `/jira-onboarding` refuses clearly when `ctx.hasUI` is false.
3. Secret entry is masked and does not echo plaintext in rendered UI.
4. Saved local config does not contain plaintext password/token.
5. Saved encrypted secret can be decrypted by runtime config loading.
6. Env vars still work and take precedence over local config.
7. Missing env vars can be satisfied by local encrypted config.
8. Missing/corrupt local config produces actionable sanitized errors.
9. `/jira-status` works with local encrypted config.
10. No new Jira write behavior is added.
11. Tests and typecheck pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Manual interactive smoke check with a safe Jira account:

```bash
pi -e ./packages/pi-extension-jira-board
```

Then run:

```text
/jira-onboarding
/jira-status
```

Expected:

- Secret is masked during setup.
- Config files do not contain plaintext password/token.
- `/jira-status` reports successful connectivity without env vars.

## Status tracking

At M1 implementation start:

1. Update `docs/pi-extension-jira-board/versions/0.2.0/milestones.md`:
   - `M1 Onboarding and encrypted local config` → `In progress`
2. Append a start entry to `docs/pi-extension-jira-board/versions/0.2.0/log.md`.
3. Commit the status/log/plan update before code changes.

At M1 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/versions/0.2.0/milestones.md`:
   - `M1 Onboarding and encrypted local config` → `Done`
   - `M2 Project and issue query primitives` → `Planned` or `Next`
3. Add completion notes to this plan.
4. Append verification evidence to `docs/pi-extension-jira-board/versions/0.2.0/log.md`.
5. Commit the completed milestone state.
