# Pi agent modes research and roadmap

Date: 2026-06-27

## Purpose

Record the cross-cutting research and recommended implementation route for adding three pi agent capabilities to this repo:

1. Plan mode
2. Goal mode / loop mode
3. Sub-agent mode

This document is intentionally repo-level because the roadmap spans multiple packages and should not be treated as only `pi-extension-plan-mode` planning.

## Research summary

### Pi extension APIs

Local pi docs show that extensions can implement these behaviors through:

- `pi.registerCommand()` for explicit slash-command entrypoints.
- `pi.registerFlag()` for startup modes such as `--plan`.
- `pi.getActiveTools()` / `pi.setActiveTools()` for mode-specific tool scopes.
- `pi.on("tool_call")` for safety gates and command blocking.
- `pi.on("before_agent_start")` for injecting mode-specific instructions.
- `pi.on("context")` for filtering stale extension context.
- `pi.appendEntry()` and `ctx.sessionManager` for persistent session-local state.
- `ctx.ui.setStatus()` / `ctx.ui.setWidget()` for mode and progress UI.
- Pi SDK `createAgentSession()` for possible future pi-native child/sub-agent sessions.

The installed pi examples include a `plan-mode` extension demonstrating a read-only mode, bash allowlist, plan extraction, progress widget, `[DONE:n]` markers, and state restoration. It should be used as reference material, not blindly copied.

### Claude Code findings

Relevant public docs:

- `https://code.claude.com/docs/en/permission-modes`
- `https://code.claude.com/docs/en/sub-agents`
- `https://code.claude.com/docs/en/cli-usage`

Design implications:

- Claude Code plan mode is best understood as a top-level permission/execution mode: inspect and plan before editing.
- Claude subagents are separate delegated agents with isolated context, specialized prompts, optional model overrides, and tool restrictions.
- Public docs support keeping plan mode separate from sub-agent/worker execution.

### Codex CLI findings

Relevant public docs/pages:

- `https://developers.openai.com/codex/cli`
- `https://openai.com/index/introducing-codex/`
- `https://openai.com/index/running-codex-safely/`

Design implications:

- Codex approval modes are useful inspiration for future bounded autonomy levels.
- `codex exec` and cloud/sandbox tasks fit goal/loop execution and delegation patterns.
- For this repo, autonomous loop behavior should start conservatively with explicit limits, stop conditions, and approval gates.

### Repo fit

Existing package `packages/pi-extension-agent-workers` already implements much of the sub-agent substrate:

- Claude Code and Codex CLI worker adapters.
- Built-in worker profiles: planner, reviewer, implementer, verifier.
- LLM-callable `agent_worker_*` tools.
- Workspace preflight and safety.
- Bounded multi-worker dispatch.
- Worker history, status, wait, cancel, and UI widget surfaces.

Therefore, sub-agent mode should not start as a brand-new package that duplicates `agent-workers`. The better path is to reuse and extend `agent-workers`.

## Recommended priority

1. Plan mode first.
   - Lowest risk.
   - Mostly tool gating, prompt injection, and UI state.
   - Creates a plan artifact that later goal/loop mode can consume.
2. Goal / loop mode second.
   - Build conservative bounded autonomy after plan-mode semantics are stable.
   - Start with one-step-at-a-time execution and verification, not full-auto execution.
3. Sub-agent behavior third, by integrating with existing `pi-extension-agent-workers`.
   - Use worker profiles for planning, verification, implementation, and review.
4. Pi-native sub-agent adapter last.
   - Only add after external-worker integration is proven.

## Four-phase roadmap

### Phase 1 — `pi-extension-plan-mode`

Goal: implement a safe planning state before edits or execution.

Initial package:

- `packages/pi-extension-plan-mode/`
- `docs/pi-extension-plan-mode/`

Expected capabilities:

- `/plan` toggle.
- Optional `--plan` startup flag.
- Disable built-in write tools during planning.
- Restrict bash to conservative read-only commands.
- Inject hidden planning instructions.
- Show plan-mode status in UI.
- Persist plan-mode state across reload/resume.

Deferred from Phase 1:

- Plan extraction.
- Approval dialog.
- Execution handoff.
- Goal/loop automation.
- Worker/sub-agent delegation.

### Phase 2 — `pi-extension-goal-mode` conservative MVP

Goal: implement bounded objective execution without full autonomous write behavior.

Possible package:

- `packages/pi-extension-goal-mode/`
- `docs/pi-extension-goal-mode/`

Expected capabilities:

- `/goal <objective>` starts a tracked goal.
- Goal state machine: plan → execute one step → observe → verify → continue/block/done.
- Hard limits: max iterations, max elapsed time, max failures.
- Stop controls: `/goal-stop`, `/goal-status`, possibly `/goal-step`.
- Explicit approval before write-capable actions.
- Acceptance criteria tracking.

Design stance:

- Avoid Codex-style full-auto behavior in the first milestone.
- Prefer one-step execution with verification gates.
- Stop and ask on ambiguity, repeated failure, or safety-sensitive actions.

### Phase 3 — integrate goal mode with `pi-extension-agent-workers`

Goal: let goal/loop mode delegate bounded subtasks to existing worker profiles.

Expected integration:

- Use `agent_worker_start` with `planner` for independent plan generation.
- Use `agent_worker_start` with `verifier` for read-only acceptance checks.
- Use `agent_worker_start` with `reviewer` for independent review.
- Use `implementer` only when workspace/scope are explicit and confirmation is appropriate.
- Use `agent_worker_wait`, `agent_worker_status`, and worker history to update goal state.

Safety stance:

- Goal mode should not bypass existing worker confirmation and workspace collision rules.
- Write-capable workers require clear workspace isolation and explicit user confirmation.
- Worker output should be compact summaries, not raw logs.

### Phase 4 — pi-native sub-agent adapter for `pi-extension-agent-workers`

Goal: add a local pi SDK-backed worker adapter so sub-agent behavior is available without requiring external Claude Code or Codex CLI processes.

Likely implementation location:

- Extend `packages/pi-extension-agent-workers` with a new adapter, e.g. `pi-sdk`.

Expected capabilities:

- Spawn an isolated in-memory child `AgentSession` with pi SDK.
- Use worker profile prompts as child system/context instructions.
- Support tool allowlists per worker profile.
- Support model/thinking-level override where practical.
- Enforce max turns and timeout.
- Return only compact final summary, usage/status metadata, and artifact references.

Non-goals for first pi-native adapter milestone:

- Nested sub-agents.
- Long-lived child sessions.
- Cloud execution.
- Automatic write authority beyond existing worker safety rules.

## Key decision

Treat these as layered capabilities, not three unrelated packages:

```text
Plan mode
  -> produces safe plans and user-approved intent
Goal / loop mode
  -> manages bounded iterative progress
Agent workers / sub-agents
  -> execute or verify isolated subtasks
Pi-native sub-agent adapter
  -> optional future worker backend
```

This keeps early work safe and avoids duplicating the existing `pi-extension-agent-workers` runtime.
