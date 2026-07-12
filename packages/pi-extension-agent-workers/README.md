# Agent workers pi extension

pi package for supervising delegated AI agent worker CLI processes such as Claude Code and Codex CLI.

## Status

v0.4.0 is the current local release. It adds the `pi-sdk` worker adapter for local pi SDK child sessions while preserving the existing demo, Claude Code, and Codex CLI adapters. Roadmap and milestone docs live in [`../../docs/pi-extension-agent-workers`](../../docs/pi-extension-agent-workers).

## Goal

Use pi as the control console while external AI agent CLIs perform delegated work in isolated worker processes.

The first iterations focus on generic worker supervision only:

- M1 — start, monitor, log, and cancel local worker CLI processes.
- M2 — parse machine-readable worker events and expose reported or explicitly unknown usage metrics.
- M3 — run explicit Claude Code and Codex CLI workers through the generic runner.
- M4 — expose reusable `WorkerRequest`, `WorkerProfile`, `WorkerResult`, and `AgentWorkerService` contracts.
- M5 — expose LLM-callable `agent_worker_*` tools for natural-language orchestration.
- M7/M7.1 — preflight worker workspaces and assign cwd per worker run so delegated workers run in the intended repository.
- M9 — enforce worker timeouts, wait for completion, and return richer compact run summaries.
- M10 — persist compact local run metadata and expose recent worker history after restart.
- M11 — add safe `implementer` and `verifier` profiles with metadata for delegated coding workflows.
- M12 — show compact current/recent worker cards in an interactive pi widget.
- M13 — allow up to 6 active workers with conservative workspace collision rules.
- v0.3.0 — workspace-scoped history/config, original task previews, custom profiles, UI capability PoC, and compact refreshing default widget.
- v0.3.1 — remove the temporary `/worker-ui-poc` command and PoC-only runtime source after the default widget shipped, fix stale historical active runs in history/widget displays, and remove stale `M1 commands` wording.
- v0.4.0 — add a `pi-sdk` async adapter that runs bounded local pi SDK child sessions without requiring an external worker CLI process.
- v0.5.0 M1 — preserve bounded complete Pi SDK child results, pass actual child system prompt/model/thinking options, enforce a default/per-request turn cap, and directly test the minimal child resource boundary.
- v0.5.0 M2 — expose the shared worker service through a correlated versioned `pi.events` runtime protocol for separate facade packages.

Cross-extension delegation through LLM tools and recipes is supported while this package remains domain-independent.

## Load or install

Load temporarily while developing:

```bash
pi -e ./packages/pi-extension-agent-workers
```

Install as a local pi package:

```bash
pi install ./packages/pi-extension-agent-workers
```

## Commands

Interactive sessions show an `agent-workers` widget with up to 3 compact cards, prioritizing running, queued, failed, and timed-out runs plus the latest completion. The widget uses narrower original-style cards, slot/run id titles, concrete started time, two-column layout on wide terminals, truncated task/reason fields, and a 5s refresh interval. Non-UI modes skip widget rendering.

The primary autocomplete-backed command is `/worker run|status|history|wait|cancel|log|workspace|config`. Existing worker commands remain compatibility aliases.

Worker commands:

- `/agent-workers` — show extension help and run summary.
- `/worker-workspace` — show the current worker workspace and git-root/preflight hints.
- `/worker-workspace-pick` — pick and print a workspace path/preflight result without setting a default.
- `/worker-config` — show workspace-scoped safe preferences.
- `/worker-config set <key> <value>` — update safe workspace preferences such as `defaultProfile`, `defaultAdapter`, `defaultTimeoutMs`, `historyScope`, `historyLimit`, `widgetPlacement`, or `widgetLimit`.
- `/worker-run --cwd <path> <task>` — start one worker in an explicit workspace for this run.
- `/worker-run --pick-cwd <task>` — choose a workspace with native pi UI for this run only.
- `/worker-run --profile planner <task>` — start the built-in read-only planning profile.
- `/worker-run --profile reviewer <task>` — start the built-in read-only review profile.
- `/worker-run --profile implementer <task>` — start the focused code-change profile; real adapters still require confirmation.
- `/worker-run --profile verifier <task>` — start the read-only acceptance/verification profile.
- `/worker-run --profile <custom> <task>` — start a workspace custom profile defined in local agent-worker config.
- `/worker-run [--adapter demo] [--duration-ms 10000] [--timeout-ms <ms>] <task>` — start one safe demo worker process. `--duration-ms` is optional and capped at 60000 ms for manual cancellation testing. `--timeout-ms` enforces a run deadline.
- `/worker-run --adapter claude-code <task>` — start Claude Code with non-interactive `stream-json` output.
- `/worker-run --adapter codex-cli <task>` — start Codex CLI with `exec --json` output.
- `/worker-run --adapter pi-sdk <task>` — start a bounded local pi SDK child session using an isolated in-memory session and compact worker result capture.
- `/worker-status [id]` — show rich compact status for all in-memory runs or one run.
- `/worker-history [--all] [--limit <n>]` — show recent compact run history, including informational historical runs after restart; defaults to the current workspace.
- `/worker-wait <id> [--wait-ms <ms>]` — wait for one in-memory worker to finish; caller wait timeout does not cancel the run.
- `/worker-log <id>` — show the run log tail.
- `/worker-kill <id>` — cancel a running worker.

Real adapters (`claude-code`, `codex-cli`, and `pi-sdk`) require explicit confirmation in UI, or `--yes` in non-UI mode. Confirmation includes the effective worker workspace. Subprocess adapters use explicit argv with `shell: false`; `pi-sdk` runs in memory without a child process.

Workspace custom profiles can be added to the local workspace config JSON under `profiles`. Example:

