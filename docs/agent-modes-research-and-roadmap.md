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

Existing package `packages/pi-extension-agent-workers` implements the shared execution/control-plane substrate:

- Claude Code and Codex CLI worker adapters.
- A pi SDK-backed child-session adapter since v0.4.0.
- Built-in worker profiles: planner, reviewer, implementer, verifier.
- LLM-callable `agent_worker_*` tools.
- Workspace preflight and safety.
- Bounded multi-worker dispatch.
- Worker history, status, wait, cancel, and UI widget surfaces.

The product boundary is now explicit: `agent-workers` remains the worker execution and supervision runtime. A separate `pi-extension-subagents` package should own direct delegation UX, agent definitions, context policy, and bounded result presentation while reusing `agent-workers` through a versioned runtime protocol. A future Agent Teams package may reuse the same runtime but owns shared tasks, messaging, assignment, and coordination.

## Recommended priority

1. Plan mode first.
   - Lowest risk.
   - Mostly tool gating, prompt injection, and UI state.
   - Creates a plan artifact that later goal/loop mode can consume.
2. Goal / loop mode second.
   - Build conservative bounded autonomy after plan-mode semantics are stable.
   - Start with one-step-at-a-time execution and verification, not full-auto execution.
3. Harden the existing pi SDK worker adapter and expose a versioned worker runtime protocol.
   - Keep execution, safety, lifecycle, and artifacts inside `pi-extension-agent-workers`.
4. Build direct sub-agent behavior as a separate facade package.
   - `pi-extension-subagents` should reuse the runtime protocol rather than duplicate worker execution.
5. Add Agent Teams only as a later coordination layer.
   - Shared tasks, teammate messaging, assignment, and synthesis do not belong in either the worker runtime or the initial sub-agent facade.

## Five-phase roadmap

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

### Phase 4 — harden the implemented pi SDK adapter and add a runtime protocol

Status: the initial `pi-sdk` adapter shipped in `pi-extension-agent-workers` v0.4.0. The remaining work belongs to the active v0.5.0 hardening track.

Goal: make pi-native worker execution a reliable shared substrate without turning `agent-workers` into a broad sub-agent or Agent Teams product.

Expected capabilities:

- Preserve bounded complete child results with private artifact fallback.
- Pass supported worker profile system prompt, model, and thinking options into the child session.
- Enforce child timeout and turn/budget limits.
- Keep child extensions, skills, context files, and nested worker tools disabled by default.
- Expose versioned, correlated start/status/wait/cancel/profile operations over `pi.events` through one shared worker manager.

### Phase 5 — separate `pi-extension-subagents` facade

Goal: provide direct foreground delegation while reusing the Agent Workers runtime protocol.

Initial scope:

- Strict `calls[]` contract.
- Built-in read-only agents.
- Bounded parallel delegation and complete compact results.
- Clear missing-runtime and protocol-version errors.

Deferred from the first facade milestone:

- Nested sub-agents.
- Long-lived child sessions.
- Parent-context inheritance.
- Background runs.
- Write-capable agents.
- Agent Teams coordination semantics.

## Key decision

Treat these as layered capabilities, not three unrelated packages:

```text
Plan mode
  -> produces safe plans and explicit main-session execution handoff
  -> does not own goal loops or worker delegation
Goal / loop mode
  -> manages bounded iterative progress and verification policy
  -> may consume explicit plan artifacts
Agent workers
  -> own worker execution, lifecycle, safety, artifacts, and adapters
Sub-agent facade
  -> owns direct delegation UX, agent definitions, context policy, and result presentation
Agent Teams (future)
  -> owns shared tasks, messaging, assignment, coordination, and synthesis
```

This preserves one worker runtime while keeping sub-agent and future team product semantics in separate packages.
