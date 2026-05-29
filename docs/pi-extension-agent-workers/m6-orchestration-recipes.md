# M6 — Orchestration examples and recipes

## Status

Done.

## SPEC

### Scope

Document concrete ways to use the M5 tool facade in real workflows without adding new runtime coupling or domain-specific code to `agent-workers`.

M6 should prove that the generic `agent_worker_*` tools are understandable and sufficient for common orchestration patterns:

1. Jira board + agent workers:
   - User asks naturally, for example: "jira plan with the focus issue and delegate to claude workers".
   - LLM uses Jira extension tools to fetch issue context.
   - LLM uses `agent_worker_start` with `profile: "planner"` or an explicit adapter.
   - LLM uses `agent_worker_status` to report progress/result.
   - No direct package dependency between Jira and agent-workers is introduced.
2. Standalone agent workers:
   - User asks naturally, for example: "implement this milestone with codex workers".
   - LLM uses `agent_worker_start` directly with `adapter: "codex-cli"` or a profile.
   - LLM uses `agent_worker_status` and points to local `logPath` if needed.
3. Manual command fallback:
   - User can still use `/worker-run`, `/worker-status`, `/worker-log`, and `/worker-kill` directly.

### Deliverables

M6 is documentation/examples only unless a concrete gap is found during validation.

Expected deliverables:

- Add an orchestration section to `packages/pi-extension-agent-workers/README.md`.
- Add `docs/pi-extension-agent-workers/orchestration-recipes.md` with copy-pasteable examples.
- Include at least these recipes:
  - Jira focused issue planning with `planner` profile.
  - Jira focused issue implementation delegation with `codex-cli` adapter, including explicit confirmation expectation.
  - Standalone milestone planning with `planner` profile.
  - Standalone milestone implementation with `codex-cli` adapter.
  - Safe demo worker smoke recipe.
- Include guidance on interpreting `runId`, `status`, `usage.source`, `finalText`, `activity`, and `logPath`.
- Include safety notes:
  - raw logs are local artifacts and may contain sensitive context.
  - real worker starts should require clear user intent or confirmation.
  - usage is `reported`, `estimated`, or `unknown`; do not present missing usage as zero.
  - `agent-workers` remains domain-independent.

### Non-goals

- No new runtime tools.
- No Jira-specific command implementation.
- No worktree automation.
- No event bus integration.
- No multi-worker dashboard.
- No real model calls required for documentation validation unless explicitly approved.

### Validation approach

This milestone should validate recipes in the lightest useful way:

- Run automated package verification.
- Load the extension non-interactively.
- Optionally run a safe demo-tool smoke if already in an interactive pi session.
- Do not run real Claude/Codex tasks unless explicitly approved.

## AC

Implementation is complete when:

1. README explains natural-language orchestration through `agent_worker_*` tools.
2. `orchestration-recipes.md` documents Jira + agent-workers and standalone agent-workers recipes.
3. Recipes are generic and do not require `agent-workers` to import Jira or any domain extension.
4. Recipes clearly identify which steps are LLM tool calls vs user slash commands.
5. Safety and usage-source guidance is documented.
6. Verification commands pass.

Verification commands:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```

## Status tracking

At milestone start:

1. Update `docs/pi-extension-agent-workers/milestones.md` status for M6 to `In progress`.
2. Append a start entry to `docs/pi-extension-agent-workers/log.md`.
3. Commit the status/log update before implementation work.

At milestone completion:

1. Run the AC verification commands.
2. Update M6 status to `Done` in `milestones.md`.
3. Add completion notes to this plan if useful.
4. Append verification evidence to `log.md`.
5. Commit the completed milestone state.

## Completion notes

Implemented M6 as documentation/examples only. No runtime surfaces, Jira-specific code, worktree automation, event bus integration, or model calls were added.

Implemented:

- `docs/pi-extension-agent-workers/orchestration-recipes.md`
- README orchestration section linking to the recipe doc
- recipe coverage for:
  - safe demo worker smoke
  - standalone milestone planning with `planner`
  - standalone milestone implementation with `codex-cli`
  - Jira focused issue planning through Jira tools plus `agent_worker_start`
  - Jira focused issue implementation delegation through Jira tools plus `agent_worker_start`
- output interpretation guidance for `runId`, `status`, `usage.source`, `activity`, `finalText`, and `logPath`
- safety notes for real workers, local raw logs, unknown usage, and domain independence

Verification completed with:

```bash
npm test --workspace @gregho/pi-extension-agent-workers
npm run typecheck --workspace @gregho/pi-extension-agent-workers
npm run pack:dry-run --workspace @gregho/pi-extension-agent-workers
npm run typecheck
pi -e ./packages/pi-extension-agent-workers --no-session -p "/agent-workers"
```
