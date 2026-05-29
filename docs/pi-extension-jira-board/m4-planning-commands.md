# M4 implementation plan — Planning commands

## Status

Done. M4 implemented and manually smoke-tested against real Jira.

## Completion notes

Automated checks passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Latest automated verification result: 28 tests passed and package typecheck passed.

Manual Jira smoke checks passed:

- `/jira-plan CHATAPP-5421` generated an implementation-planning prompt from real Jira context.
- `/jira-fix CHATAPP-5421` generated a debugging-oriented bug-fix prompt from real Jira context.

## Objective

Add user-facing slash commands that turn a compact Jira issue into a structured implementation or bug-fix planning prompt, so a user can quickly move from ticket context to an actionable pi agent plan.

## SPEC

### Scope

M4 includes:

1. `/jira-issue <KEY>` command for quick issue display.
2. `/jira-plan <KEY>` command that fetches an issue and sends a structured implementation-planning prompt to the agent.
3. `/jira-fix <KEY>` command that fetches an issue and sends a debugging/regression-oriented planning prompt to the agent.
4. Pure prompt builder functions with tests.
5. Command argument validation and graceful user-facing errors.

### Non-goals

M4 does not include:

- Autocomplete.
- Board navigation UI.
- Creating implementation task files.
- Jira writes: comments, transitions, assignments, issue creation, or field updates.
- Automatic code changes after generating the prompt.

### Command: `/jira-issue <KEY>`

Purpose: fetch one issue and display compact issue context for the user.

Behavior:

1. Parse a Jira issue key from command args.
2. If missing, notify a clear usage message.
3. Fetch the issue through the existing read-only client and compact mapper.
4. In interactive mode, update the Jira widget with compact issue lines and notify success.
5. Do not send a planning prompt or trigger an agent turn.

### Command: `/jira-plan <KEY>`

Purpose: fetch one issue and send an implementation-planning prompt to the agent.

Prompt must ask for:

- Problem summary.
- Relevant assumptions and unknowns.
- Likely affected modules/files to inspect.
- Step-by-step implementation plan.
- Test plan.
- Risks and rollback/verification notes.
- Clarifying questions if the Jira ticket is insufficient.

### Command: `/jira-fix <KEY>`

Purpose: fetch one issue and send a bug-fix/debugging prompt to the agent.

Prompt must ask for:

- Symptom summary.
- Reproduction and evidence-gathering plan.
- Root-cause investigation plan.
- Minimal fix strategy.
- Regression tests.
- Risk/unknowns/clarifying questions.

### Prompt source data

Use compact issue context only:

- key
- url
- summary
- status/statusCategory
- issueType
- priority
- assignee
- labels
- truncated description
- descriptionTruncated flag

Do not include raw Jira API payloads or credentials.

### Suggested file structure

```text
packages/pi-extension-jira-board/src/
├── planning-prompts.ts
├── planning-prompts.test.ts
├── jira-commands.ts
└── index.ts
```

Existing command registration in `index.ts` may move into `jira-commands.ts` if that keeps wiring simple.

## AC

M4 is complete when all criteria below are true:

1. `/jira-issue <KEY>` fetches and displays compact issue context.
2. `/jira-plan <KEY>` sends a structured implementation-planning prompt to the agent.
3. `/jira-fix <KEY>` sends a structured bug-fix/debugging prompt to the agent.
4. Missing issue key errors are clear and do not call Jira.
5. Generated prompts include tests, risks, and unknowns/clarifying questions.
6. Generated prompts do not include raw Jira JSON, credentials, or excessive payloads.
7. No Jira write endpoints are implemented or exposed.
8. Tests and typecheck pass.

## Verification commands/checks

From repo root:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Manual interactive smoke check with real Jira env:

```bash
pi -e ./packages/pi-extension-jira-board
```

Then run:

```text
/jira-issue CHATAPP-5421
/jira-plan CHATAPP-5421
/jira-fix CHATAPP-5421
```

Expected:

- `/jira-issue` updates compact visible context without triggering a planning turn.
- `/jira-plan` starts an agent turn with implementation-planning instructions.
- `/jira-fix` starts an agent turn with debugging-oriented instructions.

## Status tracking

At M4 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M4 Planning commands` → `In progress`
2. Commit that status update before code changes.

At M4 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M4 Planning commands` → `Done`
   - `M5 Autocomplete and UX polish` → `Planned` or `Next`
3. Add completion notes to this plan if useful.
4. Commit the completed milestone state.

## Reference

If API details are unclear, read:

- `docs/pi-extension-jira-board/api-reference-notes.md`
- `/path/to/example/plugins/tracker-jira/src/index.ts`
