# M11 — Expanded safe profiles: implementer and verifier

## Status

Done.

## SPEC

### Scope

Expand built-in worker profiles beyond planning/review so users can delegate focused implementation and independent verification while preserving safety defaults.

M11 should add `implementer` and `verifier`. The user explicitly prefers `verifier` over `qa`.

### Target behavior

Built-in profiles:

- `planner`
  - existing read-only planning profile.
- `reviewer`
  - existing read-only review profile.
- `implementer`
  - focused code-change profile.
  - write-capable.
  - requires explicit confirmation for real worker adapters.
  - prompt emphasizes minimal diffs, no unrelated refactors, and explicit verification.
- `verifier`
  - independent verification profile.
  - read-only by default.
  - checks implementation against acceptance criteria, diffs, tests, and likely regressions.
  - reports pass/fail/gaps rather than modifying files.

Profile metadata should be rich enough for tools, widget cards, and future scheduler decisions:

- `name`
- `description`
- `adapter`
- `mode`
- `systemPrompt`
- `requireConfirmation`
- `readOnly`
- `canModifyWorkspace`
- `recommendedUse`
- optional `defaultTimeoutMs`

### Design notes

- `verifier` is intentionally not named `qa` because this extension is a generic coding-agent worker runtime rather than a product QA suite.
- `implementer` should not add dangerous CLI permission or sandbox bypass flags.
- `verifier` and `reviewer` may both be read-only, but their prompts differ:
  - `reviewer`: find issues in a change or plan.
  - `verifier`: decide whether acceptance criteria are satisfied and what evidence is missing.
- Profile metadata should be returned by `agent_worker_list_profiles` so the LLM can choose safely.

### Expected files

Likely files:

- `packages/pi-extension-agent-workers/src/profiles.ts`
- `packages/pi-extension-agent-workers/src/request-types.ts`
- `packages/pi-extension-agent-workers/src/service.ts`
- `packages/pi-extension-agent-workers/src/tools.ts`
- `packages/pi-extension-agent-workers/src/commands.ts`
- related package tests
- package README/docs updates
- this milestone plan

### Non-goals

- No bypass flags or unsafe permission presets.
- No automatic file writes without normal worker confirmation gates.
- No profile-specific Jira/domain behavior.
- No automatic worktree creation.
- No multi-worker scheduler yet, beyond exposing metadata useful to it.

## AC

Implementation is complete when:

1. `agent_worker_list_profiles` lists `planner`, `reviewer`, `implementer`, and `verifier` with useful metadata.
2. `/worker-run --profile implementer <task>` resolves to the implementation profile.
3. `/worker-run --profile verifier <task>` resolves to the verification profile.
4. `implementer` is marked write-capable and requires confirmation for real adapters.
5. `verifier` is marked read-only and its prompt instructs the worker not to modify files.
6. Profile prompts include focused-diff, verification, and no-unrelated-refactor guidance where appropriate.
7. Unknown profile errors include the expanded available profile list.
8. Tests cover profile resolution, metadata copying, request resolution, and command/tool exposure.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Optional manual smoke:

```text
/worker-run --profile verifier --yes Summarize whether this repository has uncommitted docs changes. Do not modify files.
```

Run real-worker manual smoke only with explicit user approval.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M11 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M11 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M11 expanded safe profiles.

Implemented:

- Added built-in `implementer` profile for focused code changes.
- Added built-in `verifier` profile for independent read-only acceptance verification.
- Expanded `WorkerProfile` metadata with `description`, `readOnly`, `canModifyWorkspace`, `recommendedUse`, and optional `defaultTimeoutMs`.
- Kept real-worker confirmation defaults for all Claude/Codex-backed profiles; `implementer` is write-capable metadata only and does not add bypass flags.
- Updated profile prompts with minimal-diff, no-unrelated-refactor, explicit verification, and read-only verification guidance.
- Updated `agent_worker_list_profiles` output through the shared profile metadata.
- Updated `/worker-run --profile ...` help for `implementer` and `verifier`.
- Updated README and changelog guidance for M11.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

Manual smoke completed:

```text
/worker-run --profile verifier --yes Summarize whether this repository has uncommitted docs changes. Do not modify files.
/worker-status
```

Observed expected behavior:

- `agent_worker_list_profiles` listed `planner`, `reviewer`, `implementer`, and `verifier`.
- `/worker-run --profile verifier --yes ...` started a `claude-code` run with `profile: verifier` and `mode: review`.
- The verifier used read-only git status checks, completed with `exitCode: 0`, and reported `PASS` with evidence and caveats.
- The working tree remained clean.
- A follow-up fix updated `/worker-run` usage text to include the expanded `--profile` options; `npm test --workspace @gregho/pi-extension-agent-workers` and `npm run typecheck --workspace @gregho/pi-extension-agent-workers` passed after that usage fix.
