# Agent workers pi extension roadmap

> Roadmap status: root-level milestones M0-M14 are complete and sealed through v0.2.0; versioned v0.3.0 planning is complete and sealed. Future version planning should live under `versions/<semver>/` and be linked from `index.md` before implementation starts.

## Goal

Build a reusable pi package that lets pi act as a control console for delegated AI agent worker CLI processes.

pi should supervise the work while external tools such as Claude Code or Codex CLI execute delegated tasks in separate local processes.

## Core model

```text
pi interactive session
  -> agent workers extension
    -> worker adapter
      -> external CLI process
        -> stdout/stderr/log/events
```

The extension owns supervision state. Worker adapters own CLI-specific invocation and event parsing.

## Assumptions

- Worker CLIs are installed locally and authenticated outside this package.
- Claude Code and Codex CLI can run non-interactively and can emit machine-readable output in some modes.
- Token and cost reporting depends on each worker CLI and version.
- Runtime logs may contain sensitive prompts, repository context, command output, or account metadata.
- Domain context should be composed outside this package through other extension tools and generic worker tasks.

## Directional milestones

### M0 — Initial docs and package scaffold

Completed by the scaffold commit. Establish package naming, docs governance, and minimal loadable extension scaffold.

### M1 — Worker runner console

Create the smallest useful vertical slice for starting and supervising one local worker process.

Target behavior:

- Start a worker through a bounded command.
- Track status, PID, started/ended timestamps, elapsed time, exit code, and last activity.
- Persist local logs outside git-tracked paths.
- Show concise status in pi through commands or a widget.
- Cancel a running worker.

Plan: `m1-worker-runner-console.md`.

### M2 — Worker event and usage parsing

Add adapter-level event parsing for machine-readable worker output.

Target behavior:

- Parse Claude Code stream JSON where supported.
- Parse Codex CLI JSONL where supported.
- Normalize worker events into a common model.
- Surface usage as `reported`, `estimated`, or `unknown`.
- Preserve raw event diagnostics in local artifacts without exposing secrets to committed fixtures.

Plan: `m2-worker-event-usage-parsing.md`.

### M3 — Real worker CLI adapters

Connect the generic runner and event parsers to real local worker CLIs.

Target behavior:

- Add explicit `claude-code` and `codex-cli` worker adapters.
- Invoke CLIs with direct argv and `shell: false`.
- Parse real machine-readable output with the M2 parsers.
- Surface reported usage, activity summaries, and final text previews in status output.
- Keep one running worker at a time.
- Avoid dangerous permission or sandbox bypass flags by default.

Plan: `m3-real-worker-cli-adapters.md`.

### M4 — Worker invocation API and profiles

Make agent workers a reusable runtime that other extensions can wrap or invoke without depending on a domain-specific command.

Target behavior:

- Define a generic `WorkerRequest` contract for adapter, task, system prompt, mode, model, profile, cwd, timeout, and metadata.
- Define reusable `WorkerProfile` presets for planning, review, implementation, or custom modes.
- Define a compact `WorkerResult` contract that exposes status, final text, usage, activity, log path, and error without exposing raw event payloads by default.
- Add profile-aware commands such as `/worker-run --profile planner <task>`.
- Refactor command execution through a small reusable service API that future integrations can call.

Plan: `m4-worker-invocation-api-profiles.md`.

### M5 — LLM tool facade

Expose agent workers as LLM-callable pi tools so natural-language orchestration can combine this extension with other extensions without domain coupling.

Target behavior:

- Register `agent_worker_start` for worker delegation through the M4 request/profile service.
- Register `agent_worker_status` for compact run status.
- Register `agent_worker_cancel` for cancelling a running worker.
- Register `agent_worker_list_profiles` so the LLM can discover planner/reviewer profiles.
- Share one `AgentWorkerService` instance between slash commands and tools.
- Keep outputs compact and omit raw event payloads by default.

Plan: `m5-llm-tool-facade.md`.

### M6 — Orchestration examples and recipes

Document concrete natural-language and tool-call recipes that prove M5 can be composed with other extensions without runtime coupling.

Target behavior:

- Document Jira focused issue planning via Jira tools plus `agent_worker_start` with the `planner` profile.
- Document Jira focused issue implementation delegation via Jira tools plus an explicit worker adapter.
- Document standalone milestone planning and implementation delegation.
- Document safe demo-tool smoke testing.
- Explain how to interpret compact worker outputs such as `runId`, `status`, `usage.source`, `activity`, `finalText`, and `logPath`.

Plan: `m6-orchestration-recipes.md`.

### M7 — Worker workspace picker and preflight

Add native pi UI workspace selection and lightweight preflight checks so delegated workers run in the intended repository.

Target behavior:

