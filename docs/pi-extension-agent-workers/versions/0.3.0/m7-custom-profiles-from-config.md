# v0.3.0 M7 — Custom profiles from config

## Status

Done.

## SPEC

Allow workspace config to define custom worker profiles while preserving safety metadata and built-in profile behavior.

Scope:

- Extend the M4 config model to include workspace-defined profiles.
- Merge built-in profiles with custom workspace profiles for command/tool listing and request resolution.
- Validate custom profile fields and safety metadata.
- Ensure read-only/write-capable metadata feeds existing confirmation and concurrency rules.

Candidate custom profile fields:

- `name`
- `description`
- `adapter`
- `mode`
- `systemPrompt`
- `model`
- `defaultTimeoutMs`
- `requireConfirmation`
- `readOnly`
- `canModifyWorkspace`
- `recommendedUse`

Collision policy to decide before implementation:

- Prefer not allowing custom profiles to override built-in profile names.
- If override behavior is desired later, require explicit namespacing or confirmation.

Safety constraints:

- Unknown or invalid profile definitions are ignored or rejected with actionable errors.
- Custom profiles cannot silently weaken real-adapter confirmation.
- Write-capable custom profiles participate in workspace collision blocking.

Non-goals:

- No remote/profile registry.
- No sharing profiles through committed project files unless separately designed.
- No secrets in profile config.

## AC

- `agent_worker_list_profiles` includes valid custom workspace profiles with safety metadata.
- `/worker-run --profile <custom>` resolves a valid custom profile.
- Built-in profiles remain available and are not accidentally overridden.
- Invalid custom profiles produce clear diagnostics without breaking built-ins.
- Tests cover merge behavior, collision behavior, profile validation, and safety metadata propagation.

Verification:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

## Status tracking

At start:

- Mark `v0.3.0 M7` as `In progress` in `versions/0.3.0/milestones.md`.
- Append a start entry to `versions/0.3.0/log.md`.

At completion:

- Mark `v0.3.0 M7` as `Done`.
- Add completion notes here.
- Append verification evidence to `versions/0.3.0/log.md`.

## Current implementation notes

Implemented local workspace custom profile support through the workspace config JSON model:

- `WorkspaceAgentWorkerConfig.profiles` stores validated custom profile definitions.
- Built-in profile names cannot be overridden.
- Real-adapter custom profiles (`claude-code`, `codex-cli`) must keep `requireConfirmation: true`.
- Custom profile fields are validated for adapter, mode, booleans, timeout bounds, and non-empty text.
- `AgentWorkerService.resolveRequestWithConfig()` can resolve workspace custom profiles.
- `AgentWorkerService.listProfiles()` merges built-ins plus custom workspace profiles.
- `agent_worker_list_profiles` now uses service profiles, so tools can see workspace custom profiles.

M7 complete. Full verification passed.
