# Jira board extension v0.2.0

## Status

Release prep complete. M1-M4 implementation/manual smoke verification and M5 automated/package verification are complete.

## Theme

Improve first-time setup and interactive Jira navigation:

1. Replace env-only configuration with `/jira-onboarding` and encrypted local credentials.
2. Upgrade project/issue browsing and widget layout with filterable, pageable lists.

## Goals

- Let users configure Jira without editing shell env vars.
- Avoid storing Jira password/token in plaintext config files.
- Keep secrets out of widgets, command output, logs, docs, and LLM-facing tool output.
- Let users query/select Jira projects interactively with filtering and paging.
- Let users query/select issues interactively with filtering and paging.
- Make the widget more useful as a compact Jira context panel using card/item-style rows.

## Non-goals

- OS-specific secret stores such as macOS Keychain.
- Enterprise-grade vault integration.
- Jira issue creation, assignment, label mutation, or bulk writes.
- LLM-facing Jira write tools.
- Full kanban/scrum board clone inside pi.
- Persisting private raw Jira API payloads.

## Design direction

### Configuration and secrets

v0.1.0 env vars remain supported as overrides, but v0.2.0 adds local config loaded from the pi agent directory.

Proposed precedence:

```text
env vars > encrypted local Jira config > missing config
```

Suggested local files:

```text
~/.pi/agent/jira-board/
├── config.json
├── secrets.json
└── master.key
```

- `config.json` stores non-secret values such as base URL, user, default project, board id, and secret reference.
- `secrets.json` stores encrypted password/token blobs.
- `master.key` is generated locally with random bytes and restricted file permissions where possible.
- Encryption should use Node built-in `crypto`, preferably AES-256-GCM.
- This protects against accidental plaintext exposure, but it is not a replacement for an OS keychain or enterprise secret vault.

### `/jira-onboarding`

The onboarding command should guide users through:

1. Jira server URL.
2. Account username/email.
3. Auth type: password or token.
4. Masked password/token entry.
5. Read-only connectivity check.
6. Optional default project selection.
7. Optional default board selection or manual board id entry.
8. Save local config and encrypted secret.

The secret must not be displayed in cleartext during input, preview, status, widget, or logs.

### Project and issue browsing

v0.2.0 should add internal pagination-aware query helpers and interactive UI commands for browsing Jira data.

Potential commands:

- `/jira-projects` — browse/filter accessible projects and set a default project.
- `/jira-issues` — browse/filter issues for the selected/default project.
- `/jira-browse` — optional combined project → issue browser if the separate commands feel too fragmented.

Implementation should prefer Jira APIs with paging when available and fall back safely for Jira Server/Data Center compatibility.

### Widget layout

The widget should evolve from a compact status summary to a small context panel. It should support card/item-style issue rows while staying bounded and readable.

Possible layout:

```text
Jira CHATAPP · Sprint 42 · Page 1 · 25/336
Filter: statusCategory != Done ORDER BY updated DESC

CHATAPP-5421  In Progress  P2
Fix onboarding error when token expires
assignee: greg · labels: auth, mobile

CHATAPP-5400  UAT Verify  P3
Polish issue picker layout
assignee: unassigned
```

The widget remains display-oriented; deeper navigation should use `ctx.ui.custom()` interactive components.

## Docs

- `milestones.md` tracks v0.2.0 delivery.
- `log.md` is append-only for planning and milestone evidence.
- Add milestone-specific implementation plans before code work starts.
