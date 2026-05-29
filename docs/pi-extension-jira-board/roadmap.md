# Jira board pi extension roadmap

## Goal

Build a reusable pi package that exposes self-hosted Jira board and issue context to pi agents, so the agent can quickly inspect project/ticket state and generate implementation or bug-fix plans.

## Assumptions

- Jira is self-hosted Jira Server/Data Center compatible with Jira REST API v2 and Agile API 1.0.
- Initial auth will use Basic auth from environment variables.
- The extension should be package-like and loaded only when needed, not auto-enabled for every repo.
- Initial scope is read-only. Jira write operations are intentionally deferred.

## Milestones

### M0 — Initial plan and scaffold

**Outcome:** Repo has a package scaffold and agreed follow-up roadmap.

Deliverables:

- Root repo guidance and workspace metadata.
- Jira extension package folder.
- README with intended local load/install flow.
- Roadmap and milestone tracker.

Verification:

- `git status` shows the scaffold on a dedicated branch.
- Package can be loaded structurally by pi via the package manifest once dependencies are installed.

### M1 — Read-only Jira config and client

**Outcome:** Extension can connect to Jira Server safely and fetch basic data.

Deliverables:

- Environment-based config loader.
- Shared Jira REST client for `/rest/api/2` and `/rest/agile/1.0`.
- Typed DTOs for issue, board, sprint, and search responses used by the extension.
- `/jira-status` command to validate config and connectivity without exposing secrets.

Verification:

- Missing config reports actionable errors.
- Connectivity command can fetch current user or a configured project.
- Failed Jira responses include method, path, status, and sanitized body snippet.

### M2 — Agent tools for issue and search context

**Outcome:** LLM can request compact Jira issue/project information through custom tools.

Deliverables:

- `jira_get_issue` tool.
- `jira_search_issues` tool with JQL and safe max-result limits.
- Response mapper that returns compact, plan-friendly issue summaries.
- Output truncation/field limits to protect model context.

Verification:

- Tool results are small enough for context by default.
- Issue descriptions are truncated with clear indication when shortened.
- Search defaults avoid dumping entire projects.

### M3 — Board and sprint snapshot widget

**Outcome:** Interactive pi sessions show the current Jira board/sprint state in a compact widget.

Deliverables:

- Board and active sprint lookup.
- `jira_board_snapshot` tool.
- `/jira-refresh` command.
- `ctx.ui.setWidget()` display with status counts, active sprint, and selected project/board.

Verification:

- Widget works only when UI is available.
- Non-interactive modes still expose tools without relying on widget state.
- Snapshot is cached briefly and refreshable.

### M4 — Planning commands

**Outcome:** User can turn a Jira ticket into an implementation or fix-planning prompt.

Deliverables:

- `/jira-issue <KEY>` command for quick display.
- `/jira-plan <KEY>` command that sends a structured planning prompt to the agent.
- `/jira-fix <KEY>` command variant biased toward debugging/regression analysis.
- Prompt format includes summary, status, labels, assignee, priority, description, acceptance criteria if present, and explicit unknowns.

Verification:

- Commands fail gracefully when issue key is omitted.
- Generated prompts do not include secrets or excessive raw Jira payload.
- Plans request tests and risk/clarification sections.

### M5 — Autocomplete and UX polish

**Outcome:** Jira issue references are easy to insert while typing.

Deliverables:

- Autocomplete provider for issue keys, likely triggered by project key prefix or `#`-style query.
- Configurable default project and board.
- Clear command help in README.
- Optional compact footer/status indicator for selected Jira context.

Verification:

- Autocomplete delegates to existing pi completion when not matching Jira syntax.
- Autocomplete has timeout/cancellation behavior and does not block typing.

### M6 — Optional controlled Jira writes

**Outcome:** If needed, extension can make safe Jira updates with explicit confirmation.

Deliverables:

- `jira_add_comment` command/tool.
- Optional transition command/tool.
- Confirmation UI for every write action.
- Dry-run preview before mutation.

Verification:

- No write action executes without confirmation in interactive mode.
- Non-interactive write behavior is either disabled by default or requires an explicit config flag.

### M7 — Packaging and distribution polish

**Outcome:** Package is easy to reuse across local projects.

Deliverables:

- Finalized package metadata and keywords.
- Example `.pi/settings.json` snippet or install instructions.
- Versioning and changelog convention.
- Minimal smoke test or typecheck workflow.

Verification:

- `pi -e ./packages/pi-extension-jira-board` loads the package.
- `pi install ./packages/pi-extension-jira-board` works for local persistent use.
