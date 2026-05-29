# M7 implementation plan — Packaging polish

## Status

Done. M7 finalized the local package metadata and documentation for version `0.1.0`.

## Completion notes

Added/updated:

- package version `0.1.0`
- package `files` allowlist for runtime sources/docs only
- `pack:dry-run` script
- `.env.example`
- `CHANGELOG.md`
- package README install/config/usage/safety docs

Verified with:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Latest verification result: 43 tests passed, typecheck passed, and dry-run package contained 15 files.

## Objective

Polish the Jira board extension package so it is easy to load temporarily, install locally, configure safely, and maintain across follow-up work.

## SPEC

### Scope

M7 includes:

1. Final package metadata updates.
2. Package README cleanup with concise install/config/usage/safety sections.
3. Example environment file without secrets.
4. Changelog/versioning notes.
5. Package dry-run verification.

### Non-goals

M7 does not include:

- New Jira API behavior.
- New commands or tools.
- New write actions.
- Publishing to npm.
- Migrating TypeScript source to compiled output.

### Package metadata

Update `packages/pi-extension-jira-board/package.json` as needed:

- Set a meaningful initial local version, likely `0.1.0`.
- Add/confirm `pi-package` keywords.
- Add package `files` if useful for local package hygiene.
- Add `pack:dry-run` script if useful for verification.

Keep peer dependency policy intact for pi-provided packages.

### Docs

Package docs should clearly cover:

- Temporary load with `pi -e ./packages/pi-extension-jira-board`.
- Local install with `pi install ./packages/pi-extension-jira-board`.
- Environment variables and `.env.example` usage.
- Commands.
- Tools.
- Autocomplete behavior.
- Controlled write safety boundaries.
- Verification commands for maintainers.

### Example config

Add a committed example file with no secrets:

```text
packages/pi-extension-jira-board/.env.example
```

It should include placeholders for:

- `JIRA_BASE_URL`
- `JIRA_USER` or `JIRA_EMAIL`
- `JIRA_TOKEN` or `JIRA_PASSWORD`
- `JIRA_PROJECT`
- `JIRA_BOARD_ID`

### Changelog

Add:

```text
packages/pi-extension-jira-board/CHANGELOG.md
```

Document `0.1.0` as the initial local package milestone containing M1-M6 behavior.

## AC

M7 is complete when all criteria below are true:

1. Package README has clear installation, configuration, usage, and safety sections.
2. `.env.example` exists and contains no real secrets.
3. Package metadata reflects an installable local pi package.
4. Changelog documents the initial local package version.
5. No new Jira behavior is added.
6. Tests, typecheck, and package dry-run verification pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
npm run pack:dry-run --workspace @gregho/pi-extension-jira-board
```

Optional local load smoke check:

```bash
pi -e ./packages/pi-extension-jira-board
```

## Status tracking

At M7 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M7 Packaging polish` → `In progress`
2. Commit that status update before package polish work.

At M7 completion:

1. Run verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M7 Packaging polish` → `Done`
3. Add completion notes to this plan.
4. Commit the completed milestone state.
