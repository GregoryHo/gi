# M1 — Generic online routing guidance

## Status

Done.

## SPEC

### Goal

Make natural-language online/public intent easier for the model to recognize without requiring users to mention tool names like `web_search`.

### Scope

- Strengthen `web_research` description/guidance for cues such as:
  - 上網
  - online
  - public
  - remote
  - internet
  - web
  - external
  - published package
  - pi.dev
  - npm
  - GitHub
  - whether something exists outside the current repo
- Strengthen `web_search` guidance to point research/read/external-existence questions toward `web_research`.

### Non-goals

- Sub-agent-specific logic.
- `pi_package_search` or other narrow tools.
- Changing execution behavior.
- Preventing all local grep; local search remains appropriate for explicit current-repo/local-file requests.

## AC

- Tests verify generic online/public cues are present in `web_research` guidance.
- Tests verify `web_search` redirects research/read/external-existence tasks toward `web_research`.
- Existing tests remain green.

## Verification

```bash
npm test --workspace @gregho/pi-extension-web-search
npm run typecheck --workspace @gregho/pi-extension-web-search
npm run pack:dry-run --workspace @gregho/pi-extension-web-search
npm run typecheck
pi -e ./packages/pi-extension-web-search --no-extensions --offline --no-session --list-models gpt-4o
```

## Completion notes

Completed on 2026-06-26.

Implemented changes:

- `web_research` description now explicitly frames the tool as online/public/remote internet research.
- Guidance now includes generic cues: `上網`, `online`, `public`, `remote`, `internet`, `web`, `external`, `pi.dev`, `npm`, `GitHub`, and published package.
- Guidance now says external-existence/public availability questions should consider `web_research` before local search.
- Tests cover generic cue presence without adding narrow tools.

Verification evidence is recorded in `log.md`.
