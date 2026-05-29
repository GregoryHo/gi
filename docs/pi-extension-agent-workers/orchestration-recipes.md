# Agent workers orchestration recipes

These recipes show how to compose `pi-extension-agent-workers` with natural language, slash commands, and LLM-callable tools.

The key design rule: **agent-workers stays domain-independent**. Other extensions, such as Jira, provide context through their own tools. The LLM then passes that context to `agent_worker_start` as a generic worker task.

## Available worker tools

- `agent_worker_list_profiles` — discover built-in profiles.
- `agent_worker_start` — start one worker using a profile or explicit adapter.
- `agent_worker_status` — inspect one run or all runs.
- `agent_worker_cancel` — cancel one run.

## Output fields

Tool and status output is intentionally compact:

- `runId` — stable id for follow-up status/cancel/log requests.
- `status` — `running`, `completed`, `failed`, or `cancelled`.
- `usage.source` — `reported`, `estimated`, or `unknown`; missing usage is unknown, not zero.
- `activity` — compact recent worker activity summary.
- `finalText` / `final` — final text preview when the adapter emits one.
- `cwd` — effective worker workspace for the run.
- `logPath` — local artifact path for raw logs. Treat logs as sensitive.

Raw CLI events are not exposed by tools by default.

## Workspace guidance

Before delegating product or Jira work, assign the target repository per worker run. For commands, use:

```text
/worker-run --pick-cwd --profile planner Plan the issue...
```

Or pass an explicit cwd for one run:

```json
agent_worker_start({
  "cwd": "/path/to/product-repo",
  "profile": "planner",
  "task": "Plan the Jira issue..."
})
```

Worker output includes `cwd`. Confirm it is the intended product repository before trusting code-inspection claims. If no `cwd` is passed, workers fall back to the current pi cwd; there is no sticky selected workspace default.

## Safety notes

- Real Claude/Codex workers may read or modify files according to their own CLI policy.
- Start real workers only when the user clearly requested delegation or after confirmation.
- The extension does not add dangerous permission or sandbox bypass flags by default.
- Runtime logs stay local under `~/.pi/agent/agent-workers/runs/<runId>/` and may include prompts, repository context, command output, or account metadata.
- Do not present `usage.source: unknown` as zero usage.

## Recipe: safe demo worker smoke

Use this first when validating that tools are loaded without invoking a real model.

User prompt:

```text
Use agent_worker_start with the demo adapter to run: hello from tool facade. Then check its status.
```

Expected LLM tool sequence:

```json
agent_worker_start({
  "adapter": "demo",
  "task": "hello from tool facade"
})
```

Then:

```json
agent_worker_status({
  "runId": "<runId from start>"
})
```

Expected result:

- adapter is `demo`.
- status becomes `completed` quickly.
- `usage.source` remains `unknown`.

Equivalent manual command fallback:

```text
/worker-run --adapter demo hello from tool facade
/worker-status <runId>
```

## Recipe: standalone milestone planning

Use this when the user wants a plan from a worker without tying the request to another extension.

User prompt:

```text
Plan the next implementation steps for this milestone with a worker.
```

Expected LLM tool sequence:

```json
agent_worker_start({
  "cwd": "/path/to/target-repo",
  "profile": "planner",
  "task": "Plan the next implementation steps for the current milestone. Keep the plan concise, identify risks, and do not modify files."
})
```

Then:

```json
agent_worker_status({
  "runId": "<runId from start>"
})
```

Notes:

- `planner` is a generic profile, currently backed by `claude-code`.
- Real worker confirmation should be expected unless the user clearly requested delegation.
- Use `finalText`/`final` as the short result preview; use `logPath` only when the user asks for details.

Equivalent manual command fallback:

```text
/worker-run --profile planner Plan the next implementation steps for the current milestone. Keep the plan concise, identify risks, and do not modify files.
/worker-status <runId>
```

## Recipe: standalone milestone implementation with Codex

Use this when the user explicitly asks for implementation delegation to Codex.

User prompt:

```text
Implement this milestone with a codex worker.
```

Expected LLM tool sequence:

```json
agent_worker_start({
  "cwd": "/path/to/target-repo",
  "adapter": "codex-cli",
  "mode": "implement",
  "task": "Implement the current milestone. Keep changes focused on the documented acceptance criteria. Report completion, tests run, and any blockers."
})
```

Then poll:

```json
agent_worker_status({
  "runId": "<runId from start>"
})
```

Notes:

- This is a real model/CLI call and may modify the working tree according to Codex CLI behavior.
- Confirmation should be expected unless the user has already clearly requested delegation.
- After completion, inspect `status`, `finalText`, `activity`, and `logPath`. Run normal verification before making completion claims.

Equivalent manual command fallback:

```text
/worker-run --adapter codex-cli Implement the current milestone. Keep changes focused on the documented acceptance criteria. Report completion, tests run, and any blockers.
/worker-status <runId>
```

## Recipe: Jira focused issue planning

Use this when both `pi-extension-jira-board` and `pi-extension-agent-workers` are loaded and the user asks to plan the currently focused Jira issue.

User prompt:

```text
Jira plan with the focused issue and delegate to a Claude worker.
```

Expected LLM tool sequence:

1. Fetch Jira context from the Jira extension:

```json
jira_get_focused_issue({})
```

2. Build a generic worker task from the Jira issue summary/description. Do not pass Jira-specific control structures to agent-workers; pass plain task text:

```json
agent_worker_start({
  "cwd": "/path/to/product-repo",
  "profile": "planner",
  "task": "Plan implementation for this Jira issue. Include likely files, risks, acceptance checks, and a concise step-by-step plan. Issue context:\n\n<compact Jira issue summary and description>"
})
```

3. Check progress:

```json
agent_worker_status({
  "runId": "<runId from start>"
})
```

Notes:

- `agent-workers` does not import Jira and does not know what a focused issue is.
- Jira tools own Jira fetching; agent-worker tools own worker delegation.
- If the user did not clearly request delegation, ask before starting the real worker.

## Recipe: Jira focused issue implementation delegation with Codex

Use this when the user explicitly asks to delegate implementation for the focused Jira issue to Codex.

User prompt:

```text
Use the focused Jira issue and delegate implementation to a codex worker.
```

Expected LLM tool sequence:

1. Fetch Jira issue context:

```json
jira_get_focused_issue({})
```

2. Start Codex with a generic task:

```json
agent_worker_start({
  "cwd": "/path/to/product-repo",
  "adapter": "codex-cli",
  "mode": "implement",
  "task": "Implement the following Jira issue. Keep changes focused, avoid unrelated refactors, and report files changed plus verification commands. Issue context:\n\n<compact Jira issue summary and description>"
})
```

3. Poll status:

```json
agent_worker_status({
  "runId": "<runId from start>"
})
```

4. If the user asks to stop it:

```json
agent_worker_cancel({
  "runId": "<runId>"
})
```

Notes:

- This recipe starts a real worker and may affect the working tree.
- Do not start it unless the user clearly asked for implementation delegation or confirms.
- Use normal repository verification after completion; worker completion is not the same as validated code completion.

## Future runtime directions

The Jira and standalone recipes above are the supported composition model: other extensions provide context, and `agent-workers` runs generic delegated tasks.

For v0.2.0, prefer reliability improvements that make this loop easier to operate:

- wait/timeout behavior for delegated runs.
- local run artifact indexing and recent-history visibility.
- safer implementation profiles with focused-change and verification guidance.

Keep `agent-workers` generic and compose it with other extensions through LLM tool calls.
