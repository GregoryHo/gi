# Jira board extension v0.2.0 milestones

## Status summary

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M1 Onboarding and encrypted local config | Done | Users can configure Jira through `/jira-onboarding` without plaintext secrets | Uses local reversible encryption, not OS keychain |
| M2 Project and issue query primitives | Done | Extension can query projects/issues with filters and paging | Internal helpers first; tools remain bounded |
| M3 Interactive browse UI and widget cards | Done | Users can browse/select projects/issues and see card/item-style widget context | Uses `ctx.ui.custom()` for interaction and `setWidget()` for persistent display |
| M3.1 Active project context, faceted issue filters, and focused context bridge | Done | Project/board/filter/focused issue context is usable by agents through explicit read-only tools | No automatic context injection |
| M3.2 Jira metadata system | Optional / deferred | Full metadata providers/cache for richer filter values | Not required for v0.2.0 unless promoted |
| M3.3 Command and cockpit consolidation | Done | Commands and widget behavior converge on one Jira context cockpit | Renumbered from former M3.4 |
| M3.4 Board picker and active board context | Done | Users can browse/select boards and see active board in cockpit/context | Foundation for Scrum/Kanban scope |
| M3.5 Scrum board active sprint scope | Done | Scrum board selection narrows issue browsing to active sprint | Depends on M3.4 board foundation |
| M3.6 Kanban board saved filter scope | Done | Kanban board selection narrows issue browsing via saved filter JQL | Depends on M3.4 board foundation |
| M4 Stabilization and smoke-test fixes | Done | User-reported smoke-test findings are fixed or explicitly deferred | Manual smoke accepted |
| M5 v0.2.0 docs, polish, and release prep | Done | Package docs, changelog, tests, and dry-run are ready for release | Release prep complete |

## M1 — Onboarding and encrypted local config

### Outcome

Users can run `/jira-onboarding` to configure Jira access without editing shell environment variables, and password/token values are not stored in plaintext.

### Scope

- Add `/jira-onboarding` command.
- Add local Jira config loader and writer.
- Preserve env vars as explicit overrides.
- Add encrypted secret storage using Node built-in `crypto`.
- Add local `master.key` generation and file permission hardening where supported.
- Add masked secret input using custom UI, not plain `ctx.ui.input()`.
- Validate connectivity before saving or before final confirmation.
- Ensure config summaries never print secret values.

### Non-goals

- macOS Keychain, Linux Secret Service, Windows Credential Manager, or external vault integrations.
- Plaintext secret storage.
- Asking the LLM to handle secrets.
- Changing Jira write safety boundaries.

### Acceptance criteria

- `/jira-onboarding` works in interactive mode and refuses clearly when UI is unavailable.
- User can enter Jira URL, account, auth type, and secret.
- Secret input is masked in the TUI.
- Saved config does not contain plaintext password/token.
- Runtime config can decrypt and use the saved secret.
- Env vars continue to work and override local config.
- `/jira-status` works with local encrypted config.
- Tests cover config precedence, encryption/decryption, missing/corrupt secret handling, and sanitized summaries.

## M2 — Project and issue query primitives

### Outcome

The extension has reusable read-only helpers for pageable/filterable Jira project and issue queries.

### Scope

- Add project query helper with filter and paging support where Jira API permits.
- Add Jira Server/Data Center compatible fallback for project listing.
- Extend issue search internals to support `startAt`, `maxResults`, and filter-friendly JQL composition.
- Keep LLM-facing tool outputs bounded and compact.
- Add tests for paging, caps, fallback behavior, and JQL generation.

### Non-goals

- Full board clone UI.
- Unbounded project or issue dumps.
- New Jira write APIs.

### Acceptance criteria

- Project query can filter by text and return a bounded page.
- Issue query supports paging with `startAt` and capped `maxResults`.
- Existing tools remain safe by default.
- API failures are sanitized.
- Tests and typecheck pass.

## M3 — Interactive browse UI and widget cards

### Outcome

Users can browse Jira projects/issues interactively and keep selected Jira context visible in a richer widget.

### Scope

- Add interactive browse command(s), likely `/jira-projects`, `/jira-issues`, and/or `/jira-browse`.
- Use `ctx.ui.custom()` for filterable/paged selection UI.
- Store selected project/issue context in extension-local session state or local config as appropriate.
- Update widget formatting to support card/item-style issue rows.
- Keep widget bounded and readable at narrow terminal widths.

### Non-goals

- Large full-screen Jira client.
- Drag/drop board manipulation.
- Automatic Jira transitions from browser selection.

### Acceptance criteria

- Users can filter/page projects and select a project.
- Users can filter/page issues and select or focus an issue.
- Widget shows selected context with compact cards/items.
- Widget never displays secrets or raw Jira payloads.
- Tests cover formatting and interaction state helpers where practical.

## M5 — Docs, polish, and release prep

### Outcome

v0.2.0 is documented, verified, and ready to release.

### Scope

- Update package README for onboarding, encrypted config, browse commands, and widget behavior.
- Update package CHANGELOG for v0.2.0.
- Update version docs and archive/index state.
- Run full package verification and package dry-run.

### Acceptance criteria

- v0.2.0 docs explain security limitations honestly.
- v0.2.0 changelog is complete.
- Tests, typecheck, and pack dry-run pass.
- Root docs point to the released/stable version after release.
