# Changelog

## Unreleased

### Added

- Added a `Ctrl+Alt+P` shortcut that uses the same Plan Mode toggle path as `/plan`.

### Changed

- Changed Plan Mode tool gating to fail closed for unknown custom tools while retaining a reviewed allowlist for inspection, Plan, Web Search, and bounded read-only Subagent tools.
- Added autocomplete-backed `/plan` subcommands for mode, status, artifact, execution, and lifecycle actions while retaining all existing slash-command aliases.
- Limited the execution progress widget to five width-bounded step lines plus a remaining-count summary.

- Made current-plan selection session-scoped with hashed `sessions/<session-key>.json` pointers while keeping workspace artifact history shared and retaining `current.json` as a compatibility mirror.
- Unified session restore and tool/command current resolution so missing custom state can recover from the session pointer without exposing another session's plan.
- Added regression coverage for cross-session isolation, pointer-only restore, missing artifacts, ephemeral sessions, and terminal-plan restore.
- Fixed Plan Mode bash gating to allow safe read-only command chains such as `git status --short --branch && git branch --show-current`, while blocking branch-creation commands.
- Added read-only `plan_get_current` tool for tool-based Plan Mode → Goal Mode orchestration without command coupling or automatic execution.

## 0.1.0 - 2026-06-29

- Scaffolded package and planning docs for plan mode.
- Implemented M1 read-only plan mode with `/plan`, `--plan`, write-tool disabling, conservative bash command gating, hidden plan instructions, UI status, and session state restore.
- Implemented M2 plan capture and approval UX with numbered `Plan:` extraction, `/plan-current`, refine follow-ups, explicit approve-to-exit, and captured-plan session restore.
- Implemented M3 execution progress handoff with `/plan-execute`, execute choice, execution context injection, `[DONE:n]` tracking, progress status/widget, and marker-based completion.
- Implemented M5 plan artifact lifecycle and session indexing with durable local artifacts, `current.json`, `index.json`, `/plan-new`, `/plan-history`, `/plan-switch`, `/plan-complete`, and `/plan-abandon`.
- Fixed execution progress tracking to collect `[DONE:n]` markers from all assistant messages in an `agent_end` batch, preventing TUI progress from falling behind after tool-heavy turns or compaction.
- Fixed `/plan-complete` and `/plan-abandon` for sessions that have a restored session-local captured plan but no M5 artifact id yet.
- Implemented M6 natural-language plan routing context with compact `[ACTIVE PLAN]` summaries and guarded refine/new-objective/resume-switch prompt policy.
- Fixed `[DONE:n]` parsing so markers inside Markdown inline code or fenced code blocks are not counted as execution progress.
- Renamed inactive unfinished plan disposition from archive/keep inactive to pause, with `paused` plan status.
