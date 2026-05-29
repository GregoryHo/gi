# Agent workers extension milestone tracker

> v0.2.0 is sealed. This root tracker is historical for the initial unversioned planning era through v0.2.0. For new product iterations, use versioned docs under `versions/<semver>/` and update `index.md`.

| Milestone | Status | Target outcome | Notes |
| --- | --- | --- | --- |
| M0 Initial docs and package scaffold | Done | Repo contains docs/package scaffold and naming decision | Minimal loadable extension scaffold only |
| M1 Worker runner console | Done | Start, monitor, log, status, and cancel one local worker process | Implemented safe demo adapter, one-running-worker lifecycle, local logs, status/log/cancel commands, and unknown usage reporting |
| M2 Worker event and usage parsing | Done | Normalize worker JSON events and usage reporting by adapter capability | Implemented sanitized Claude/Codex parser support, reported usage normalization, unknown fallback, malformed-line fallback, and compact summaries |
| M3 Real worker CLI adapters | Done | Run explicit Claude Code and Codex CLI worker adapters using M2 parsers | Implemented explicit real adapters, confirmation gate, CLI validation, safe argv, parser wiring, and reported usage/status output |
| M4 Worker invocation API and profiles | Done | Define reusable WorkerRequest/Profile/Result contracts and profile-backed invocation | Implemented exported request/profile/result/service APIs, built-in planner/reviewer profiles, profile-backed `/worker-run`, and compact result shaping |
| M5 LLM tool facade | Done | Expose agent workers as LLM-callable tools over the generic service API | Implemented `agent_worker_start`, `agent_worker_status`, `agent_worker_cancel`, and `agent_worker_list_profiles` with shared command/tool state and compact outputs |
| M6 Orchestration examples and recipes | Done | Document natural-language/tool-call recipes for Jira + workers and standalone workers | Implemented orchestration recipe docs and README guidance; no new runtime surfaces or domain-specific code |
| M7 Worker workspace picker and preflight | Done | Let users select/validate worker cwd through native pi UI before delegation | Implemented native workspace picking/preflight; M7.1 adjusts semantics to per-run assignment |
| M7.1 Per-run workspace assignment | Done | Remove sticky workspace defaults and make cwd explicit per worker run | Implemented effective cwd = explicit cwd or current pi cwd, plus `/worker-run --pick-cwd` for one-run native selection |
| M8 v0.1.0 release preparation | Done | Bump package to v0.1.0 and prepare release docs after M0-M7.1 | Released package metadata/docs as `0.1.0`; no runtime behavior changes |
| M9 Worker wait/timeout and rich run summaries | Done | Enforce worker timeouts, add wait surfaces, and return richer compact status | Implemented enforced `timeoutMs`, `timed_out` status, `agent_worker_wait`, `/worker-wait`, and richer compact summaries |
| M10 Run artifact index and recent history | Done | Persist compact local run metadata for post-restart recent-history inspection | Implemented compact local run index, `agent_worker_list_runs`, `/worker-history`, and historical-only informational summaries |
| M11 Expanded safe profiles: implementer and verifier | Done | Add implementation and verification profiles with safety metadata | Implemented `implementer` and `verifier` profiles, read-only/write-capable metadata, expanded profile listing, and safety prompts |
| M12 Persistent worker widget cards | Done | Show current/recent workers as persistent card-like pi widget summaries | Implemented interactive `agent-workers` widget with up to 6 compact current/recent worker cards and non-UI no-op behavior |
| M13 Bounded six-worker dispatch | Done | Support up to 6 active worker slots with conservative workspace collision rules | Implemented up to 6 active slots, read-only concurrency, write-capable workspace collision blocking, safety metadata, and multi-run status/widget visibility |
| M14 v0.2.0 release preparation | Done | Package reliable multi-worker delegation loop improvements as v0.2.0 | Bumped package/docs to `0.2.0`, promoted changelog, verified release commands, and left lockfile unchanged |

## Roadmap status

M0 through M14 are complete. `v0.2.0` packages the reliable multi-worker delegation loop: wait/timeout behavior, richer worker summaries, local run indexing, implementer/verifier profiles, persistent widget cards, bounded six-worker dispatch, and release prep. Jira/tool composition remains covered by the completed M5/M6 generic tool and recipe model.
