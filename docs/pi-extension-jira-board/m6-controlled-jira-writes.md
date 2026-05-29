# M6 implementation plan — Controlled Jira writes

## Status

Done. M6 implemented and manually smoke-tested against real Jira.

## Completion notes

Automated checks passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Latest automated verification result: 43 tests passed and package typecheck passed.

Manual Jira smoke checks passed:

- `/jira-comment <KEY>` safety and behavior verified by user.
- `/jira-transition <KEY>` safety and behavior verified by user.
- Preview/confirmation behavior was verified as correct.

## Objective

Add explicitly confirmed Jira write actions for the two workflows that are useful after planning work: adding comments and transitioning issues. Keep all writes interactive-only by default, previewed before execution, and intentionally limited to comments/transitions.

## SPEC

### Scope

M6 includes:

1. `/jira-comment <KEY>` command.
2. `/jira-transition <KEY>` command.
3. Read-only transition listing helper.
4. Write helpers for:
   - `POST /rest/api/2/issue/{key}/comment`
   - `POST /rest/api/2/issue/{key}/transitions`
5. Confirmation previews before every write.
6. Tests for path/body builders, argument parsing, preview formatting, and non-interactive guard helpers.

### Non-goals

M6 does not include:

- Assigning issues.
- Adding/removing labels.
- Creating issues.
- Automatic transition selection based on issue state.
- Non-interactive writes.
- Agent tool writes by default.

### Command: `/jira-comment <KEY>`

Purpose: add a Jira comment after explicit user confirmation.

Behavior:

1. Parse issue key from args.
2. Require interactive UI (`ctx.hasUI`). If unavailable, refuse with a clear message.
3. Open an editor for comment body.
4. If body is empty or cancelled, do nothing.
5. Show preview including issue key and full comment body.
6. Ask for confirmation via `ctx.ui.confirm`.
7. Only after confirmation, call:

```text
POST /rest/api/2/issue/{issueKey}/comment
```

Body:

```json
{ "body": "comment text" }
```

### Command: `/jira-transition <KEY>`

Purpose: transition a Jira issue after explicit user selection and confirmation.

Behavior:

1. Parse issue key from args.
2. Require interactive UI (`ctx.hasUI`). If unavailable, refuse with a clear message.
3. Fetch available transitions:

```text
GET /rest/api/2/issue/{issueKey}/transitions
```

4. Show transition names via `ctx.ui.select`.
5. If selection is cancelled, do nothing.
6. Show preview including issue key, selected transition, and target status if available.
7. Ask for confirmation via `ctx.ui.confirm`.
8. Only after confirmation, call:

```text
POST /rest/api/2/issue/{issueKey}/transitions
```

Body:

```json
{ "transition": { "id": "transition-id" } }
```

### Safety behavior

- Every write requires interactive confirmation.
- Non-interactive mode refuses writes.
- Commands never infer or auto-select a transition.
- No Jira write tool is exposed to the LLM in M6.
- Error messages must remain sanitized by the existing Jira client.
- Preview text must not include credentials.

### Suggested file structure

```text
packages/pi-extension-jira-board/src/
├── jira-writes.ts
├── jira-writes.test.ts
└── index.ts
```

Existing `jira-types.ts` may be updated with transition DTOs.

## AC

M6 is complete when all criteria below are true:

1. `/jira-comment <KEY>` exists and refuses to run without interactive UI.
2. `/jira-comment <KEY>` opens an editor, previews the comment, and writes only after confirmation.
3. `/jira-transition <KEY>` exists and refuses to run without interactive UI.
4. `/jira-transition <KEY>` lists available transitions, previews the selected transition, and writes only after confirmation.
5. Cancelled editor/select/confirm actions do not call Jira write endpoints.
6. No assign/labels/create issue writes are implemented.
7. No Jira write tool is exposed to the LLM in M6.
8. Tests and typecheck pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Manual interactive smoke check with real Jira env and a safe test issue:

```bash
pi -e ./packages/pi-extension-jira-board
```

Then run:

```text
/jira-comment <SAFE-ISSUE-KEY>
/jira-transition <SAFE-ISSUE-KEY>
```

Expected:

- Comment and transition both show previews.
- Cancelling at preview does not mutate Jira.
- Confirming writes exactly the chosen comment or transition.

## Status tracking

At M6 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M6 Optional controlled Jira writes` → `In progress`
2. Commit that status update before code changes.

At M6 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M6 Optional controlled Jira writes` → `Done`
   - `M7 Packaging polish` remains `Planned` or becomes `Next`
3. Add completion notes to this plan if useful.
4. Commit the completed milestone state.

## Reference

If API details are unclear, read:

- `docs/pi-extension-jira-board/api-reference-notes.md`
- `/path/to/example/plugins/tracker-jira/src/index.ts`
