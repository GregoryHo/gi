# M3 — Web Search doctor diagnostics

## Status

Done.

## SPEC

### Goal

Add a small diagnostics command so a clone user can tell whether Web Search is loaded and whether search auth/setup is likely to work.

### Scope

Register a pi command, proposed name: `/web-search-doctor`.

The command should report:

- Extension/package loaded successfully.
- Package version.
- Whether `OPENAI_API_KEY` is present, without printing its value.
- Whether pi model registry auth appears available for likely OpenAI/Codex provider candidates, without printing headers or tokens.
- Registered tool names provided by this package if feasible without relying on unstable pi internals.
- Safe fetch configuration summary:
  - public HTTP/HTTPS only.
  - SSRF guard enabled.
  - no browser cookies.
  - no JavaScript rendering.
  - session-local storage only.
- Suggested next actions for common failures.

Optional command argument:

```text
/web-search-doctor smoke
```

If implemented, `smoke` may run one harmless live search query and report pass/fail with redacted details. It must not run automatically because it may incur provider usage.

### Non-goals

- Persisting diagnostics results.
- Printing API keys, headers, cookies, raw provider payloads, or private content.
- Adding a new LLM-callable diagnostics tool.
- Multi-provider checks.
- Browser-cookie checks.
- Network smoke by default.

### Design notes

- Prefer a command over a tool because diagnostics are user-facing setup workflow, not model reasoning context.
- Reuse existing auth resolution helpers if possible, but ensure they can return redacted status without making an unnecessary network call.
- If model-registry probing is ambiguous, say so rather than reporting false confidence.
- Keep output concise and actionable.

### Expected files

Likely:

- `packages/pi-extension-web-search/src/index.ts`
- `packages/pi-extension-web-search/src/tools.ts` or a new `src/doctor.ts`
- tests for command registration / redaction behavior
- `packages/pi-extension-web-search/README.md`
- `packages/pi-extension-web-search/CHANGELOG.md` when released as an intermediate version

## AC

- `/web-search-doctor` is registered when the extension loads.
- The command output never includes secret-like credential values.
- With no auth, the command gives actionable setup guidance.
- With env fallback present, it reports presence only, not the key.
- If smoke mode is implemented, it is opt-in and handles provider failure cleanly.
- Existing tools continue to register and work.

## Verification

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
```

Manual smoke:

```bash
pi -e ./packages/pi-extension-web-search
```

Then run:

```text
/web-search-doctor
```

Optional authenticated smoke if implemented:

```text
/web-search-doctor smoke
```

## Status tracking

At start:

- Mark M3 `In progress` in `milestones.md`.
- Append a start entry to `log.md`.

At completion:

- Mark M3 `Done` in `milestones.md`.
- Add completion notes here.
- Append verification evidence to `log.md`.

## Completion notes

Completed on 2026-06-26.

TDD evidence:

- Added failing tests first in `src/doctor.test.ts` and `src/index.test.ts`.
- RED failure confirmed because `src/doctor.ts` did not exist and `web-search-doctor` was not registered.
- Implemented minimal `src/doctor.ts` and registered the command from `src/index.ts`.
- Fixed a type-only issue in the test double after the tests passed but typecheck failed.

Implemented behavior:

- Registers `/web-search-doctor`.
- Reports package version, registered Web Search tool names, `OPENAI_API_KEY` presence, redacted search-auth availability, provider/model when available, and safety boundaries.
- Does not print API keys, auth headers, cookies, raw provider payloads, or private content.
- Gives `/login` and `OPENAI_API_KEY` setup guidance when auth is unavailable.
- Defers optional live smoke mode to avoid accidental provider usage.
- Documents the command in the package README and Unreleased changelog.

Verification passed:

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

The pi load smoke exited successfully and printed `No models matching "gpt-4o"`, indicating startup/list-model flow completed without extension load failure.