- Show the current worker workspace and git-root/preflight hints.
- Pick a workspace for a single run through native `ctx.ui.select()` and manual `ctx.ui.input()` fallback.
- Support explicit `/worker-run --cwd <path> ...`.
- Support `/worker-run --pick-cwd ...` for one-run native workspace selection.
- Use current pi cwd by default when no cwd is specified.
- Validate cwd before spawning and show effective cwd in real-worker confirmation.
- Warn, without hard-blocking, when the workspace appears mismatched for the task.

Plan: `m7-worker-workspace-picker-preflight.md`; follow-up semantic adjustment: `m7.1-per-run-workspace-assignment.md`.

### M8 — v0.1.0 release preparation

Prepare the first usable local package release after the initial worker runtime milestones.

Target behavior:

- Bump package version to `0.1.0`.
- Promote changelog from Unreleased to a dated `0.1.0` section.
- Update README/docs status for the initial release.
- Verify tests, typecheck, dry-run packing, and non-interactive pi load.
- Avoid committing unrelated `package-lock.json` changes.

Plan: `m8-v0.1.0-release.md`.

### M9 — Worker wait/timeout and rich run summaries

Completed for `v0.2.0`. Make delegated-worker loops easier to drive from LLM tools and slash commands.

Target behavior:

- Implement the existing `timeoutMs` request field as an enforced run timeout.
- Add a compact wait surface, such as `agent_worker_wait` and `/worker-wait <id>`, so callers can wait for completion without hand-written polling loops.
- Enrich compact status/wait summaries with timestamps, elapsed time, profile/mode, timeout data, status reason, usage, activity, final preview, and log path.
- Report timeout/cancellation outcome clearly without exposing raw logs by default.

Plan: `m9-worker-wait-timeout-rich-summaries.md`.

### M10 — Run artifact index and recent history

Completed for `v0.2.0`. Preserve compact run metadata locally so users can inspect recent worker history after pi restarts.

Target behavior:

- Write compact run metadata to a local artifact index under `~/.pi/agent/agent-workers/`.
- Add recent-history surfaces such as `agent_worker_list_runs` and `/worker-history`.
- Do not attempt to regain process control after restart; historical state is informational.
- Keep raw logs and sensitive payloads out of committed fixtures/docs.

Plan: `m10-run-artifact-index-history.md`.

### M11 — Expanded safe profiles: implementer and verifier

Completed for `v0.2.0`. Add implementation and verification ergonomics without changing the package's safety defaults.

Target behavior:

- Add an `implementer` profile for focused code changes with explicit verification and no unrelated refactors.
- Add a read-only `verifier` profile for independent acceptance/testing checks; prefer this name over `qa`.
- Expand profile metadata so tools, widgets, and future scheduling can distinguish read-only from write-capable workers.
- Keep real-worker confirmation requirements and avoid permission/sandbox bypass flags.

Plan: `m11-expanded-safe-profiles.md`.

### M12 — Persistent worker widget cards

Completed for `v0.2.0`. Make worker state visible in pi without repeated status commands.

Target behavior:

- Use pi's persistent widget surface to show an `agent-workers` widget in interactive sessions.
- Render up to 6 compact card-like worker summaries.
- Include status, adapter/profile, cwd basename, elapsed time, timeout hint, task preview, activity, and final/error preview.
- No-op safely in non-UI modes and never expose raw logs in the widget.

Plan: `m12-worker-widget-cards.md`.

### M13 — Bounded six-worker dispatch

Completed for `v0.2.0`. Support limited multi-worker delegation with conservative workspace safety.

Target behavior:

- Replace the one-running-worker limit with a hard maximum of 6 active worker slots.
- Allow concurrent read-only workers, including verifier/reviewer style work.
- Treat write-capable workers conservatively and block same-workspace collisions by default.
- Allow separate write-capable workers only when assigned to distinct worktrees/cwds and explicitly confirmed.
- Keep the widget/status surfaces understandable for multiple active workers.

Plan: `m13-bounded-six-worker-dispatch.md`.

### M14 — v0.2.0 release preparation

Completed for `v0.2.0`. Package the reliable multi-worker delegation loop after M9-M13 are complete.

Target behavior:

- Bump package version to `0.2.0`.
- Promote changelog entries into a dated `0.2.0` section.
- Update README/docs status.
- Verify tests, typecheck, dry-run packing, and non-interactive pi load.

Plan: `m14-v0.2.0-release.md`.

## Deferred beyond v0.2.0

- No domain-specific command integration in the core runtime.
- No cloud worker orchestration.
- No default dangerous sandbox or permission bypass mode.
- No claims of exact token/cost usage without reported worker data.
- No parallel write-capable worker execution without isolation design.