```json
{
  "profiles": [
    {
      "name": "docs-checker",
      "description": "Review docs only.",
      "adapter": "demo",
      "mode": "review",
      "systemPrompt": "Review documentation for consistency. Do not modify files.",
      "requireConfirmation": false,
      "readOnly": true,
      "canModifyWorkspace": false,
      "recommendedUse": "Use for local demo docs review."
    }
  ]
}
```

Custom profiles cannot override built-in profile names. Real-adapter custom profiles, including `pi-sdk`, must set `requireConfirmation: true`.

M2/M3 parser integration normalizes final text, activity summaries, and reported usage without exposing raw event payloads in status output. M4 exports a reusable service API for other packages or orchestration layers without coupling those domains into this core extension. The `pi-sdk` adapter maps child assistant final text and usage events into the same worker lifecycle. Compact status/widget surfaces keep previews, while in-memory completed runs retain a bounded complete result; oversized full output remains in the private run log referenced by `finalTextPath`. Pi SDK profile instructions are applied as the child system prompt, exact `provider/model-id` and thinking hints are supported, and child runs default to a 20-turn cap unless a narrower explicit limit is supplied.

## LLM tools

M5 registers tools for natural-language orchestration:

- `agent_worker_start` — start one worker through a profile or explicit adapter.
- `agent_worker_status` — inspect one in-memory run or all in-memory runs; single-run status includes bounded model-visible final text when available.
- `agent_worker_list_runs` — list recent run history, including historical-only informational summaries after restart; defaults to current workspace and accepts `scope: "all"`.
- `agent_worker_wait` — wait for one in-memory worker to finish with an optional caller wait limit and return bounded model-visible final text when available.
- `agent_worker_cancel` — cancel one worker run.
- `agent_worker_list_profiles` — list built-in and workspace custom profiles with safety metadata such as `readOnly`, `canModifyWorkspace`, and `recommendedUse`.

These tools are domain-independent. For example, a Jira extension can provide issue context through its own tools, then the LLM can pass that context to `agent_worker_start` without either extension importing the other. `agent_worker_start` accepts `cwd`; when omitted, it uses the current tool context cwd.

## Orchestration recipes

See [`../../docs/pi-extension-agent-workers/orchestration-recipes.md`](../../docs/pi-extension-agent-workers/orchestration-recipes.md) for copy-pasteable recipes.

Common patterns:

- Pass `cwd` explicitly to `agent_worker_start` / `/worker-run --cwd <path>`, or use `/worker-run --pick-cwd` for a one-run native picker.
- Use `/worker-config` for workspace-scoped safe defaults; config cannot silently disable real-worker confirmation.
- Workspace config may define local custom profiles in its ignored JSON file. Custom profile names cannot override built-ins, and real-adapter custom profiles must require confirmation.
- Safe smoke test: use `agent_worker_start` with `adapter: "demo"`, then `agent_worker_status`.
- Standalone planning: use `agent_worker_start` with `profile: "planner"`.
- Focused implementation: use `profile: "implementer"` only after workspace/scope are clear and confirmation is appropriate.
- Independent verification: use `profile: "verifier"` to check acceptance criteria without modifying files.
- Standalone implementation: use `agent_worker_start` with `adapter: "codex-cli"` after clear user intent or confirmation.
- Pi-native delegation: use `agent_worker_start` or `/worker-run` with `adapter: "pi-sdk"` when you want a local pi SDK child session rather than an external CLI worker.
- Jira + workers: use Jira tools such as `jira_get_focused_issue` first, then pass the compact issue context to `agent_worker_start` as a generic task.

Interpretation tips:

- `slot` identifies the active worker slot when multiple workers are running; at most 6 workers can be active.
- `runId` is the handle for status/wait/cancel/log follow-up while the run is still known in memory.
- `cwd` is the effective worker workspace; confirm it is the intended product repository before relying on code inspection.
- `usage.source` may be `reported`, `estimated`, or `unknown`; unknown is not zero.
- `statusReason`, `timeoutMs`, timestamps, and `elapsedMs` help distinguish completed, failed, cancelled, timed-out, and still-running work.
- Historical runs from `/worker-history` / `agent_worker_list_runs` are informational when `controllable: false`; they cannot be waited on or cancelled after restart. Historical active runs left by interrupted/reloaded sessions are shown as stale failed history instead of indefinitely running.
- `readOnly`, `canModifyWorkspace`, and `workspaceKey` explain concurrency safety decisions.
- `activity` and `finalText` are compact summaries; status/wait expose at most 8,000 final-result characters to the model and point to the private result/log artifact when truncated. Raw logs remain local at `logPath` and may contain sensitive context.

## Safety boundaries

- Do not default to dangerous permission or sandbox bypass modes for external CLIs.
- `pi-sdk` child sessions use a minimal child resource loader in this MVP: no nested `agent-workers` tools, no project-local child extension discovery, no long-lived child sessions, and no cloud execution added by this package.
- Validate the worker workspace before delegating product/Jira work; preflight warnings are advisory and do not hard-block.
- Runtime artifacts must live in ignored local directories or under `~/.pi/agent/agent-workers/`.
- Token and cost metrics must be marked as reported, estimated, or unknown; missing usage is shown as unknown, not zero.
- Up to 6 workers may run concurrently when safety rules allow it.
- Read-only workers may share a workspace. Write-capable workers are blocked from sharing the same git root/workspace while another write-capable worker is active.
- Write-capable or destructive worker modes require explicit user confirmation.
- `pi-sdk` read-only runs expose only `read`, `grep`, `find`, and `ls`; write-capable `pi-sdk` runs expose `bash`, `edit`, and `write` only after the same confirmation and workspace-collision safety rules apply.

## Development verification

From the repo root:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```
