# M5 — LLM tool facade

## Status

Done.

## SPEC

### Scope

Expose `agent-workers` as LLM-callable pi tools so a user can combine it naturally with other extensions, while keeping this package domain-independent.

M5 should let the LLM use worker delegation in two generic scenarios:

1. With other extensions, for example Jira board + agent workers:
   - LLM calls Jira tools such as `jira_get_focused_issue` or `jira_get_issue`.
   - LLM builds a generic worker task from that context.
   - LLM calls an agent-worker tool such as `agent_worker_start` with a profile or adapter.
   - The two packages remain decoupled; no Jira-specific code belongs in `agent-workers`.
2. Standalone agent workers:
   - User asks naturally, for example "implement this milestone with codex workers".
   - LLM calls an agent-worker tool directly with `adapter: "codex-cli"` or a profile.
   - User can still use slash commands manually.

M5 should add a minimal tool facade over the M4 service API:

- `agent_worker_start`
- `agent_worker_status`
- `agent_worker_cancel`
- `agent_worker_list_profiles`

### Tool contracts

#### `agent_worker_start`

Starts one worker through the existing M4 request/profile service.

Suggested parameters:

```ts
{
  profile?: "planner" | "reviewer" | string;
  adapter?: "demo" | "claude-code" | "codex-cli";
  task: string;
  systemPrompt?: string;
  mode?: "plan" | "review" | "implement" | "custom";
  cwd?: string;
  model?: string;
  timeoutMs?: number;
  requireConfirmation?: boolean;
}
```

Suggested output details:

```ts
{
  runId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  adapter: string;
  taskPreview: string;
  usage: WorkerUsage;
  activity: string[];
  finalText?: string;
  logPath: string;
}
```

The tool should not expose raw CLI event payloads. Raw logs remain local artifacts only.

#### `agent_worker_status`

Returns status for one run or all runs.

Suggested parameters:

```ts
{
  runId?: string;
}
```

#### `agent_worker_cancel`

Cancels one running worker.

Suggested parameters:

```ts
{
  runId: string;
}
```

#### `agent_worker_list_profiles`

Returns built-in profile summaries so the LLM can choose profile-backed invocation.

Suggested parameters:

```ts
{}
```

### Safety and confirmation

- Real worker starts should keep the same confirmation gate used by commands unless explicitly confirmed by the user/tool context.
- Tool descriptions and prompt guidelines should tell the LLM to ask before starting real Claude/Codex workers if the user has not clearly requested delegation.
- The tool facade must not add dangerous permission or sandbox bypass flags.
- The tool facade must not create a second worker manager that diverges from command state; commands and tools should share the same service instance.
- Missing usage remains `source: "unknown"`.

### Non-goals

- No Jira-specific tool or command in `agent-workers`.
- No worktree automation.
- No event bus integration.
- No multi-worker dashboard.
- No raw event payload exposure by default.
- No parallel worker execution beyond the existing one-running-worker policy.

### Expected files

Likely package files:

- `src/tools.ts`
- updates to `src/index.ts` to register tools and share the service instance with commands
- updates to `src/service.ts` if result shaping needs adapter/task preview fields
- tests for tool registration, tool schemas/behavior, shared state with commands, and confirmation behavior

Docs updates at completion:

- `README.md`
- `CHANGELOG.md`
- `docs/pi-extension-agent-workers/milestones.md`
- `docs/pi-extension-agent-workers/log.md`

## AC

Implementation is complete when:

1. `agent_worker_start` can start a demo worker through M4 request/profile resolution.
2. `agent_worker_start` can start real adapters only through the same confirmation policy as commands.
3. `agent_worker_status` returns compact status for one run or all runs.
4. `agent_worker_cancel` cancels a run through the shared service.
5. `agent_worker_list_profiles` returns at least `planner` and `reviewer`.
6. Commands and tools share one `AgentWorkerService` instance within the extension.
7. Tool outputs use compact public result/status shapes and do not expose raw event payloads.
8. Tool descriptions/guidelines support natural-language orchestration with other extensions without domain coupling.
9. Tests cover tool registration, start/status/cancel/list behavior, profile usage, and no raw event exposure.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

Manual smoke check:

```bash
pi -e ./packages/pi-extension-agent-workers
```

Then verify natural language or explicit tool-driven usage, avoiding committed raw logs. A safe first manual check can use the demo adapter before any real model call.

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M5 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M5 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M5 as a generic LLM-callable tool facade over the M4 service, without adding Jira/worktree/domain-specific code.

Implemented tools:

- `agent_worker_start`
- `agent_worker_status`
- `agent_worker_cancel`
- `agent_worker_list_profiles`

Implemented behavior:

- Commands and tools share one `AgentWorkerService` instance in the extension entrypoint.
- Tool outputs use compact worker summaries and do not expose raw event payloads.
- Real adapter starts preserve confirmation behavior.
- Tool prompt guidelines describe how to compose with Jira or other extension tools through LLM orchestration rather than package coupling.

Manual smoke evidence from pi interactive testing:

- `agent_worker_list_profiles` returned `planner` and `reviewer`.
- `agent_worker_start` with `adapter: "demo"` started `run_1779696304986_3a2f89f8` for `hello from tool facade`.
- `agent_worker_status` reported that run as `completed`.

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
```

A non-interactive load smoke check also exited successfully:

```bash
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```
