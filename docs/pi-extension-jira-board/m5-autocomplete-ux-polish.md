# M5 implementation plan — Autocomplete and UX polish

## Status

Done. M5 implemented and manually smoke-tested in an interactive pi session.

## Completion notes

Automated checks passed:

```bash
npm test --workspace @gregho/pi-extension-jira-board
npm run typecheck --workspace @gregho/pi-extension-jira-board
npm run typecheck
```

Latest automated verification result: 35 tests passed and package typecheck passed.

Manual interactive smoke checks passed:

- `CHATAPP-5421` autocomplete suggestions appeared.
- `#5421` shorthand autocomplete suggestions appeared with `JIRA_PROJECT=CHATAPP`.

## Objective

Make Jira issue references easier to insert while typing and polish command documentation, while keeping the extension read-only and responsive.

## SPEC

### Scope

M5 includes:

1. Jira issue key autocomplete provider for interactive pi sessions.
2. Bounded recent issue preload using existing read-only Jira search.
3. Matching for project-key style tokens such as `CHATAPP-54` and optional `#5421` shorthand when `JIRA_PROJECT` is configured.
4. README command/tool usage examples.
5. Tests for token extraction, suggestion filtering, and autocomplete delegation.

### Non-goals

M5 does not include:

- Jira write actions.
- Rich board navigation UI.
- Multi-project interactive picker.
- Persistent cache across sessions.
- Changing M4 command behavior.

### Autocomplete trigger behavior

Autocomplete should activate when the text before the cursor ends with either:

- a Jira key prefix: `PROJECT-123`, `PROJECT-`, or `PROJECT`-style prefix followed by a dash and optional digits.
- a shorthand numeric issue token: `#123` or `#`, only when `JIRA_PROJECT` is configured.

Examples:

| Input before cursor | Behavior |
| --- | --- |
| `Please inspect CHATAPP-54` | Suggest matching `CHATAPP-54xx` issues. |
| `/jira-plan CHATAPP-` | Suggest recent `CHATAPP-*` issues. |
| `look at #5421` with `JIRA_PROJECT=CHATAPP` | Suggest/insert `CHATAPP-5421`. |
| `normal text` | Delegate to existing autocomplete provider. |

### Data loading

Use existing read-only Jira search with bounded defaults:

- If `JIRA_PROJECT` is configured, preload recent open issues:
  - `project = <PROJECT> AND statusCategory != Done ORDER BY updated DESC`
- Max preload count: `50`.
- Suggestion display cap: `20`.
- Avoid descriptions in autocomplete data.

Loading behavior:

- Start preload on `session_start` only when `ctx.hasUI`.
- Do not block session startup longer than necessary; lazy loading on first matching autocomplete is acceptable.
- If config is missing, silently delegate to existing autocomplete and avoid noisy errors.
- If Jira request fails, show at most one notification and keep delegating to built-in autocomplete.
- Respect autocomplete cancellation signals.

### Suggestion format

Each suggestion should insert the full Jira key.

Display:

- label: `CHATAPP-5421`
- description: `[Status] Summary`

For `#5421` shorthand, completion may replace the `#5421` token with `CHATAPP-5421`.

### Suggested file structure

```text
packages/pi-extension-jira-board/src/
├── jira-autocomplete.ts
├── jira-autocomplete.test.ts
└── index.ts
```

Existing README and milestone docs may be updated.

## AC

M5 is complete when all criteria below are true:

1. Autocomplete provider is registered in interactive sessions.
2. Non-Jira input delegates to the previous autocomplete provider.
3. Jira key prefix input returns bounded issue suggestions.
4. `#number` shorthand works when `JIRA_PROJECT` is configured.
5. Missing Jira config does not spam errors and does not break built-in completion.
6. Jira autocomplete suggestions are capped.
7. Autocomplete uses read-only Jira APIs only.
8. README documents commands, tools, env vars, and autocomplete behavior.
9. Tests and typecheck pass.

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

Then type but do not necessarily submit:

```text
/jira-plan CHATAPP-
look at #5421
```

Expected:

- Jira suggestions appear for matching tokens.
- Non-Jira text still uses normal slash/path completion.

## Status tracking

At M5 implementation start:

1. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M5 Autocomplete and UX polish` → `In progress`
2. Commit that status update before code changes.

At M5 completion:

1. Run the verification checks above.
2. Update `docs/pi-extension-jira-board/milestones.md`:
   - `M5 Autocomplete and UX polish` → `Done`
   - `M6 Optional controlled Jira writes` remains `Deferred` unless explicitly started.
   - `M7 Packaging polish` → `Planned` or `Next`
3. Add completion notes to this plan if useful.
4. Commit the completed milestone state.

## Reference

If autocomplete API details are unclear, read the installed pi docs:

- `docs/extensions.md` autocomplete section
- `docs/tui.md` autocomplete provider patterns
- `examples/extensions/github-issue-autocomplete.ts`
