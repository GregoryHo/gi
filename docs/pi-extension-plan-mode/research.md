# Plan mode research artifact

Date: 2026-06-27

## Research question

How should this repo add pi agent extensions for plan mode, goal/loop mode, and sub-agent behavior, and what should be implemented first?

## Local pi API findings

Installed pi extension docs support the needed plan mode surface:

- `pi.registerCommand()` and `pi.registerShortcut()` can expose `/plan` and a toggle shortcut.
- `pi.registerFlag()` can support startup flags such as `--plan`.
- `pi.getActiveTools()` / `pi.setActiveTools()` can disable write tools during planning and restore the prior tool set later.
- `pi.on("tool_call")` can block unsafe `bash` calls while plan mode is active.
- `pi.on("before_agent_start")` can inject compact planning instructions.
- `pi.on("context")` can filter stale plan-mode context after mode exit.
- `pi.appendEntry()` plus `ctx.sessionManager` can persist and restore extension state.
- `ctx.ui.setStatus()` and `ctx.ui.setWidget()` can surface mode/progress in the TUI.

The installed pi examples include `examples/extensions/plan-mode/`, which already demonstrates a read-only mode, bash allowlist, plan extraction, `[DONE:n]` progress markers, and session persistence. This should be treated as prior art, not copied blindly.

## Public tool research

### Claude Code

Relevant public docs:

- `https://code.claude.com/docs/en/permission-modes`
- `https://code.claude.com/docs/en/sub-agents`
- `https://code.claude.com/docs/en/cli-usage`

Observed design implications:

- Claude Code plan mode is a permission/execution mode: read/explore first, approve a plan before editing.
- Claude subagents provide context isolation, specialized prompts, tool restrictions, model overrides, and foreground/background execution.
- Subagents are best treated as isolated delegated workers; plan mode should remain a top-level orchestration state rather than just another worker.

### Codex CLI

Relevant public docs/pages:

- `https://developers.openai.com/codex/cli`
- `https://openai.com/index/introducing-codex/`
- `https://openai.com/index/running-codex-safely/`

Observed design implications:

- Codex approval modes map well to bounded autonomy levels for future goal/loop mode.
- `codex exec` and cloud/sandbox tasks suggest a durable execute/observe workflow, but those are later-stage concerns.
- For this repo, autonomous loop behavior should start with conservative iteration limits and approval gates.

## Repo fit

Existing package `pi-extension-agent-workers` already covers much of the sub-agent/worker need:

- Claude Code and Codex CLI adapters.
- planner/reviewer/implementer/verifier profiles.
- LLM-callable `agent_worker_*` tools.
- workspace safety and bounded multi-worker dispatch.

Therefore, do not start sub-agent work as a completely separate package first. Prefer integrating goal/loop mode with `agent-workers`, and later add a pi-native SDK worker adapter if needed.

## Recommended route

1. Build `pi-extension-plan-mode` first.
   - Lowest risk.
   - Establishes plan artifacts and approval UX.
   - Enables later loop mode to consume plans.
2. Build conservative `pi-extension-goal-mode` later.
   - Use bounded loop state: plan → execute one step → verify → continue/block.
   - Add hard limits and explicit stop conditions.
3. Integrate goal mode with `pi-extension-agent-workers`.
   - Delegate planning, verification, or implementation to worker profiles.
4. Add pi-native sub-agent adapter to `agent-workers` only after the above is stable.

## Open questions

- Should M1 include plan extraction, or only safe mode toggling? Recommendation: keep M1 to safe mode toggling and prompt injection; defer plan extraction to M2.
- Should `/plan` be a toggle or one-shot prefix? Recommendation: implement toggle first; consider one-shot prefix in M2.
- Should plan mode include `bash` at all? Recommendation: yes, but only with a conservative read-only allowlist and clear block messages.
