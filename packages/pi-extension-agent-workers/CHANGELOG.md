# Changelog

## Unreleased

### Added

- Added bounded complete Pi SDK child results with private run-log fallback for oversized output.
- Added native child system-prompt, exact model, thinking-level, and max-turn option pass-through with a default 20-turn cap.
- Added a distinct `turn_limit` terminal reason and direct tests for the minimal child resource boundary and failure/missing-result outcomes.

### Changed

- Pi SDK profile instructions now use the child session's actual system prompt instead of being embedded in user task text.

## 0.4.0 - 2026-07-10

### Added

- Added a `pi-sdk` worker adapter backed by local pi SDK child sessions, including async adapter runtime support, compact final/usage event shaping, confirmation-gated public surfaces, and conservative read-only/write-capable tool scopes.
- Added async adapter lifecycle coverage for success, failure, cancellation, and timeout paths.

### Changed

- Worker adapter handling now supports both subprocess-backed adapters and in-memory async adapters without removing the existing `demo`, `claude-code`, or `codex-cli` adapters.

## 0.3.1 - 2026-05-29

### Fixed

- Historical active runs left behind by interrupted/reloaded sessions are now displayed as stale failed history instead of indefinitely running in history/widget views.
- Updated the `/agent-workers` command description to remove stale `M1 commands` wording.

### Removed

- Removed the temporary `/worker-ui-poc` slash command and PoC-only runtime source now that the accepted compact widget direction ships as the default worker widget.

## 0.3.0 - 2026-05-27

### Added

- Workspace-scoped run history defaults with `--all` / `scope: "all"` escape hatches and legacy history fallback matching.
- Original task preview metadata for new profile-backed runs, so history/status/widget displays show the user's delegated task instead of injected system prompts.
- Workspace-scoped safe config via `/worker-config`, including defaults for profile, adapter, timeout, history, and widget preferences.
- Workspace custom profiles from local config, with validation, built-in override rejection, and real-adapter confirmation safety.
- Explicit `/worker-ui-poc` capability probe for widget/footer/custom overlay UI.
- Compact refreshing default worker widget with width-aware cards, slot/start time, task/reason truncation, and two-column wide layout.

## 0.2.0 - 2026-05-26

### Added

- M9 worker wait/timeout support: enforced `timeoutMs`, distinct `timed_out` status, `agent_worker_wait`, `/worker-wait`, and richer compact run summaries.
- M10 compact run history support: local run index, `agent_worker_list_runs`, `/worker-history`, and informational historical summaries after restart.
- M11 expanded safe profiles: `implementer` and `verifier` with read-only/write-capable metadata and focused safety prompts.
- M12 worker widget support: interactive `agent-workers` widget with up to 6 compact current/recent worker cards.
- M13 bounded dispatch support: up to 6 active workers, worker slots, safety metadata in summaries, and conservative write-workspace collision blocking.

### Changed

- Updated planning docs to treat Jira/tool composition as completed through generic orchestration recipes and focus v0.2.0 planning on reliable delegated-worker loops.

## 0.1.0 - 2026-05-25

### Added

- Initial package scaffold for the agent workers pi extension.
- M1 worker runner console with safe demo adapter, worker status/log/cancel commands, local log capture, and unknown usage reporting.
- M1 manual-test follow-up: demo adapter supports capped `--duration-ms` for cancellation testing, and `/worker-kill` no longer claims cancellation for already-finished workers.
- M2 worker event parsing for sanitized Claude Code `stream-json` and Codex CLI `exec --json` JSONL shapes, including reported usage normalization, missing-usage fallback to unknown, malformed-line fallback, and compact activity/final-text summaries.
- M3 real worker CLI adapters for explicit Claude Code and Codex CLI runs, with confirmation, CLI availability checks, safe argv construction, `shell: false`, parser wiring, and reported usage/status output.
- M4 worker invocation API and profiles, including `WorkerRequest`, `WorkerProfile`, `WorkerResult`, `AgentWorkerService`, built-in `planner`/`reviewer` profiles, profile-backed `/worker-run`, and compact public result shaping.
- M5 LLM tool facade with `agent_worker_start`, `agent_worker_status`, `agent_worker_cancel`, and `agent_worker_list_profiles`, sharing command state and returning compact non-raw worker summaries.
- M6 orchestration recipes for safe demo smoke, standalone worker planning/implementation, and Jira-tool-plus-worker composition without domain-specific runtime coupling.
- M7 worker workspace picker and preflight, including `/worker-workspace`, `/worker-workspace-pick`, `/worker-run --cwd`, cwd validation/warnings, and effective cwd in tool/confirmation output.
- M7.1 per-run workspace assignment: removed sticky selected workspace defaults and added `/worker-run --pick-cwd` for one-run native workspace selection.
